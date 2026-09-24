// Shared "answer while it's being written" plumbing for the interactive
// assistants (PDF "اسأل AI" and the general مساعد AI): streams plain text
// from the fast text model, falling back to the regular model chain when the
// fast model fails before writing anything.
import { streamText } from "./ai/gateway";
import { FAST_TEXT_MODEL, invokeLLM, type Message } from "./llm";

export function streamFastAnswer(
  messages: Message[],
  options: { maxTokens?: number; logTag: string }
): Response {
  const maxTokens = options.maxTokens ?? 2500;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let wrote = false;
      try {
        for await (const chunk of streamText({
          messages,
          model: FAST_TEXT_MODEL || undefined,
          maxTokens,
        })) {
          if (chunk.delta) {
            wrote = true;
            controller.enqueue(encoder.encode(chunk.delta));
          }
        }
        if (!wrote) throw new Error("empty stream");
      } catch (error) {
        if (wrote) {
          // Cut off mid-answer: keep what was written, say so honestly.
          controller.enqueue(encoder.encode("\n\n(انقطع الرد، حاول مرة أخرى)"));
        } else {
          console.warn(
            `[${options.logTag}] fast model failed, using the regular chain`,
            error
          );
          try {
            const response = await invokeLLM({
              messages,
              max_tokens: maxTokens,
            });
            const answer = response.choices[0]?.message.content?.trim();
            controller.enqueue(
              encoder.encode(answer || "لم يصل رد من المساعد، حاول مرة أخرى.")
            );
          } catch (fallbackError) {
            console.error(
              `[${options.logTag}] all models failed`,
              fallbackError
            );
            controller.enqueue(
              encoder.encode("تعذر الوصول للمساعد الآن، حاول بعد قليل 🙏")
            );
          }
        }
      } finally {
        controller.close();
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
