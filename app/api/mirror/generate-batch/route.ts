import { auth } from "@/lib/auth";
import { AiRateLimitError } from "@/lib/ai/types";
import {
  completeBatchGeneration,
  getMirrorBatchForUser,
  setBatchFailed,
  setBatchGenerating,
} from "@/lib/db-mirror";
import { invokeLLM } from "@/lib/llm";
import {
  buildGenerateMessages,
  GENERATE_MAX_TOKENS,
  GeneratedCard,
  parseJsonResponse,
  responseSchema,
} from "@/lib/pdf-cards";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

// Vercel Hobby's hard ceiling for a serverless function is 60s regardless of
// this value — mirrors /api/books/analyze-chapter's own setting.
export const maxDuration = 60;

// The core of the resumable مِرآة pipeline (Item D): generates cards for
// exactly ONE batch and persists the full result before returning. The
// client calls this once per pending/failed batch, sequentially — see
// app/mirror/[jobId]/page.tsx, mirroring app/books/[bookId]/page.tsx's
// analyze-chapter loop exactly.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "الرجاء تسجيل الدخول أولاً." },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    batchId?: string;
  };
  const batchId = typeof body.batchId === "string" ? body.batchId : "";
  if (!batchId) {
    return NextResponse.json({ error: "معرف الدفعة مفقود." }, { status: 400 });
  }

  const batch = await getMirrorBatchForUser(session.user.id, batchId);
  if (!batch) {
    return NextResponse.json({ error: "الدفعة غير موجودة." }, { status: 404 });
  }

  const pages = (batch.pageTexts ?? []).filter(page => page.hasText);
  if (!pages.length) {
    // No usable text in this batch (e.g. every page failed OCR) — complete
    // it with zero cards rather than failing, same as the client-side
    // processBatch()'s "no usable pages" branch used to do.
    await completeBatchGeneration(batchId, batch.jobId, session.user.id, []);
    return NextResponse.json({ batchId, status: "complete", cards: [] });
  }

  await setBatchGenerating(batchId);

  try {
    const response = await invokeLLM({
      max_tokens: GENERATE_MAX_TOKENS,
      messages: buildGenerateMessages(pages, batch.depth),
      response_format: responseSchema,
    });

    const parsed = parseJsonResponse(response.choices[0]?.message.content);
    const cards: GeneratedCard[] = Array.isArray(parsed.cards)
      ? parsed.cards.map((card: GeneratedCard) => ({
          ...card,
          sourcePage: pages.some(page => page.page === card.sourcePage)
            ? card.sourcePage
            : pages[0].page,
        }))
      : [];

    if (!cards.length) {
      await setBatchFailed(
        batchId,
        "لم يتم العثور على أسئلة قابلة للتحويل إلى بطاقات في هذه الصفحة."
      );
      return NextResponse.json(
        {
          error:
            "لم يتم توليد أي بطاقة لهذه الصفحة. أعد المحاولة للتأكد من عدم فقدان الأسئلة.",
        },
        { status: 422 }
      );
    }

    await completeBatchGeneration(batchId, batch.jobId, session.user.id, cards);

    return NextResponse.json({
      batchId,
      status: "complete",
      cards: cards.map(card => ({ id: randomUUID(), ...card })),
    });
  } catch (error) {
    console.error("[Mirror] Batch generation failed", error);
    if (error instanceof AiRateLimitError) {
      await setBatchFailed(
        batchId,
        "تجاوزنا الحد المؤقت لمزوّد الذكاء الاصطناعي."
      );
      return NextResponse.json(
        {
          error:
            "تجاوزنا الحد المؤقت لمزوّد الذكاء الاصطناعي. سيُعاد المحاولة تلقائيًا بعد قليل.",
          retryAfterMs: error.retryAfterMs,
        },
        { status: 429 }
      );
    }
    await setBatchFailed(batchId, "تعذر توليد بطاقات لهذه الدفعة.");
    return NextResponse.json(
      { error: "تعذر توليد بطاقات لهذه الدفعة. حاول مرة أخرى." },
      { status: 502 }
    );
  }
}
