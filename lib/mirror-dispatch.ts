// Shared "start generating this job's batches" step for مِرآة. The PDF path
// (app/api/mirror/extract/route.ts) seeds its window inline after extraction;
// the pasted-text path (lib/trpc/mirrorRouter.ts's submitText) has no
// extraction step and seeds through seedMirrorGeneration below. Both rely on
// app/api/mirror/generate-batch/route.ts to publish one more batch each time
// one finishes, so only this many are ever in flight per job.
import {
  finalizeMirrorJobIfDone,
  markMirrorBatchFailedTerminal,
} from "./db-mirror";
import { publishMessage } from "./queue/client";

// How many generation batches are ever "in flight" (published to QStash but
// not yet complete/failed) for one job at a time.
export const GENERATE_WINDOW_SIZE = 4;

const ENQUEUE_FAILED_MESSAGE = "تعذر بدء توليد البطاقات. أعد المحاولة.";

// Publishes the first GENERATE_WINDOW_SIZE batches. Returns false when the
// queue rejected them — in that case every batch is marked failed (and the
// job rolled up to partial_failed), so the job page shows the usual
// "إعادة المحاولة" button instead of leaving the job silently pending with
// nothing in flight and no way for the student to recover it.
export async function seedMirrorGeneration(
  jobId: string,
  batches: { id: string }[]
): Promise<boolean> {
  try {
    await Promise.all(
      batches.slice(0, GENERATE_WINDOW_SIZE).map(batch =>
        publishMessage({
          type: "generate_mirror_batch",
          batchId: batch.id,
          jobId,
        })
      )
    );
    return true;
  } catch (error) {
    console.error("[Mirror] Failed to enqueue batches", error);
    await Promise.all(
      batches.map(batch =>
        markMirrorBatchFailedTerminal(batch.id, ENQUEUE_FAILED_MESSAGE)
      )
    );
    await finalizeMirrorJobIfDone(jobId);
    return false;
  }
}
