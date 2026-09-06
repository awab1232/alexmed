// Atomic "claim" for a queue-processed row — a single UPDATE with a status
// precondition in its WHERE clause. Safe under Postgres MVCC with no extra
// locking: two concurrent claims on the same row serialize on the row lock,
// and the loser's WHERE re-evaluates against the now-committed row and
// matches zero rows. This is what makes QStash's at-least-once delivery safe
// to build workers on top of — a duplicate/retried delivery that arrives
// while the first attempt is still in flight (or already finished) always
// finds nothing left to claim.
import { and, eq, inArray, sql } from "drizzle-orm";
import { bookChapters, mirrorBatches } from "../../drizzle/schema";
import { requireDb } from "../db";

const CLAIMABLE_MIRROR_BATCH_STATUSES = [
  "pending",
  "failed",
  "retrying",
] as const;
const CLAIMABLE_BOOK_CHAPTER_STATUSES = [
  "pending",
  "failed",
  "retrying",
] as const;

export type ClaimedMirrorBatch = {
  id: string;
  jobId: string;
  attemptCount: number;
};

// Returns null when the batch is already processing/complete/terminally
// failed — the caller (the worker route) must ack (return 200) without
// doing any AI work in that case, not retry.
export async function claimMirrorBatch(
  batchId: string
): Promise<ClaimedMirrorBatch | null> {
  const db = requireDb();
  const [row] = await db
    .update(mirrorBatches)
    .set({
      status: "processing",
      attemptCount: sql`${mirrorBatches.attemptCount} + 1`,
      lastStartedAt: new Date(),
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mirrorBatches.id, batchId),
        inArray(mirrorBatches.status, CLAIMABLE_MIRROR_BATCH_STATUSES)
      )
    )
    .returning({
      id: mirrorBatches.id,
      jobId: mirrorBatches.jobId,
      attemptCount: mirrorBatches.attemptCount,
    });
  return row ?? null;
}

export type ClaimedBookChapter = {
  id: string;
  bookId: string;
  attemptCount: number;
};

export async function claimBookChapter(
  chapterId: string
): Promise<ClaimedBookChapter | null> {
  const db = requireDb();
  const [row] = await db
    .update(bookChapters)
    .set({
      status: "processing",
      attemptCount: sql`${bookChapters.attemptCount} + 1`,
      lastStartedAt: new Date(),
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bookChapters.id, chapterId),
        inArray(bookChapters.status, CLAIMABLE_BOOK_CHAPTER_STATUSES)
      )
    )
    .returning({
      id: bookChapters.id,
      bookId: bookChapters.bookId,
      attemptCount: bookChapters.attemptCount,
    });
  return row ?? null;
}
