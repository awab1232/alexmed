import {
  aiRetryAfterMs,
  classifyAiError,
  isPermanentAiError,
} from "@/lib/ai/types";
import { logAiEvent, withAiContext } from "@/lib/ai/context";
import {
  completeGenerationJob,
  failGenerationJob,
  getGenerationJob,
  isGenerationKind,
  requeueGenerationJob,
  runChapterGeneration,
} from "@/lib/generation-jobs";
import { claimGenerationJob } from "@/lib/queue/claim";
import { publishMessage } from "@/lib/queue/client";
import { isUserGenerationConcurrencyExceeded } from "@/lib/queue/concurrency";
import { getQueueMaxAttempts } from "@/lib/queue/types";
import { verifyQStashRequest } from "@/lib/queue/verify";
import { NextResponse } from "next/server";

// Long chapters are generated chunk by chunk (several AI calls); this is
// the ceiling for one attempt. Nothing here depends on it being reached —
// a killed attempt leaves a "processing" row that becomes claimable again
// once stale (lib/queue/claim.ts).
export const maxDuration = 300;

// Steady re-check while the student's own slots are all busy — not a
// failure, so it doesn't spend the attempt budget (same as analyze-chapter).
const WAITING_FOR_SLOT_RETRY_DELAY_SECONDS = 20;

// Backoff for a failed attempt with budget left: 10s, 30s, 90s... capped —
// the same shape as the rest of the queue. A rate limit or open circuit
// that says how long to wait is honoured if longer.
function retryDelaySeconds(attemptCount: number, retryAfterMs?: number) {
  const exponential = Math.min(10 * 3 ** Math.max(0, attemptCount - 1), 300);
  const asked = retryAfterMs ? Math.ceil(retryAfterMs / 1000) : 0;
  return Math.min(Math.max(exponential, asked), 600);
}

const FAILED_MESSAGE_AR: Record<string, string> = {
  auth: "خدمة الذكاء الاصطناعي غير متاحة حاليًا. حاول لاحقًا.",
  invalid_request: "تعذر توليد هذا المحتوى لهذا الجزء.",
};
const DEFAULT_FAILED_MESSAGE_AR =
  "تعذر التوليد بعد عدة محاولات، حاول مرة أخرى.";
const RETRYING_MESSAGE_AR =
  "ضغط مؤقت على خدمة الذكاء الاصطناعي، نعيد المحاولة.";

// The on-demand generation worker (lib/generation-jobs.ts): invoked only by
// QStash (signature-verified below), runs exactly one chapter_generation
// job, and owns it through an atomic claim before any AI call.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("upstash-signature");
  const verified = await verifyQStashRequest(rawBody, signature, request);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let jobId: string;
  let claimed: Awaited<ReturnType<typeof claimGenerationJob>>;
  try {
    const body = JSON.parse(rawBody) as { jobId?: string };
    jobId = typeof body.jobId === "string" ? body.jobId : "";
    if (!jobId) {
      return NextResponse.json(
        { error: "معرف المهمة مفقود." },
        { status: 200 }
      );
    }

    const job = await getGenerationJob(jobId);
    if (!job || job.status === "completed" || job.status === "failed") {
      return NextResponse.json({ jobId, status: "skipped" });
    }

    // Per-student backstop, before claiming: one student's big book can't
    // hold every generation slot. Nothing is mutated; the job re-checks.
    if (
      job.status === "queued" &&
      (await isUserGenerationConcurrencyExceeded(job.userId))
    ) {
      await publishMessage(
        { type: "run_chapter_generation", jobId },
        { delay: WAITING_FOR_SLOT_RETRY_DELAY_SECONDS }
      );
      return NextResponse.json({ jobId, status: "throttled" });
    }

    claimed = await claimGenerationJob(jobId);
    if (!claimed) {
      // Another delivery owns it (QStash is at-least-once) — no AI work.
      return NextResponse.json({ jobId, status: "already_processing" });
    }
  } catch (error) {
    // Nothing claimed or mutated yet — safe for QStash to retry.
    console.error("[Generation] job lookup/claim failed", error);
    return NextResponse.json({ error: "تعذر تجهيز المهمة." }, { status: 502 });
  }

  const job = claimed;
  if (!isGenerationKind(job.kind)) {
    await failGenerationJob(job.id, "invalid_request", "نوع مهمة غير معروف.");
    return NextResponse.json({ jobId, status: "failed" });
  }
  const kind = job.kind;
  const startedAt = Date.now();
  const context = {
    operation: `chapter_${kind}`,
    jobId: job.id,
    userId: job.userId,
    bookId: job.bookId,
    chapterId: job.chapterId,
  };

  try {
    await withAiContext(context, () =>
      runChapterGeneration(kind, job.chapterId, { rebuild: job.rebuild })
    );
    await completeGenerationJob(job.id);
    await withAiContext(context, async () =>
      logAiEvent("generation_job", {
        status: "completed",
        attempt: job.attemptCount,
        durationMs: Date.now() - startedAt,
      })
    );
    return NextResponse.json({ jobId, status: "completed" });
  } catch (error) {
    const errorType = classifyAiError(error);
    await withAiContext(context, async () =>
      logAiEvent("generation_job", {
        status: "error",
        errorType,
        attempt: job.attemptCount,
        durationMs: Date.now() - startedAt,
      })
    );
    console.error("[Generation] job failed", job.id, error);

    // Permanent (bad key, rejected request) or out of attempts: fail now —
    // retrying would only repeat the failure and the spend.
    if (
      isPermanentAiError(error) ||
      job.attemptCount >= getQueueMaxAttempts()
    ) {
      await failGenerationJob(
        job.id,
        errorType,
        FAILED_MESSAGE_AR[errorType] ?? DEFAULT_FAILED_MESSAGE_AR
      );
      return NextResponse.json({ jobId, status: "failed", errorType });
    }

    // Transient: back to the queue with backoff. The worker schedules the
    // next attempt itself (and answers 200), so QStash's own retries never
    // stack on top of this one.
    try {
      await requeueGenerationJob(job.id, errorType, RETRYING_MESSAGE_AR);
      await publishMessage(
        { type: "run_chapter_generation", jobId: job.id },
        { delay: retryDelaySeconds(job.attemptCount, aiRetryAfterMs(error)) }
      );
      return NextResponse.json({ jobId, status: "retry_scheduled", errorType });
    } catch (publishError) {
      console.error("[Generation] could not schedule a retry", publishError);
      await failGenerationJob(
        job.id,
        errorType,
        DEFAULT_FAILED_MESSAGE_AR
      ).catch(() => undefined);
      return NextResponse.json({ jobId, status: "failed", errorType });
    }
  }
}
