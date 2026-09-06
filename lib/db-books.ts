// Data-access layer for كتبي (Book Study) — deliberately separate from
// lib/db.ts (which stays مِرآة/auth-only), mirroring that file's established
// pattern: getDb() singleton, ownership-scoped queries via and(eq(id,...),
// eq(userId,...)), read functions return safe empty defaults, write
// functions throw when the DB isn't configured.
import { and, asc, count, desc, eq, lte, sql } from "drizzle-orm";
import {
  bookCards,
  bookChapters,
  bookMcqAttempts,
  bookMcqs,
  books,
  bookReviewEvents,
  bookTerms,
  type BookChapter,
} from "../drizzle/schema";
import { getDb } from "./db";
import type { ChapterBoundary } from "./book-chapters";
import { applySrsRating, type SrsRating } from "./srs";

export type PageText = { page: number; text: string };

export async function createBookWithChapters(
  userId: string,
  input: {
    fileName: string;
    fileKey: string;
    pageCount: number;
    method: "headings" | "fixed_windows";
    chapters: ChapterBoundary[];
    pagesByChapter: PageText[][]; // aligned index-for-index with input.chapters
  }
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const [book] = await db
    .insert(books)
    .values({
      userId,
      fileName: input.fileName,
      fileKey: input.fileKey,
      pageCount: input.pageCount,
      chapterDetectionMethod: input.method,
    })
    .returning();

  let chapters: {
    id: string;
    orderIndex: number;
    title: string;
    startPage: number;
    endPage: number;
  }[] = [];
  if (input.chapters.length) {
    const inserted = await db
      .insert(bookChapters)
      .values(
        input.chapters.map((chapter, index) => ({
          bookId: book.id,
          orderIndex: index,
          title: chapter.title,
          startPage: chapter.startPage,
          endPage: chapter.endPage,
          pageTexts: input.pagesByChapter[index] ?? [],
        }))
      )
      .returning({
        id: bookChapters.id,
        orderIndex: bookChapters.orderIndex,
        title: bookChapters.title,
        startPage: bookChapters.startPage,
        endPage: bookChapters.endPage,
      });
    // A multi-row INSERT...RETURNING isn't guaranteed to preserve input
    // order, so sort explicitly by the stored orderIndex rather than relying
    // on it — the client drives its analyze-loop by this order.
    chapters = inserted.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  return { book, chapters };
}

export async function listBooksForUser(userId: string) {
  const db = getDb();
  if (!db) return [];

  return db
    .select({
      id: books.id,
      fileName: books.fileName,
      pageCount: books.pageCount,
      createdAt: books.createdAt,
      chapterCount: count(bookChapters.id),
      completeChapterCount: count(
        sql`case when ${bookChapters.status} = 'complete' then 1 end`
      ),
    })
    .from(books)
    .leftJoin(bookChapters, eq(bookChapters.bookId, books.id))
    .where(eq(books.userId, userId))
    .groupBy(books.id)
    .orderBy(desc(books.createdAt));
}

export async function getBookForUser(userId: string, bookId: string) {
  const db = getDb();
  if (!db) return null;

  const [book] = await db
    .select()
    .from(books)
    .where(and(eq(books.id, bookId), eq(books.userId, userId)))
    .limit(1);
  if (!book) return null;

  const chapters = await db
    .select({
      id: bookChapters.id,
      orderIndex: bookChapters.orderIndex,
      title: bookChapters.title,
      startPage: bookChapters.startPage,
      endPage: bookChapters.endPage,
      status: bookChapters.status,
      errorMessage: bookChapters.errorMessage,
    })
    .from(bookChapters)
    .where(eq(bookChapters.bookId, bookId))
    .orderBy(asc(bookChapters.orderIndex));

  return { book, chapters };
}

export async function deleteBook(userId: string, bookId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const deleted = await db
    .delete(books)
    .where(and(eq(books.id, bookId), eq(books.userId, userId)))
    .returning({ id: books.id });
  return deleted.length > 0;
}

// Ownership check for a chapter-scoped action (the analyze route) — joins
// through to the owning book's userId rather than trusting chapterId alone.
export async function getChapterForUser(
  userId: string,
  chapterId: string
): Promise<BookChapter | null> {
  const db = getDb();
  if (!db) return null;

  const [row] = await db
    .select({ chapter: bookChapters })
    .from(bookChapters)
    .innerJoin(books, eq(books.id, bookChapters.bookId))
    .where(and(eq(bookChapters.id, chapterId), eq(books.userId, userId)))
    .limit(1);

  return row?.chapter ?? null;
}

// No-ownership-filter lookup for a queue worker (no session — the worker
// verifies the QStash signature instead, see lib/queue/verify.ts), same
// trust-boundary reasoning as db-mirror.ts's getMirrorBatchById.
export async function getChapterById(
  chapterId: string
): Promise<(BookChapter & { userId: string }) | null> {
  const db = getDb();
  if (!db) return null;

  const [row] = await db
    .select({ chapter: bookChapters, userId: books.userId })
    .from(bookChapters)
    .innerJoin(books, eq(books.id, bookChapters.bookId))
    .where(eq(bookChapters.id, chapterId))
    .limit(1);

  return row ? { ...row.chapter, userId: row.userId } : null;
}

// Resets a failed chapter back to "pending" for a fresh retry budget — used
// by the retryChapter tRPC mutation.
export async function resetBookChapterForRetry(chapterId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(bookChapters)
    .set({
      status: "pending",
      attemptCount: 0,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(bookChapters.id, chapterId));
}

export async function markBookChapterRetrying(
  chapterId: string,
  errorMessage: string
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(bookChapters)
    .set({
      status: "retrying",
      errorMessage,
      lastErrorAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bookChapters.id, chapterId));
}

export async function markBookChapterFailedTerminal(
  chapterId: string,
  errorMessage: string
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(bookChapters)
    .set({
      status: "failed",
      errorMessage,
      lastErrorAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bookChapters.id, chapterId));
}

// Idempotent finalize: safe to call repeatedly — SELECT ... FOR UPDATE on
// the book row serializes concurrent finalize attempts for the same book, so
// two chapters finishing at nearly the same moment can't race each other.
// Unlike مِرآة, there's no "graduation" step here — chapters' content
// (bookTerms/bookCards/bookMcqs) is already the durable content, this just
// rolls the book's own status up from its chapters' statuses.
export async function finalizeBookIfDone(bookId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  await db.transaction(async tx => {
    const [book] = await tx
      .select()
      .from(books)
      .where(eq(books.id, bookId))
      .for("update");
    if (
      !book ||
      book.status === "complete" ||
      book.status === "partial_failed"
    ) {
      return;
    }

    const chapters = await tx
      .select({ status: bookChapters.status })
      .from(bookChapters)
      .where(eq(bookChapters.bookId, bookId));
    if (!chapters.length) return;

    const stillWorking = chapters.some(
      chapter =>
        chapter.status === "pending" ||
        chapter.status === "processing" ||
        chapter.status === "analyzing" ||
        chapter.status === "retrying"
    );
    if (stillWorking) return;

    const anyFailed = chapters.some(chapter => chapter.status === "failed");
    await tx
      .update(books)
      .set({
        status: anyFailed ? "partial_failed" : "complete",
        updatedAt: new Date(),
      })
      .where(eq(books.id, bookId));
  });
}

export async function setChapterAnalyzing(chapterId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(bookChapters)
    .set({ status: "analyzing", errorMessage: null, updatedAt: new Date() })
    .where(eq(bookChapters.id, chapterId));
}

export async function setChapterFailed(
  chapterId: string,
  errorMessage: string
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(bookChapters)
    .set({ status: "failed", errorMessage, updatedAt: new Date() })
    .where(eq(bookChapters.id, chapterId));
}

export async function completeChapterAnalysis(
  chapterId: string,
  userId: string,
  result: {
    explanationAr: string;
    explanationEn: string;
    keyPoints: string[];
    chapterSummary: string;
    terms: { ar: string; en: string; pronunciation: string }[];
    cards: {
      questionAr: string;
      questionEn: string;
      answerAr: string;
      answerEn: string;
      relatedTermEn: string;
      sourcePage: number;
    }[];
    mcqs: {
      questionEn: string;
      choices: string[];
      correctIndex: number;
      explanationEn: string;
      sourcePage: number;
    }[];
  }
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  // Wrapped in one transaction, with an unconditional delete-before-insert
  // for this chapter's children: this makes the whole function
  // idempotent-by-replacement, so a retry (whether it's this transaction
  // rolling back mid-way, or a chapter left with orphaned rows from before
  // this fix existed) can never leave duplicate terms/cards/mcqs behind.
  // Safe to wipe existing bookCards here because a chapter is only ever
  // re-analyzed from "pending"/"failed" (see app/books/[bookId]/page.tsx's
  // resume filter) — a "complete" chapter, whose cards a user could already
  // be reviewing via SRS, is never re-run through this function.
  await db.transaction(async tx => {
    await tx
      .update(bookChapters)
      .set({
        status: "complete",
        explanationAr: result.explanationAr,
        explanationEn: result.explanationEn,
        keyPoints: result.keyPoints,
        chapterSummary: result.chapterSummary,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(bookChapters.id, chapterId));

    await tx.delete(bookTerms).where(eq(bookTerms.chapterId, chapterId));
    await tx.delete(bookCards).where(eq(bookCards.chapterId, chapterId));
    await tx.delete(bookMcqs).where(eq(bookMcqs.chapterId, chapterId));

    if (result.terms.length) {
      await tx.insert(bookTerms).values(
        result.terms.map(term => ({
          chapterId,
          ar: term.ar,
          en: term.en,
          pronunciation: term.pronunciation,
        }))
      );
    }

    if (result.cards.length) {
      await tx.insert(bookCards).values(
        result.cards.map(card => ({
          chapterId,
          userId,
          questionAr: card.questionAr,
          questionEn: card.questionEn,
          answerAr: card.answerAr,
          answerEn: card.answerEn,
          relatedTermEn: card.relatedTermEn,
          sourcePage: card.sourcePage,
        }))
      );
    }

    if (result.mcqs.length) {
      await tx.insert(bookMcqs).values(
        result.mcqs.map(mcq => ({
          chapterId,
          questionEn: mcq.questionEn,
          choices: mcq.choices,
          correctIndex: mcq.correctIndex,
          explanationEn: mcq.explanationEn,
          sourcePage: mcq.sourcePage,
        }))
      );
    }
  });
}

export async function getChapterContentForUser(
  userId: string,
  chapterId: string
) {
  const db = getDb();
  if (!db) return null;

  const chapter = await getChapterForUser(userId, chapterId);
  if (!chapter) return null;

  const [terms, cards, mcqs] = await Promise.all([
    db.select().from(bookTerms).where(eq(bookTerms.chapterId, chapterId)),
    db.select().from(bookCards).where(eq(bookCards.chapterId, chapterId)),
    db.select().from(bookMcqs).where(eq(bookMcqs.chapterId, chapterId)),
  ]);

  return { chapter, terms, cards, mcqs };
}

// ── SRS review (see lib/srs.ts's applySrsRating for the scheduling formula) ──

export async function getDueCardsForUser(userId: string) {
  const db = getDb();
  if (!db) return [];

  return db
    .select({
      id: bookCards.id,
      questionAr: bookCards.questionAr,
      questionEn: bookCards.questionEn,
      answerAr: bookCards.answerAr,
      answerEn: bookCards.answerEn,
      relatedTermEn: bookCards.relatedTermEn,
      sourcePage: bookCards.sourcePage,
      dueAt: bookCards.dueAt,
      chapterTitle: bookChapters.title,
      bookFileName: books.fileName,
    })
    .from(bookCards)
    .innerJoin(bookChapters, eq(bookChapters.id, bookCards.chapterId))
    .innerJoin(books, eq(books.id, bookChapters.bookId))
    .where(and(eq(bookCards.userId, userId), lte(bookCards.dueAt, new Date())))
    .orderBy(asc(bookCards.dueAt));
}

export async function rateBookCard(
  userId: string,
  cardId: string,
  rating: SrsRating
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const [card] = await db
    .select({
      easeFactor: bookCards.easeFactor,
      intervalDays: bookCards.intervalDays,
      reviewCount: bookCards.reviewCount,
    })
    .from(bookCards)
    .where(and(eq(bookCards.id, cardId), eq(bookCards.userId, userId)))
    .limit(1);
  if (!card) return null;

  const update = applySrsRating(card, rating);

  await db
    .update(bookCards)
    .set({
      easeFactor: update.easeFactor,
      intervalDays: update.intervalDays,
      dueAt: update.dueAt,
      reviewCount: update.reviewCount,
      lastRating: rating,
    })
    .where(eq(bookCards.id, cardId));

  await db.insert(bookReviewEvents).values({ cardId, userId, rating });

  return update;
}

// ── MCQ practice + stats ─────────────────────────────────────────────────

export async function listMcqsForUser(userId: string) {
  const db = getDb();
  if (!db) return [];

  return db
    .select({
      id: bookMcqs.id,
      questionEn: bookMcqs.questionEn,
      choices: bookMcqs.choices,
      correctIndex: bookMcqs.correctIndex,
      explanationEn: bookMcqs.explanationEn,
      sourcePage: bookMcqs.sourcePage,
      chapterTitle: bookChapters.title,
      bookFileName: books.fileName,
    })
    .from(bookMcqs)
    .innerJoin(bookChapters, eq(bookChapters.id, bookMcqs.chapterId))
    .innerJoin(books, eq(books.id, bookChapters.bookId))
    .where(eq(books.userId, userId))
    .orderBy(desc(bookMcqs.createdAt));
}

export async function submitMcqAttemptForUser(
  userId: string,
  mcqId: string,
  selectedIndex: number
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const [mcq] = await db
    .select({
      correctIndex: bookMcqs.correctIndex,
      explanationEn: bookMcqs.explanationEn,
    })
    .from(bookMcqs)
    .innerJoin(bookChapters, eq(bookChapters.id, bookMcqs.chapterId))
    .innerJoin(books, eq(books.id, bookChapters.bookId))
    .where(and(eq(bookMcqs.id, mcqId), eq(books.userId, userId)))
    .limit(1);
  if (!mcq) return null;

  const isCorrect = selectedIndex === mcq.correctIndex;
  await db.insert(bookMcqAttempts).values({
    mcqId,
    userId,
    selectedIndex,
    isCorrect,
  });

  return {
    isCorrect,
    correctIndex: mcq.correctIndex,
    explanationEn: mcq.explanationEn,
  };
}

export async function getBookStatsForUser(userId: string) {
  const db = getDb();
  if (!db) {
    return {
      cardsReviewed: 0,
      accuracyPercent: 0,
      streakDays: 0,
      hoursStudied: 0,
    };
  }

  const [reviewStats] = await db
    .select({ total: count() })
    .from(bookReviewEvents)
    .where(eq(bookReviewEvents.userId, userId));

  const [mcqStats] = await db
    .select({
      total: count(),
      correct: count(sql`case when ${bookMcqAttempts.isCorrect} then 1 end`),
    })
    .from(bookMcqAttempts)
    .where(eq(bookMcqAttempts.userId, userId));

  const totalAnswered = Number(mcqStats?.total ?? 0);
  const totalCorrect = Number(mcqStats?.correct ?? 0);
  const accuracyPercent = totalAnswered
    ? Math.round((totalCorrect / totalAnswered) * 100)
    : 0;

  const activeDayRows = await db
    .select({ day: sql<string>`date(${bookReviewEvents.reviewedAt})` })
    .from(bookReviewEvents)
    .where(eq(bookReviewEvents.userId, userId))
    .groupBy(sql`date(${bookReviewEvents.reviewedAt})`)
    .orderBy(desc(sql`date(${bookReviewEvents.reviewedAt})`));

  const activeDays = new Set(activeDayRows.map(row => row.day));
  let streakDays = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!activeDays.has(key)) break;
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    cardsReviewed: Number(reviewStats?.total ?? 0),
    accuracyPercent,
    streakDays,
    // No dedicated study-session tracking in Phase 1 — approximated as a
    // fixed per-review-event cost rather than adding a new session table.
    hoursStudied:
      Math.round(((Number(reviewStats?.total ?? 0) * 1.5) / 60) * 10) / 10,
  };
}
