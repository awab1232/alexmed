import { AiRateLimitError } from "@/lib/ai/types";
import {
  completeBatchGeneration,
  finalizeMirrorJobIfDone,
  getMirrorBatchById,
  markMirrorBatchFailedTerminal,
  markMirrorBatchRetrying,
} from "@/lib/db-mirror";
import { invokeLLM } from "@/lib/llm";
import {
  buildGenerateMessages,
  GENERATE_MAX_TOKENS,
  GeneratedCard,
  parseJsonResponse,
  responseSchema,
} from "@/lib/pdf-cards";
import { claimMirrorBatch } from "@/lib/queue/claim";
import { getQueueMaxAttempts } from "@/lib/queue/types";
import { verifyQStashRequest } from "@/lib/queue/verify";
import { NextResponse } from "next/server";

// Vercel Hobby's hard ceiling for a serverless function is 60s regardless of
// this value.
export const maxDuration = 60;

// The مِرآة worker (QStash queue migration): generates cards for exactly ONE
// batch and persists the full result before returning. This route is no
// longer callable by the browser — it's invoked only by QStash, verified via
// signature below — see app/mirror/[jobId]/page.tsx, which now just polls
// job/batch status instead of driving generation itself.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("upstash-signature");
  const verified = await verifyQStashRequest(rawBody, signature, request.url);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let batchId: string;
  let batch: Awaited<ReturnType<typeof getMirrorBatchById>>;
  let claimed: Awaited<ReturnType<typeof claimMirrorBatch>>;
  try {
    const body = JSON.parse(rawBody) as { batchId?: string };
    batchId = typeof body.batchId === "string" ? body.batchId : "";
    if (!batchId) {
      // Malformed message — retrying won't help, ack so QStash doesn't retry.
      return NextResponse.json({ error: "معرف الدفعة مفقود." }, { status: 200 });
    }

    batch = await getMirrorBatchById(batchId);
    if (!batch) {
      // Batch no longer exists (e.g. its job was deleted) — nothing to do.
      return NextResponse.json({ batchId, status: "skipped" });
    }

    claimed = await claimMirrorBatch(batchId);
    if (!claimed) {
      // Already processing (a concurrent/duplicate delivery) or already
      // complete — QStash is at-least-once, so this is expected
      // occasionally, not an error. Ack without doing any AI work.
      return NextResponse.json({ batchId, status: "already_processing" });
    }
  } catch (error) {
    // Anything before the claim (malformed body, a transient DB error) is
    // safe to let QStash retry — nothing has been claimed/mutated yet.
    console.error("[Mirror] Batch lookup/claim failed", error);
    return NextResponse.json(
      { error: "تعذر تجهيز هذه الدفعة." },
      { status: 502 }
    );
  }

  const pages = (batch.pageTexts ?? []).filter(page => page.hasText);
  if (!pages.length) {
    // No usable text in this batch (e.g. every page failed OCR) — complete
    // it with zero cards rather than failing; there's nothing to retry.
    await completeBatchGeneration(batchId, batch.jobId, batch.userId, []);
    await finalizeMirrorJobIfDone(batch.jobId);
    return NextResponse.json({ batchId, status: "complete", cards: [] });
  }

  const maxAttempts = getQueueMaxAttempts();

  async function retryOrFail(errorMessage: string, httpStatus: number) {
    if (claimed!.attemptCount >= maxAttempts) {
      await markMirrorBatchFailedTerminal(batchId, errorMessage);
      await finalizeMirrorJobIfDone(batch!.jobId);
      // Ack — attempts exhausted, no more QStash retries wanted.
      return NextResponse.json({
        batchId,
        status: "failed",
        error: errorMessage,
      });
    }
    await markMirrorBatchRetrying(batchId, errorMessage);
    // Non-2xx — QStash redelivers per its own retry/backoff schedule.
    return NextResponse.json({ error: errorMessage }, { status: httpStatus });
  }

  try {
    const response = await invokeLLM({
      max_tokens: GENERATE_MAX_TOKENS,
      messages: buildGenerateMessages(pages, batch.depth),
      response_format: responseSchema,
    });

    const parsed = parseJsonResponse(response.choices[0]?.message.content);
    // Reject (not coerce) any card whose sourcePage falls outside this
    // batch's own pages — a model hallucinating a page number outside the
    // batch is a data-integrity issue, not something to silently paper over.
    const cards: GeneratedCard[] = Array.isArray(parsed.cards)
      ? parsed.cards.filter((card: GeneratedCard) =>
          pages.some(page => page.page === card.sourcePage)
        )
      : [];

    if (!cards.length) {
      return await retryOrFail(
        "لم يتم العثور على أسئلة قابلة للتحويل إلى بطاقات في هذه الدفعة.",
        422
      );
    }

    await completeBatchGeneration(batchId, batch.jobId, batch.userId, cards);
    await finalizeMirrorJobIfDone(batch.jobId);

    return NextResponse.json({ batchId, status: "complete", cards });
  } catch (error) {
    console.error("[Mirror] Batch generation failed", error);
    if (error instanceof AiRateLimitError) {
      if (claimed.attemptCount >= maxAttempts) {
        await markMirrorBatchFailedTerminal(
          batchId,
          "تجاوزنا الحد المؤقت لمزوّد الذكاء الاصطناعي."
        );
        await finalizeMirrorJobIfDone(batch.jobId);
        return NextResponse.json({ batchId, status: "failed" });
      }
      await markMirrorBatchRetrying(
        batchId,
        "تجاوزنا الحد المؤقت لمزوّد الذكاء الاصطناعي."
      );
      return NextResponse.json(
        { error: "تجاوزنا الحد المؤقت لمزوّد الذكاء الاصطناعي." },
        { status: 429 }
      );
    }
    return await retryOrFail("تعذر توليد بطاقات لهذه الدفعة.", 502);
  }
}
