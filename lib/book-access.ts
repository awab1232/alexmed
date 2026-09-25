// 📤 Study Pack access — the ONE authorization rule every book-content read
// goes through: the caller is the book's owner, or has an ACCEPTED share of
// it. Pending / declined / revoked / removed shares grant nothing.
//
// Callers then run the existing, owner-scoped readers (lib/db-books.ts)
// with `access.ownerId`, so owner and recipient see the same viewers over
// the same single copy of every generated artifact — nothing is copied or
// regenerated for a recipient. Personal state (card reviews, answers,
// bookmarks, highlights) is always keyed by the VIEWER's own id.
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  bookCardProgress,
  bookCards,
  bookChapters,
  bookMcqs,
  bookShares,
  books,
  examFocusCards,
  examFocusDecks,
  users,
} from "../drizzle/schema";
import { getDb } from "./db";

export type BookAccess = {
  bookId: string;
  ownerId: string;
  role: "owner" | "shared";
  ownerName: string | null;
  ownerUsername: string | null;
};

type AccessRow = {
  bookId: string;
  ownerId: string;
  shared: boolean;
  ownerName: string | null;
  ownerUsername: string | null;
};

// Pure decision (unit-tested): owner, accepted recipient, or nothing.
export function decideAccess(
  userId: string,
  row: AccessRow | undefined
): BookAccess | null {
  if (!row) return null;
  const base = {
    bookId: row.bookId,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    ownerUsername: row.ownerUsername,
  };
  if (row.ownerId === userId) return { ...base, role: "owner" };
  return row.shared ? { ...base, role: "shared" } : null;
}

// Selected with every access lookup: owner, owner's public handle, and
// whether THIS user holds an accepted share of the book.
const accessColumns = (userId: string) => ({
  bookId: books.id,
  ownerId: books.userId,
  shared: sql<boolean>`exists (
    select 1 from ${bookShares}
    where ${bookShares.bookId} = ${books.id}
      and ${bookShares.recipientId} = ${userId}
      and ${bookShares.status} = 'accepted'
  )`,
  ownerName: users.name,
  ownerUsername: users.username,
});

export async function getBookAccess(
  userId: string,
  bookId: string
): Promise<BookAccess | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select(accessColumns(userId))
    .from(books)
    .innerJoin(users, eq(users.id, books.userId))
    .where(and(eq(books.id, bookId), eq(books.sourceType, "study_book")))
    .limit(1);
  return decideAccess(userId, row);
}

export async function getChapterAccess(
  userId: string,
  chapterId: string
): Promise<(BookAccess & { chapterId: string }) | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select(accessColumns(userId))
    .from(bookChapters)
    .innerJoin(books, eq(books.id, bookChapters.bookId))
    .innerJoin(users, eq(users.id, books.userId))
    .where(eq(bookChapters.id, chapterId))
    .limit(1);
  const access = decideAccess(userId, row);
  return access ? { ...access, chapterId } : null;
}

export async function getBookCardAccess(
  userId: string,
  cardId: string
): Promise<BookAccess | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select(accessColumns(userId))
    .from(bookCards)
    .innerJoin(bookChapters, eq(bookChapters.id, bookCards.chapterId))
    .innerJoin(books, eq(books.id, bookChapters.bookId))
    .innerJoin(users, eq(users.id, books.userId))
    .where(eq(bookCards.id, cardId))
    .limit(1);
  return decideAccess(userId, row);
}

export async function getMcqAccess(
  userId: string,
  mcqId: string
): Promise<BookAccess | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select(accessColumns(userId))
    .from(bookMcqs)
    .innerJoin(bookChapters, eq(bookChapters.id, bookMcqs.chapterId))
    .innerJoin(books, eq(books.id, bookChapters.bookId))
    .innerJoin(users, eq(users.id, books.userId))
    .where(eq(bookMcqs.id, mcqId))
    .limit(1);
  return decideAccess(userId, row);
}

export async function getExamFocusCardAccess(
  userId: string,
  cardId: string
): Promise<BookAccess | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select(accessColumns(userId))
    .from(examFocusCards)
    .innerJoin(examFocusDecks, eq(examFocusDecks.id, examFocusCards.deckId))
    .innerJoin(books, eq(books.id, examFocusDecks.bookId))
    .innerJoin(users, eq(users.id, books.userId))
    .where(eq(examFocusCards.id, cardId))
    .limit(1);
  return decideAccess(userId, row);
}

// The book row as a recipient may see it: no owner-private fields (the
// owner's folder id) — only what describes the shared material.
export function shareSafeBook<T extends { subjectId: string | null }>(
  book: T,
  access: BookAccess
): T {
  if (access.role === "owner") return book;
  return { ...book, subjectId: null };
}

// ── Personal flashcard progress ──────────────────────────────────────────
// book_cards rows carry the OWNER's review state. For a recipient those
// fields are replaced with the recipient's own state (or a fresh card), so
// the owner's progress is never shown to — or changed by — anyone else.
type ProgressFields = {
  id: string;
  userId: string;
  createdAt: Date;
  easeFactor: number;
  intervalDays: number;
  dueAt: Date;
  reviewCount: number;
  lastRating: "again" | "hard" | "good" | "easy" | null;
  fsrsStability: number | null;
  fsrsDifficulty: number | null;
  lastReviewedAt: Date | null;
};

export type OwnProgress = {
  cardId: string;
  intervalDays: number;
  dueAt: Date;
  reviewCount: number;
  lastRating: "again" | "hard" | "good" | "easy" | null;
  fsrsStability: number | null;
  fsrsDifficulty: number | null;
  lastReviewedAt: Date | null;
};

// Pure (unit-tested): swap every owner progress field for the viewer's.
export function applyOwnProgress<T extends ProgressFields>(
  cards: T[],
  viewerId: string,
  mine: OwnProgress[]
): T[] {
  const byCard = new Map(mine.map(row => [row.cardId, row]));
  return cards.map(card => {
    const own = byCard.get(card.id);
    return {
      ...card,
      userId: viewerId,
      easeFactor: 2.5,
      intervalDays: own?.intervalDays ?? 0,
      dueAt: own?.dueAt ?? card.createdAt,
      reviewCount: own?.reviewCount ?? 0,
      lastRating: own?.lastRating ?? null,
      fsrsStability: own?.fsrsStability ?? null,
      fsrsDifficulty: own?.fsrsDifficulty ?? null,
      lastReviewedAt: own?.lastReviewedAt ?? null,
    };
  });
}

export async function personalizeCards<T extends ProgressFields>(
  cards: T[],
  access: BookAccess,
  viewerId: string
): Promise<T[]> {
  if (access.role === "owner" || !cards.length) return cards;
  const db = getDb();
  const mine = db
    ? await db
        .select()
        .from(bookCardProgress)
        .where(
          and(
            eq(bookCardProgress.userId, viewerId),
            inArray(
              bookCardProgress.cardId,
              cards.map(card => card.id)
            )
          )
        )
    : [];
  return applyOwnProgress(cards, viewerId, mine);
}
