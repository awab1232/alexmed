import { AiRateLimitError } from "@/lib/ai/types";
import {
  completeBatchGeneration,
  finalizeMirrorJobIfDone,
  getMirrorBatchById,
  getNextPendingMirrorBatches,
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
import { isUserConcurrencyExceeded } from "@/lib/queue/concurrency";
import { claimMirrorBatch } from "@/lib/queue/claim";
import { publishMessage } from "@/lib/queue/client";
import { getQueueMaxAttempts } from "@/lib/queue/types";
import { verifyQStashRequest } from "@/lib/queue/verify";
import { NextResponse } from "next/server";

// Vercel Hobby's hard ceiling for a serverless function is 60s regardless of
// this value.
export const maxDuration = 60;

// Same exponential shape as app/api/books/extract/route.ts's OCR retry
// backoff. Real production incident: relying on a non-2xx response + QStash's
// own retry budget (~2 minutes total across all its retries) left a batch
// stuck in "retrying" forever once QStash gave up — attemptCount stayed at 1
// for 10+ minutes with no further delivery ever arriving. Self-publishing our
// own delayed retry (and acking with 200) makes retry timing entirely our
// own responsibility again, decoupled from QStash's delivery budget.
const BATCH_RETRY_BACKOFF_CAP_SECONDS = 90;
function batchRetryBackoffSeconds(attemptNumber: number): number {
  return Math.min(
    BATCH_RETRY_BACKOFF_CAP_SECONDS,
    10 * 3 ** Math.max(0, attemptNumber - 1)
  );
}

// Replenishes the windowed dispatch (see app/api/mirror/extract/route.ts's
// GENERATE_WINDOW_SIZE comment): called once this batch reaches a terminal
// outcome (complete or permanently failed — never on a mid-retry redelivery,
// which still occupies this same slot), publishing the next un-started batch
// so roughly GENERATE_WINDOW_SIZE stay in flight for the job at any time
// instead of every batch being live at once.
async function advanceGenerationWindow(jobId: string) {
  const [next] = await getNextPendingMirrorBatches(jobId, 1);
  if (!next) return;
  try {
    await publishMessage({ type: "generate_mirror_batch", batchId: next.id, jobId });
  } catch (error) {
    // Logged only — this batch just stays "pending" with no in-flight
    // message, same recoverable state a fresh extraction leaves batches in;
    // nothing here has been claimed or mutated for it.
    console.error("[Mirror] Failed to advance generation window", error);
  }
}

// The مِرآة worker (QStash queue migration): generates cards for exactly ONE
// batch and persists the full result before returning. This route is no
// longer callable by the browser — it's invoked only by QStash, verified via
// signature below — see app/mirror/[jobId]/page.tsx, which now just polls
// job/batch status instead of driving generation itself.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("upstash-signature");
  const verified = await verifyQStashRequest(rawBody, signature, request);
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
      return NextResponse.json(
        { error: "معرف الدفعة مفقود." },
        { status: 200 }
      );
    }

    batch = await getMirrorBatchById(batchId);
    if (!batch) {
      // Batch no longer exists (e.g. its job was deleted) — nothing to do.
      return NextResponse.json({ batchId, status: "skipped" });
    }

    // Per-user concurrency backstop, checked BEFORE claiming — so one
    // student's file can't monopolize capacity. The row stays claimable
    // (nothing mutated), QStash redelivers later per its own backoff.
    if (await isUserConcurrencyExceeded(batch.userId, "mirror")) {
      return NextResponse.json(
        { batchId, status: "throttled" },
        { status: 429 }
      );
    }

    claimed = await claimMirrorBatch(batchId);
    if (!claimed) {
      // Already processing (a concurrent/duplicate delivery) or already
      // complete — QStash is at-least-once, so this is expected
      // occasionally, not an error. Ack without doing any AI work.
      return NextResponse.json({ batchId, status: "already_processing" });
    }
    if (!batch.deckId) {
      // Invariant violation: finalizeMirrorJobExtraction always sets
      // mirrorJobs.deckId before any batch is created, so this should never
      // happen — treat as a transient error rather than silently dropping
      // this batch's cards on the floor.
      throw new Error(`Mirror job ${batch.jobId} has no deckId`);
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
    await completeBatchGeneration(batchId, batch.deckId!, []);
    await finalizeMirrorJobIfDone(batch.jobId);
    await advanceGenerationWindow(batch.jobId);
    return NextResponse.json({ batchId, status: "complete", cards: [] });
  }

  const maxAttempts = getQueueMaxAttempts();

  async function retryOrFail(errorMessage: string) {
    if (claimed!.attemptCount >= maxAttempts) {
      await markMirrorBatchFailedTerminal(batchId, errorMessage);
      await finalizeMirrorJobIfDone(batch!.jobId);
      await advanceGenerationWindow(batch!.jobId);
      // Ack — attempts exhausted, no more retries wanted.
      return NextResponse.json({
        batchId,
        status: "failed",
        error: errorMessage,
      });
    }
    await markMirrorBatchRetrying(batchId, errorMessage);
    await publishMessage(
      { type: "generate_mirror_batch", batchId, jobId: batch!.jobId },
      { delay: batchRetryBackoffSeconds(claimed!.attemptCount) }
    );
    // 200, not a failure response — this batch's retry is now entirely our
    // own responsibility via the delayed publish above.
    return NextResponse.json({ batchId, status: "retrying", error: errorMessage });
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
        "لم يتم العثور على أسئلة قابلة للتحويل إلى بطاقات في هذه الدفعة."
      );
    }

    await completeBatchGeneration(batchId, batch.deckId!, cards);
    await finalizeMirrorJobIfDone(batch.jobId);
    await advanceGenerationWindow(batch.jobId);

    return NextResponse.json({ batchId, status: "complete", cards });
  } catch (error) {
    console.error("[Mirror] Batch generation failed", error);
    if (error instanceof AiRateLimitError) {
      return await retryOrFail("تجاوزنا الحد المؤقت لمزوّد الذكاء الاصطناعي.");
    }
    return await retryOrFail("تعذر توليد بطاقات لهذه الدفعة.");
  }
}
