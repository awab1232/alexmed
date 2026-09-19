// Data-access layer for the multimodal question-files pipeline (stage 2:
// per-page image capture/classification, stage 3: per-question AI
// enrichment) — kept separate from lib/db-question-files.ts (which owns the
// original PR16 text-extraction CRUD) since this is purely additive,
// best-effort background enrichment layered on top: a question file's
// books.status stays "complete" the moment text extraction finishes (PR16
// behavior, unchanged), independent of how far these two later stages have
// gotten. Same getDb()-singleton, ownership-agnostic-for-workers conventions
// as lib/db-books.ts.
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import {
  extractedQuestionImageRelations,
  extractedQuestionImages,
  extractedQuestions,
  questionFilePages,
} from "../drizzle/schema";
import { getDb } from "./db";
import { associateImagesWithQuestions } from "./question-file-analysis";

// Ensures a `question_file_pages` row exists for every page 1..pageCount —
// called once, right when stage 2 starts, so getNextPendingQuestionFilePage
// below has a real row to claim for every page, same as bookPages rows all
// being created up front by finalizeBookExtraction.
export async function ensureQuestionFilePages(
  bookId: string,
  pageCount: number
): Promise<void> {
  if (pageCount <= 0) return;
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select({ pageNumber: questionFilePages.pageNumber })
    .from(questionFilePages)
    .where(eq(questionFilePages.bookId, bookId));
  const existingPageNumbers = new Set(existing.map(row => row.pageNumber));

  const missing = [];
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    if (!existingPageNumbers.has(pageNumber)) {
      missing.push({ bookId, pageNumber });
    }
  }
  if (missing.length) {
    await db.insert(questionFilePages).values(missing);
  }
}

export async function getNextPendingQuestionFilePage(bookId: string) {
  const maxAttempts = 3;
  const db = getDb();
  if (!db) return null;
  const [page] = await db
    .select()
    .from(questionFilePages)
    .where(
      and(
        eq(questionFilePages.bookId, bookId),
        inArray(questionFilePages.status, ["pending", "failed"]),
        sql`${questionFilePages.attemptCount} < ${maxAttempts}`
      )
    )
    .orderBy(asc(questionFilePages.pageNumber))
    .limit(1);
  return page ?? null;
}

export async function markQuestionFilePageComplete(
  pageId: string
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(questionFilePages)
    .set({ status: "complete", errorMessage: null, updatedAt: new Date() })
    .where(eq(questionFilePages.id, pageId));
}

export async function markQuestionFilePageFailed(
  pageId: string,
  errorMessage: string
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(questionFilePages)
    .set({ status: "failed", errorMessage, updatedAt: new Date() })
    .where(eq(questionFilePages.id, pageId));
}

export async function insertExtractedQuestionImage(
  bookId: string,
  pageNumber: number,
  storageKey: string,
  isAtPageEnd: boolean
): Promise<{ id: string }> {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .insert(extractedQuestionImages)
    .values({ bookId, pageNumber, storageKey, isAtPageEnd })
    .returning({ id: extractedQuestionImages.id });
  return row;
}

// Runs once, after every page in the book has reached a terminal status
// (complete or permanently failed) — computes the deterministic page-range
// association (lib/question-file-analysis.ts's associateImagesWithQuestions,
// no AI) and persists it. Safe to call more than once (e.g. a retried
// invocation): clears this book's existing relations first rather than
// risking duplicate rows.
export async function associateAndSaveQuestionImages(
  bookId: string
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const images = await db
    .select({
      id: extractedQuestionImages.id,
      pageNumber: extractedQuestionImages.pageNumber,
      isAtPageEnd: extractedQuestionImages.isAtPageEnd,
    })
    .from(extractedQuestionImages)
    .where(eq(extractedQuestionImages.bookId, bookId));

  const questions = await db
    .select({
      id: extractedQuestions.id,
      sourcePage: extractedQuestions.sourcePage,
    })
    .from(extractedQuestions)
    .where(eq(extractedQuestions.bookId, bookId));

  const relations = associateImagesWithQuestions(images, questions);

  const questionIds = questions.map(q => q.id);
  if (questionIds.length) {
    await db
      .delete(extractedQuestionImageRelations)
      .where(inArray(extractedQuestionImageRelations.questionId, questionIds));
  }
  if (relations.length) {
    await db.insert(extractedQuestionImageRelations).values(relations);
  }
}

export async function getNextPendingExtractedQuestion(bookId: string) {
  const maxAttempts = 3;
  const db = getDb();
  if (!db) return null;
  const [question] = await db
    .select()
    .from(extractedQuestions)
    .where(
      and(
        eq(extractedQuestions.bookId, bookId),
        inArray(extractedQuestions.aiStatus, ["pending", "failed"]),
        sql`${extractedQuestions.aiAttemptCount} < ${maxAttempts}`
      )
    )
    .orderBy(asc(extractedQuestions.orderIndex))
    .limit(1);
  return question ?? null;
}

// A question has at most one image in v1 (one page -> one screenshot), but
// this reads through the many-to-many relation table regardless, so a future
// real-cropping pass that links more than one image never needs this query
// to change — it would just start returning more rows.
export async function getExtractedQuestionImages(questionId: string) {
  const db = getDb();
  if (!db) return [];
  return db
    .select({
      id: extractedQuestionImages.id,
      pageNumber: extractedQuestionImages.pageNumber,
      storageKey: extractedQuestionImages.storageKey,
    })
    .from(extractedQuestionImageRelations)
    .innerJoin(
      extractedQuestionImages,
      eq(extractedQuestionImages.id, extractedQuestionImageRelations.imageId)
    )
    .where(eq(extractedQuestionImageRelations.questionId, questionId));
}

export async function saveExtractedQuestionEnrichment(
  questionId: string,
  update: {
    keywords: string[];
    aiExplanationAr: string;
    inferredAnswerIndex: number | null;
    // Whether the source PDF already stated an answer — inferredAnswerIndex
    // is only ever persisted when it did NOT, per the schema comment's
    // "never overrides a real source-stated answer" invariant.
    hasStatedAnswer: boolean;
  }
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(extractedQuestions)
    .set({
      keywords: update.keywords,
      aiExplanationAr: update.aiExplanationAr,
      ...(update.hasStatedAnswer
        ? {}
        : { aiInferredAnswerIndex: update.inferredAnswerIndex }),
      aiStatus: "complete",
      aiError: null,
    })
    .where(eq(extractedQuestions.id, questionId));
}

export async function markExtractedQuestionAiFailed(
  questionId: string,
  errorMessage: string
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(extractedQuestions)
    .set({ aiStatus: "failed", aiError: errorMessage })
    .where(eq(extractedQuestions.id, questionId));
}

export type QuestionFileCoverage = {
  imagePagesTotal: number;
  imagePagesProcessed: number;
  questionsTotal: number;
  questionsAiComplete: number;
  done: boolean;
};

// Mirrors lib/db-books.ts's getBookCoverageReport/computeCoverageDetail
// style — the UI polls this instead of guessing from a single book-level
// status, since stage 2 and stage 3 finish independently and at different
// times for a large file.
export async function getQuestionFileCoverage(
  bookId: string
): Promise<QuestionFileCoverage> {
  const db = getDb();
  if (!db) {
    return {
      imagePagesTotal: 0,
      imagePagesProcessed: 0,
      questionsTotal: 0,
      questionsAiComplete: 0,
      done: true,
    };
  }

  const [pageStats] = await db
    .select({
      total: count(),
      processed: count(
        sql`case when ${questionFilePages.status} in ('complete','failed') then 1 end`
      ),
    })
    .from(questionFilePages)
    .where(eq(questionFilePages.bookId, bookId));

  const [questionStats] = await db
    .select({
      total: count(),
      aiComplete: count(
        sql`case when ${extractedQuestions.aiStatus} in ('complete','failed') then 1 end`
      ),
    })
    .from(extractedQuestions)
    .where(eq(extractedQuestions.bookId, bookId));

  const imagePagesTotal = Number(pageStats?.total ?? 0);
  const imagePagesProcessed = Number(pageStats?.processed ?? 0);
  const questionsTotal = Number(questionStats?.total ?? 0);
  const questionsAiComplete = Number(questionStats?.aiComplete ?? 0);

  return {
    imagePagesTotal,
    imagePagesProcessed,
    questionsTotal,
    questionsAiComplete,
    done:
      imagePagesTotal > 0 &&
      imagePagesProcessed === imagePagesTotal &&
      questionsAiComplete === questionsTotal,
  };
}
