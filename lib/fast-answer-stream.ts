// Shared "answer while it's being written" plumbing for the interactive
// assistants (PDF "اسأل AI", the study-sheet chat and the general مساعد AI):
// streams plain text from the fast text model (or the given model, e.g. the
// vision model for photos), falling back to the regular model chain when it
// fails before writing anything.
import { streamText } from "./ai/gateway";
import { FAST_TEXT_MODEL, invokeLLM, type Message } from "./llm";

export function streamFastAnswer(
  messages: Message[],
  options: {
    maxTokens?: number;
    logTag: string;
    // Overrides the fast text model (e.g. DEFAULT_VISION_MODEL for images).
    model?: string;
    // Called once with the full text the student received (for saving it);
    // errors here are logged, never shown mid-answer.
    onComplete?: (answer: string) => Promise<void>;
  }
): Response {
  const maxTokens = options.maxTokens ?? 2500;
  const model = options.model ?? FAST_TEXT_MODEL;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let wrote = false;
      let full = "";
      const write = (text: string) => {
        full += text;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // The student stopped / left — keep collecting for onComplete.
        }
      };
      try {
        for await (const chunk of streamText({
          messages,
          model: model || undefined,
          maxTokens,
        })) {
          if (chunk.delta) {
            wrote = true;
            write(chunk.delta);
          }
        }
        if (!wrote) throw new Error("empty stream");
      } catch (error) {
        if (wrote) {
          // Cut off mid-answer: keep what was written, say so honestly.
          write("\n\n(انقطع الرد، حاول مرة أخرى)");
        } else {
          console.warn(
            `[${options.logTag}] ${model || "default"} failed, using the regular chain`,
            error
          );
          try {
            const response = await invokeLLM({
              messages,
              model: options.model,
              max_tokens: maxTokens,
            });
            const answer = response.choices[0]?.message.content?.trim();
            write(answer || "لم يصل رد من المساعد، حاول مرة أخرى.");
          } catch (fallbackError) {
            console.error(
              `[${options.logTag}] all models failed`,
              fallbackError
            );
            write("تعذر الوصول للمساعد الآن، حاول بعد قليل 🙏");
          }
        }
      } finally {
        if (options.onComplete) {
          try {
            await options.onComplete(full);
          } catch (saveError) {
            console.error(`[${options.logTag}] onComplete failed`, saveError);
          }
        }
        try {
          controller.close();
        } catch {
          // Already cancelled by the client.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
