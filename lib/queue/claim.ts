// Atomic "claim" for a queue-processed row — a single UPDATE with a status
// precondition in its WHERE clause. Safe under Postgres MVCC with no extra
// locking: two concurrent claims on the same row serialize on the row lock,
// and the loser's WHERE re-evaluates against the now-committed row and
// matches zero rows. This is what makes QStash's at-least-once delivery safe
// to build workers on top of — a duplicate/retried delivery that arrives
// while the first attempt is still in flight (or already finished) always
// finds nothing left to claim.
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import {
  adminMaterialBatches,
  bookChapters,
  bookPages,
  books,
  chapterGenerationJobs,
  extractedQuestions,
  mirrorBatches,
  mirrorImagePages,
  questionFilePages,
} from "../../drizzle/schema";
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
const CLAIMABLE_ADMIN_MATERIAL_BATCH_STATUSES = [
  "pending",
  "failed",
  "retrying",
] as const;
// No "retrying" state for book_pages visual analysis (mismatched-effort
// call is retried by QStash itself; this DB status only tracks
// pending/processing/complete/needs_review/failed) — pending or a
// previously-failed page are both claimable.
const CLAIMABLE_BOOK_PAGE_VISUAL_STATUSES = ["pending", "failed"] as const;

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

// A chapter can sit in "processing" forever when its worker dies mid-run (a
// Railway redeploy/restart kills the in-flight request): QStash's redelivery
// then finds it "already_processing" and stops. After this long it's treated
// as abandoned and claimable again — far beyond a real chapter run.
export const STALE_BOOK_CHAPTER_PROCESSING_MS = 20 * 60 * 1000;

export function staleBookChapterProcessingCutoff(now = Date.now()): Date {
  return new Date(now - STALE_BOOK_CHAPTER_PROCESSING_MS);
}

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
        or(
          inArray(bookChapters.status, CLAIMABLE_BOOK_CHAPTER_STATUSES),
          and(
            eq(bookChapters.status, "processing"),
            lt(bookChapters.lastStartedAt, staleBookChapterProcessingCutoff())
          )
        )
      )
    )
    .returning({
      id: bookChapters.id,
      bookId: bookChapters.bookId,
      attemptCount: bookChapters.attemptCount,
    });
  return row ?? null;
}

export type ClaimedAdminMaterialBatch = {
  id: string;
  materialId: string;
  attemptCount: number;
};

export async function claimAdminMaterialBatch(
  batchId: string
): Promise<ClaimedAdminMaterialBatch | null> {
  const db = requireDb();
  const [row] = await db
    .update(adminMaterialBatches)
    .set({
      status: "processing",
      attemptCount: sql`${adminMaterialBatches.attemptCount} + 1`,
      lastStartedAt: new Date(),
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(adminMaterialBatches.id, batchId),
        inArray(
          adminMaterialBatches.status,
          CLAIMABLE_ADMIN_MATERIAL_BATCH_STATUSES
        )
      )
    )
    .returning({
      id: adminMaterialBatches.id,
      materialId: adminMaterialBatches.materialId,
      attemptCount: adminMaterialBatches.attemptCount,
    });
  return row ?? null;
}

export type ClaimedBookPageVisual = {
  id: string;
  bookId: string;
  attemptCount: number;
};

// Claim-by-specific-id, same as the three claims above — the caller first
// looks up a *candidate* page (lib/db-books.ts's getNextPendingBookPage),
// then claims that exact id here. If a concurrent/duplicate delivery races
// for the same candidate, only one claim succeeds; the loser simply skips
// this page for this invocation rather than doing duplicate work.
export async function claimBookPageVisual(
  pageId: string
): Promise<ClaimedBookPageVisual | null> {
  const db = requireDb();
  const [row] = await db
    .update(bookPages)
    .set({
      visualStatus: "processing",
      attemptCount: sql`${bookPages.attemptCount} + 1`,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bookPages.id, pageId),
        inArray(bookPages.visualStatus, CLAIMABLE_BOOK_PAGE_VISUAL_STATUSES)
      )
    )
    .returning({
      id: bookPages.id,
      bookId: bookPages.bookId,
      attemptCount: bookPages.attemptCount,
    });
  return row ?? null;
}

// No "retrying" state, same reasoning as CLAIMABLE_BOOK_PAGE_VISUAL_STATUSES
// above — QStash itself retries a failed invocation; this DB status only
// tracks pending/processing/complete/failed.
const CLAIMABLE_QUESTION_FILE_PAGE_STATUSES = ["pending", "failed"] as const;
const CLAIMABLE_EXTRACTED_QUESTION_AI_STATUSES = ["pending", "failed"] as const;

export type ClaimedQuestionFilePage = {
  id: string;
  bookId: string;
  pageNumber: number;
  attemptCount: number;
};

export async function claimQuestionFilePage(
  pageId: string
): Promise<ClaimedQuestionFilePage | null> {
  const db = requireDb();
  const [row] = await db
    .update(questionFilePages)
    .set({
      status: "processing",
      attemptCount: sql`${questionFilePages.attemptCount} + 1`,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(questionFilePages.id, pageId),
        inArray(questionFilePages.status, CLAIMABLE_QUESTION_FILE_PAGE_STATUSES)
      )
    )
    .returning({
      id: questionFilePages.id,
      bookId: questionFilePages.bookId,
      pageNumber: questionFilePages.pageNumber,
      attemptCount: questionFilePages.attemptCount,
    });
  return row ?? null;
}

export type ClaimedExtractedQuestion = {
  id: string;
  bookId: string;
  attemptCount: number;
};

export async function claimExtractedQuestion(
  questionId: string
): Promise<ClaimedExtractedQuestion | null> {
  const db = requireDb();
  const [row] = await db
    .update(extractedQuestions)
    .set({
      aiStatus: "processing",
      aiAttemptCount: sql`${extractedQuestions.aiAttemptCount} + 1`,
      aiError: null,
    })
    .where(
      and(
        eq(extractedQuestions.id, questionId),
        inArray(
          extractedQuestions.aiStatus,
          CLAIMABLE_EXTRACTED_QUESTION_AI_STATUSES
        )
      )
    )
    .returning({
      id: extractedQuestions.id,
      bookId: extractedQuestions.bookId,
      attemptCount: extractedQuestions.aiAttemptCount,
    });
  return row ?? null;
}

const CLAIMABLE_MIRROR_IMAGE_PAGE_STATUSES = ["pending", "failed"] as const;

export type ClaimedMirrorImagePage = {
  id: string;
  jobId: string;
  pageNumber: number;
  attemptCount: number;
};

export async function claimMirrorImagePage(
  pageId: string
): Promise<ClaimedMirrorImagePage | null> {
  const db = requireDb();
  const [row] = await db
    .update(mirrorImagePages)
    .set({
      status: "processing",
      attemptCount: sql`${mirrorImagePages.attemptCount} + 1`,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mirrorImagePages.id, pageId),
        inArray(mirrorImagePages.status, CLAIMABLE_MIRROR_IMAGE_PAGE_STATUSES)
      )
    )
    .returning({
      id: mirrorImagePages.id,
      jobId: mirrorImagePages.jobId,
      pageNumber: mirrorImagePages.pageNumber,
      attemptCount: mirrorImagePages.attemptCount,
    });
  return row ?? null;
}

// ── On-demand chapter generation (lib/generation-jobs.ts) ────────────────

// Longer than any single generation run (a chapter's chunked flashcards /
// notes can take several minutes of AI time): a "processing" job older than
// this was abandoned by a killed worker and may be claimed again.
export const STALE_GENERATION_JOB_MS = 20 * 60 * 1000;

export type ClaimedGenerationJob = {
  id: string;
  chapterId: string;
  bookId: string;
  userId: string;
  kind: string;
  rebuild: boolean;
  attemptCount: number;
};

// queued -> processing, atomically. Of two deliveries of the same message
// (or a delivery racing a stale-job recovery), exactly one gets the row;
// the other does no AI work.
export async function claimGenerationJob(
  jobId: string
): Promise<ClaimedGenerationJob | null> {
  const db = requireDb();
  const now = new Date();
  const t = chapterGenerationJobs;
  const [row] = await db
    .update(t)
    .set({
      status: "processing",
      attemptCount: sql`${t.attemptCount} + 1`,
      startedAt: now,
      errorType: null,
      errorMessage: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(t.id, jobId),
        or(
          eq(t.status, "queued"),
          and(
            eq(t.status, "processing"),
            lt(t.startedAt, new Date(now.getTime() - STALE_GENERATION_JOB_MS))
          )
        )
      )
    )
    .returning({
      id: t.id,
      chapterId: t.chapterId,
      bookId: t.bookId,
      userId: t.userId,
      kind: t.kind,
      rebuild: t.rebuild,
      attemptCount: t.attemptCount,
    });
  return row ?? null;
}

// ── كتبي PDF extraction (app/api/books/extract) ──────────────────────────

// One extraction invocation (text pass or one 12-page OCR batch) holds the
// book for at most this long; a lease left by a killed worker expires and
// the next delivery may take over.
export const BOOK_EXTRACTION_LEASE_MS = 10 * 60 * 1000;

// Ownership of the book's current extraction step. Status stays
// "extracting" throughout (the rest of the app reads it); the lease is
// what makes two concurrent deliveries for the same book mutually
// exclusive — the loser sees a live lease and does no OCR/AI work.
export async function claimBookExtraction(bookId: string): Promise<boolean> {
  const db = requireDb();
  const now = new Date();
  const rows = await db
    .update(books)
    .set({
      extractionLeaseUntil: new Date(now.getTime() + BOOK_EXTRACTION_LEASE_MS),
    })
    .where(
      and(
        eq(books.id, bookId),
        eq(books.status, "extracting"),
        or(
          isNull(books.extractionLeaseUntil),
          lt(books.extractionLeaseUntil, now)
        )
      )
    )
    .returning({ id: books.id });
  return rows.length > 0;
}

// Called when the invocation is done (whatever the outcome) so the next,
// self-chained step can claim the book straight away.
export async function releaseBookExtraction(bookId: string): Promise<void> {
  const db = requireDb();
  await db
    .update(books)
    .set({ extractionLeaseUntil: null })
    .where(eq(books.id, bookId));
}
