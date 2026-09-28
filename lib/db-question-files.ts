// Data-access layer for PR16's question-file pipeline — deliberately its own
// file (not folded into lib/db-books.ts) since question files are a
// different concept from study books even though they share the books
// table (sourceType distinguishes them): no chapters, no AI analysis, no
// bookCards/bookMcqs — just extractedQuestions. Same conventions as
// lib/db-books.ts: getDb() singleton, ownership-scoped via
// and(eq(id,...), eq(userId,...)).
import { and, asc, count, desc, eq } from "drizzle-orm";
import {
  books,
  extractedQuestionImageRelations,
  extractedQuestionImages,
  extractedQuestions,
  type Book,
} from "../drizzle/schema";
import { getDb, requireDb } from "./db";
import { getQuestionFileCoverage } from "./db-question-file-images";
import type { ExtractedQuestionInput } from "./question-extraction";

// `subjectId` is the student's folder (required by the student upload
// route); a doctor's protected set has none. `executor` lets a caller create
// the book inside its own transaction (lib/db-question-sets.ts).
export async function createQuestionFileShell(
  userId: string,
  input: { fileName: string; fileKey: string; subjectId: string | null },
  executor?: Pick<ReturnType<typeof requireDb>, "insert">
): Promise<Book> {
  const db = executor ?? getDb();
  if (!db) throw new Error("Database not available");

  const [book] = await db
    .insert(books)
    .values({
      userId,
      fileName: input.fileName,
      fileKey: input.fileKey,
      sourceType: "question_file",
      status: "extracting",
      subjectId: input.subjectId,
    })
    .returning();
  return book;
}

// No-ownership-filter lookup for the extraction queue worker — same
// trust-boundary reasoning as lib/db-books.ts's getBookById.
export async function getQuestionFileBookById(
  bookId: string
): Promise<Book | null> {
  const db = getDb();
  if (!db) return null;
  const [book] = await db
    .select()
    .from(books)
    .where(and(eq(books.id, bookId), eq(books.sourceType, "question_file")))
    .limit(1);
  return book ?? null;
}

export async function listQuestionFilesForUser(userId: string) {
  const db = getDb();
  if (!db) return [];

  return db
    .select({
      id: books.id,
      fileName: books.fileName,
      status: books.status,
      extractionError: books.extractionError,
      createdAt: books.createdAt,
      questionCount: count(extractedQuestions.id),
    })
    .from(books)
    .leftJoin(extractedQuestions, eq(extractedQuestions.bookId, books.id))
    .where(and(eq(books.userId, userId), eq(books.sourceType, "question_file")))
    .groupBy(books.id)
    .orderBy(desc(books.createdAt));
}

// The only book fields a question-file viewer ever needs. Never the storage
// key of the uploaded PDF (fileKey), the owner/folder ids, or the
// extraction staging columns (pageTexts etc.) — this projection is what
// every question-file read returns, whoever the viewer is.
const questionFileBookColumns = {
  id: books.id,
  fileName: books.fileName,
  status: books.status,
  extractionError: books.extractionError,
  pageCount: books.pageCount,
  createdAt: books.createdAt,
};

// Likewise for each question: the content the question cards render, not
// the enrichment worker's bookkeeping (aiError, attempt counts).
const questionColumns = {
  id: extractedQuestions.id,
  orderIndex: extractedQuestions.orderIndex,
  questionText: extractedQuestions.questionText,
  options: extractedQuestions.options,
  extractedAnswerIndex: extractedQuestions.extractedAnswerIndex,
  extractedAnswerText: extractedQuestions.extractedAnswerText,
  aiInferredAnswerIndex: extractedQuestions.aiInferredAnswerIndex,
  explanationText: extractedQuestions.explanationText,
  sourcePage: extractedQuestions.sourcePage,
  keywords: extractedQuestions.keywords,
  aiExplanationAr: extractedQuestions.aiExplanationAr,
  aiStatus: extractedQuestions.aiStatus,
  questionTextAr: extractedQuestions.questionTextAr,
  optionsAr: extractedQuestions.optionsAr,
  translationSource: extractedQuestions.translationSource,
};

export type QuestionFileBookView = {
  id: string;
  fileName: string;
  status: Book["status"];
  extractionError: string | null;
  pageCount: number;
  createdAt: Date;
};

type QuestionImageRef = { imageId: string; storageKey: string };

// How a question's image is addressed in the response. The owner's own
// file keeps the existing /api/files/<key> URL; a caller that must not see
// storage keys (a protected set's student) passes its own builder.
export type QuestionImageUrlBuilder = (image: QuestionImageRef) => string;

// Same URL lib/storage.ts's storageGet builds.
const ownerImageUrl: QuestionImageUrlBuilder = image =>
  `/api/files/${image.storageKey.replace(/^\/+/, "")}`;

export async function getQuestionFileForUser(userId: string, bookId: string) {
  const db = getDb();
  if (!db) return null;

  const [book] = await db
    .select(questionFileBookColumns)
    .from(books)
    .where(
      and(
        eq(books.id, bookId),
        eq(books.userId, userId),
        eq(books.sourceType, "question_file")
      )
    )
    .limit(1);
  if (!book) return null;

  return { book, ...(await readQuestionFileContent(bookId, ownerImageUrl)) };
}

// Questions + their images + processing coverage for a question-file book
// the caller has ALREADY been authorized for. Three queries whatever the
// question count (no per-question lookups), and no AI or queue work — a
// read of what the pipeline already produced.
export async function readQuestionFileContent(
  bookId: string,
  imageUrl: QuestionImageUrlBuilder
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const questions = await db
    .select(questionColumns)
    .from(extractedQuestions)
    .where(eq(extractedQuestions.bookId, bookId))
    .orderBy(asc(extractedQuestions.orderIndex));

  // One query for every question's associated image (if any), rather than
  // N+1 per question — a question with no row here just gets undefined,
  // meaning "no image container" in the UI.
  const imagesByQuestionId = new Map<string, string>();
  if (questions.length) {
    const rows = await db
      .select({
        questionId: extractedQuestionImageRelations.questionId,
        imageId: extractedQuestionImages.id,
        storageKey: extractedQuestionImages.storageKey,
      })
      .from(extractedQuestionImageRelations)
      .innerJoin(
        extractedQuestionImages,
        eq(extractedQuestionImages.id, extractedQuestionImageRelations.imageId)
      )
      // extractedQuestionImageRelations has no bookId of its own — the join
      // above (through extractedQuestionImages) is what scopes this to the
      // right book.
      .where(eq(extractedQuestionImages.bookId, bookId));
    for (const row of rows) {
      if (!imagesByQuestionId.has(row.questionId)) {
        imagesByQuestionId.set(row.questionId, imageUrl(row));
      }
    }
  }

  const questionsWithImages = questions.map(question => ({
    ...question,
    imageUrl: imagesByQuestionId.get(question.id) ?? null,
  }));

  const coverage = await getQuestionFileCoverage(bookId);

  return { questions: questionsWithImages, coverage };
}

export type QuestionFileContent = Awaited<
  ReturnType<typeof readQuestionFileContent>
>;
export type QuestionFileQuestion = QuestionFileContent["questions"][number];

export async function saveExtractedQuestions(
  bookId: string,
  questions: ExtractedQuestionInput[]
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  // Reprocessing (retryQuestionFileExtraction) re-runs the whole real
  // extraction from scratch — clearing old rows first avoids duplicating or
  // stale-merging results from a previous, possibly-failed attempt.
  await db
    .delete(extractedQuestions)
    .where(eq(extractedQuestions.bookId, bookId));

  if (!questions.length) return;
  await db.insert(extractedQuestions).values(
    questions.map(q => ({
      bookId,
      orderIndex: q.orderIndex,
      questionText: q.questionText,
      options: q.options,
      extractedAnswerIndex: q.extractedAnswerIndex,
      extractedAnswerText: q.extractedAnswerText,
      explanationText: q.explanationText,
      sourcePage: q.sourcePage,
      // The file's own Arabic (lib/question-extraction.ts). Anything still
      // missing is machine-translated once in stage 3, which then marks the
      // question "machine".
      questionTextAr: q.questionTextAr,
      optionsAr: q.optionsAr,
      translationSource: q.questionTextAr ? "source" : null,
    }))
  );
}

// The resumable OCR staging columns app/api/books/extract-questions uses —
// cleared once the file completes, and on a retry so it starts fresh.
export const CLEARED_OCR_STAGING = {
  pageTexts: null,
  pagesNeedingOcr: null,
  ocrFailedPages: null,
  ocrAttemptCounts: null,
};

export async function markQuestionFileComplete(
  bookId: string,
  pageCount: number
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(books)
    .set({
      status: "complete",
      pageCount,
      // OCR staging (app/api/books/extract-questions) is done with.
      ...CLEARED_OCR_STAGING,
      updatedAt: new Date(),
    })
    .where(eq(books.id, bookId));
}

export async function markQuestionFileFailed(
  bookId: string,
  message: string
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(books)
    .set({ status: "failed", extractionError: message, updatedAt: new Date() })
    .where(eq(books.id, bookId));
}

// Student-initiated retry (mirrors lib/db-books.ts's resetBookExtractionForRetry)
// — ownership-checked here since, unlike the QStash worker path, this is
// reachable directly from a protectedProcedure.
export async function retryQuestionFileExtraction(
  userId: string,
  bookId: string
): Promise<boolean> {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const updated = await db
    .update(books)
    .set({
      status: "extracting",
      extractionError: null,
      ...CLEARED_OCR_STAGING,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(books.id, bookId),
        eq(books.userId, userId),
        eq(books.sourceType, "question_file"),
        // Only a FAILED file: re-extracting a finished one re-runs the paid
        // AI enrichment for every question, outside the upload quota. Part
        // of the same UPDATE, so concurrent retries can't both pass.
        eq(books.status, "failed")
      )
    )
    .returning({ id: books.id });
  return updated.length > 0;
}
