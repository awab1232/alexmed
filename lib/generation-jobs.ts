// On-demand chapter generation as background jobs (QStash, the same queue
// every other pipeline uses). A student's click creates or re-uses ONE
// chapter_generation_jobs row per (chapter, kind) and publishes one
// message; app/api/books/generation-job claims the row atomically
// (lib/queue/claim.ts's claimGenerationJob) and runs the existing, already
// idempotent generator from lib/book-enrichment.ts. The page polls the row
// (books.generationJobs) instead of holding an HTTP request open for the
// minutes a long chapter can take.
//
//   queued ──claim──> processing ──> completed
//      ^                  │
//      └─ transient error ┴─> failed (permanent error / attempts spent)
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { chapterGenerationJobs } from "../drizzle/schema";
import {
  generateAndSaveChapterFlashcards,
  generateAndSaveChapterMcqs,
  generateAndSaveMedicalNotePages,
  generateAndSaveMindMapSections,
  generateAndSaveVisualInsights,
} from "./book-enrichment";
import { getDb, requireDb } from "./db";
import { validateAndFillChapterMcqs } from "./mcq-validation";
import { STALE_GENERATION_JOB_MS } from "./queue/claim";
import { publishMessage } from "./queue/client";

export const GENERATION_KINDS = [
  "flashcards",
  "mcqs",
  "mindmap",
  "visual_insights",
  "medical_notes",
  "mcq_validation",
] as const;

export type GenerationKind = (typeof GENERATION_KINDS)[number];

export type GenerationStatus = "queued" | "processing" | "completed" | "failed";

export function isGenerationKind(value: string): value is GenerationKind {
  return (GENERATION_KINDS as readonly string[]).includes(value);
}

export type GenerationJobView = {
  id: string;
  chapterId: string;
  kind: GenerationKind;
  status: GenerationStatus;
  errorMessage: string | null;
  attemptCount: number;
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

const viewColumns = {
  id: chapterGenerationJobs.id,
  chapterId: chapterGenerationJobs.chapterId,
  kind: chapterGenerationJobs.kind,
  status: chapterGenerationJobs.status,
  errorMessage: chapterGenerationJobs.errorMessage,
  attemptCount: chapterGenerationJobs.attemptCount,
  queuedAt: chapterGenerationJobs.queuedAt,
  startedAt: chapterGenerationJobs.startedAt,
  completedAt: chapterGenerationJobs.completedAt,
};

function toView(row: {
  id: string;
  chapterId: string;
  kind: string;
  status: string;
  errorMessage: string | null;
  attemptCount: number;
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}): GenerationJobView {
  return {
    ...row,
    kind: row.kind as GenerationKind,
    status: row.status as GenerationStatus,
  };
}

// Creates the job, or re-queues a finished/failed one — but never a second
// active one: while a job for this (chapter, kind) is queued or running,
// this returns it unchanged and publishes nothing, so double clicks, two
// tabs and requests on different replicas all converge on one job. The
// caller has already checked ownership and that the chapter is analysed.
export async function enqueueChapterGeneration(input: {
  chapterId: string;
  bookId: string;
  userId: string;
  kind: GenerationKind;
  rebuild?: boolean;
}): Promise<GenerationJobView> {
  const db = requireDb();
  const t = chapterGenerationJobs;
  const now = new Date();
  const stale = new Date(now.getTime() - STALE_GENERATION_JOB_MS);
  const [row] = await db
    .insert(t)
    .values({
      chapterId: input.chapterId,
      bookId: input.bookId,
      userId: input.userId,
      kind: input.kind,
      rebuild: input.rebuild ?? false,
    })
    .onConflictDoUpdate({
      target: [t.chapterId, t.kind],
      set: {
        status: "queued",
        rebuild: input.rebuild ?? false,
        attemptCount: 0,
        errorType: null,
        errorMessage: null,
        queuedAt: now,
        startedAt: null,
        completedAt: null,
        updatedAt: now,
      },
      // Only a settled job (or one abandoned by a dead worker) is re-queued.
      setWhere: or(
        inArray(t.status, ["completed", "failed"]),
        and(eq(t.status, "processing"), lt(t.startedAt, stale))
      ),
    })
    .returning(viewColumns);

  if (!row) {
    // Already queued or running — hand back that job.
    const [active] = await db
      .select(viewColumns)
      .from(t)
      .where(and(eq(t.chapterId, input.chapterId), eq(t.kind, input.kind)))
      .limit(1);
    return toView(active);
  }

  try {
    await publishMessage({ type: "run_chapter_generation", jobId: row.id });
  } catch (error) {
    // Nothing will ever run it — say so on the row instead of leaving a
    // "queued" job the page would wait on forever.
    await failGenerationJob(
      row.id,
      "enqueue_failed",
      "تعذر إضافة المهمة إلى قائمة الانتظار، حاول مرة أخرى."
    );
    throw error;
  }
  return toView(row);
}

export async function getGenerationJob(jobId: string) {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select({ ...viewColumns, userId: chapterGenerationJobs.userId })
    .from(chapterGenerationJobs)
    .where(eq(chapterGenerationJobs.id, jobId))
    .limit(1);
  return row ?? null;
}

// The page's polling read: every job of this student's book.
export async function listGenerationJobsForBook(
  userId: string,
  bookId: string
): Promise<GenerationJobView[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select(viewColumns)
    .from(chapterGenerationJobs)
    .where(
      and(
        eq(chapterGenerationJobs.bookId, bookId),
        eq(chapterGenerationJobs.userId, userId)
      )
    );
  return rows.map(toView);
}

export async function completeGenerationJob(jobId: string): Promise<void> {
  const db = requireDb();
  const now = new Date();
  await db
    .update(chapterGenerationJobs)
    .set({ status: "completed", completedAt: now, updatedAt: now })
    .where(eq(chapterGenerationJobs.id, jobId));
}

export async function failGenerationJob(
  jobId: string,
  errorType: string,
  errorMessage: string
): Promise<void> {
  const db = requireDb();
  const now = new Date();
  await db
    .update(chapterGenerationJobs)
    .set({
      status: "failed",
      errorType,
      errorMessage,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(chapterGenerationJobs.id, jobId));
}

// Back to "queued" for a later attempt (the worker publishes the delayed
// message itself); the attempt count is kept.
export async function requeueGenerationJob(
  jobId: string,
  errorType: string,
  errorMessage: string
): Promise<void> {
  const db = requireDb();
  await db
    .update(chapterGenerationJobs)
    .set({
      status: "queued",
      errorType,
      errorMessage,
      startedAt: null,
      updatedAt: sql`now()`,
    })
    .where(eq(chapterGenerationJobs.id, jobId));
}

// Runs the existing generator for this kind. Each one is idempotent and
// skips (no AI call) when its output already exists.
export async function runChapterGeneration(
  kind: GenerationKind,
  chapterId: string,
  options: { rebuild: boolean }
): Promise<void> {
  switch (kind) {
    case "flashcards":
      await generateAndSaveChapterFlashcards(chapterId, options);
      return;
    case "mcqs":
      await generateAndSaveChapterMcqs(chapterId, options);
      return;
    case "mindmap":
      await generateAndSaveMindMapSections(chapterId);
      return;
    case "visual_insights":
      await generateAndSaveVisualInsights(chapterId);
      return;
    case "medical_notes":
      await generateAndSaveMedicalNotePages(chapterId);
      return;
    case "mcq_validation":
      await validateAndFillChapterMcqs(chapterId);
      return;
  }
}
