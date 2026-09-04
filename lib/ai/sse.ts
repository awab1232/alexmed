// Minimal parser for OpenAI-style SSE chat-completion streams
// ("data: {...}\n\n", terminated by "data: [DONE]"). Shared by every
// provider's streamText() so the framing logic isn't duplicated.
import type { StreamChunk } from "./types";

export async function* parseOpenAiSseStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<StreamChunk, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          yield { delta: "", done: true };
          return;
        }
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string | null } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield { delta, done: false };
        } catch {
          // Ignore malformed/keep-alive frames rather than aborting the stream.
        }
      }
    }
    yield { delta: "", done: true };
  } finally {
    reader.releaseLock();
  }
}
