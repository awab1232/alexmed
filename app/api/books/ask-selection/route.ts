import { auth } from "@/lib/auth";
import { getBookPageForUser } from "@/lib/db-books";
import { streamText } from "@/lib/ai/gateway";
import { FAST_TEXT_MODEL, invokeLLM } from "@/lib/llm";
import {
  allowSelectionAssistantRequest,
  buildSelectionAssistantMessages,
} from "@/lib/selection-assistant";
import { NextResponse } from "next/server";
import { z } from "zod";

// "اسأل AI" on text selected in the PDF reader
// (components/pdf/SelectionAssistant.tsx). Streams the answer as plain text
// so the student starts reading within seconds instead of waiting for the
// whole reply — the free fast models take ~15-30s to finish an answer
// through OmniRoute, but start writing almost immediately.
//
// Model: FAST_TEXT_MODEL (OMNIROUTE_FAST_TEXT_MODEL, e.g.
// grok-cli/grok-composer-2.5-fast). If it fails before writing anything,
// the same question goes through the regular chain (default model +
// OMNIROUTE_FALLBACK_MODELS) so the student still gets an answer.
export const maxDuration = 120;

const bodySchema = z.object({
  bookId: z.string(),
  pageNumber: z.number().int().positive(),
  selectedText: z.string().trim().min(1).max(4000),
  action: z.enum(["explain", "arabic", "exam", "summarize", "ask"]),
  question: z.string().max(1000).optional(),
  fileName: z.string().max(200).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(6000),
      })
    )
    .max(12)
    .optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "الرجاء تسجيل الدخول أولاً." },
      { status: 401 }
    );
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  const input = parsed.data;
  if (!allowSelectionAssistantRequest(session.user.id)) {
    return NextResponse.json(
      { error: "أسئلة كثيرة خلال وقت قصير، حاول بعد دقائق." },
      { status: 429 }
    );
  }
  // Ownership: the page must belong to one of this user's books.
  const found = await getBookPageForUser(
    session.user.id,
    input.bookId,
    input.pageNumber
  );
  if (!found) {
    return NextResponse.json({ error: "الصفحة غير موجودة." }, { status: 404 });
  }

  const messages = buildSelectionAssistantMessages({
    fileName: input.fileName ?? "PDF",
    pageNumber: input.pageNumber,
    pageText: found.page.extractedText ?? "",
    selectedText: input.selectedText,
    action: input.action,
    question: input.question,
    history: input.history,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let wrote = false;
      try {
        for await (const chunk of streamText({
          messages,
          model: FAST_TEXT_MODEL || undefined,
          maxTokens: 2500,
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
            "[ask-selection] fast model failed, using the regular chain",
            error
          );
          try {
            const response = await invokeLLM({ messages, max_tokens: 2500 });
            const answer = response.choices[0]?.message.content?.trim();
            controller.enqueue(
              encoder.encode(answer || "لم يصل رد من المساعد، حاول مرة أخرى.")
            );
          } catch (fallbackError) {
            console.error("[ask-selection] all models failed", fallbackError);
            controller.enqueue(
              encoder.encode("تعذر الوصول للمساعد الآن، حاول بعد قليل.")
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
