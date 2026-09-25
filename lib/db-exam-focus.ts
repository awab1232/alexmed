// Data access for 🔥 Exam Focus (lib/exam-focus.ts has the pure pipeline).
// Same conventions as lib/db-books.ts: ownership-scoped reads by userId,
// atomic status-precondition claims for queue work, writes throw when the
// DB isn't configured.
import {
  and,
  asc,
  count,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  or,
  sql,
} from "drizzle-orm";
import {
  bookPages,
  books,
  bookVisualAssets,
  examFocusBookmarks,
  examFocusCards,
  examFocusDecks,
  examFocusUnits,
} from "../drizzle/schema";
import { getDb, requireDb } from "./db";
import {
  buildSearchText,
  type ExamFocusCoverage,
  type ExamFocusFact,
  type ExamFocusUnitPlan,
  type OrderedFact,
} from "./exam-focus";

// A unit left "processing" this long had its worker killed mid-run (e.g. a
// redeploy) — it becomes claimable again and the page's resume call
// re-queues it. Same rule as book chapters (lib/queue/claim.ts).
export const STALE_EXAM_FOCUS_UNIT_MS = 20 * 60 * 1000;
// A pending/retrying unit untouched this long lost its queue message.
export const STALLED_EXAM_FOCUS_UNIT_MS = 3 * 60 * 1000;
// A finalize that died mid-way (it's quick — no AI) is retried after this.
export const STALE_EXAM_FOCUS_FINALIZE_MS = 5 * 60 * 1000;

// ── Book input ───────────────────────────────────────────────────────────
export async function getBookForExamFocus(userId: string, bookId: string) {
  const db = getDb();
  if (!db) return null;
  const [book] = await db
    .select({
      id: books.id,
      fileName: books.fileName,
      pageCount: books.pageCount,
      status: books.status,
      sourceType: books.sourceType,
    })
    .from(books)
    .where(and(eq(books.id, bookId), eq(books.userId, userId)));
  return book ?? null;
}

// Every extracted page of the book plus its figure/table descriptions —
// the full input the units are planned from.
export async function getBookPagesForExamFocus(bookId: string) {
  const db = requireDb();
  const pages = await db
    .select({ page: bookPages.pageNumber, text: bookPages.extractedText })
    .from(bookPages)
    .where(eq(bookPages.bookId, bookId))
    .orderBy(asc(bookPages.pageNumber));
  const visuals = await db
    .select({
      pageNumber: bookPages.pageNumber,
      assetType: bookVisualAssets.assetType,
      descriptionEn: bookVisualAssets.descriptionEn,
    })
    .from(bookVisualAssets)
    .innerJoin(bookPages, eq(bookPages.id, bookVisualAssets.pageId))
    .where(eq(bookVisualAssets.bookId, bookId));
  return {
    pages: pages.map(page => ({ page: page.page, text: page.text ?? "" })),
    visuals,
  };
}

// ── Deck lifecycle ───────────────────────────────────────────────────────
// Creates the deck and all its units in one transaction. created: false
// when a deck already exists for the book (the unique bookId index is the
// race guard), so only the caller that actually created it publishes jobs.
export async function createExamFocusDeck(input: {
  userId: string;
  bookId: string;
  totalPages: number;
  units: ExamFocusUnitPlan[];
}): Promise<{ created: boolean; deckId: string; unitIds: string[] }> {
  const db = requireDb();
  return db.transaction(async tx => {
    const [deck] = await tx
      .insert(examFocusDecks)
      .values({
        userId: input.userId,
        bookId: input.bookId,
        totalPages: input.totalPages,
        totalUnits: input.units.length,
        status: input.units.length ? "processing" : "failed",
        errorMessage: input.units.length
          ? null
          : "لا يوجد نص مقروء في هذا الملف.",
      })
      .onConflictDoNothing({ target: examFocusDecks.bookId })
      .returning({ id: examFocusDecks.id });
    if (!deck) {
      const [existing] = await tx
        .select({ id: examFocusDecks.id })
        .from(examFocusDecks)
        .where(eq(examFocusDecks.bookId, input.bookId));
      return { created: false, deckId: existing?.id ?? "", unitIds: [] };
    }
    const unitIds: string[] = [];
    // Batched so a very large book stays well under Postgres' parameter cap.
    for (let i = 0; i < input.units.length; i += 100) {
      const rows = await tx
        .insert(examFocusUnits)
        .values(
          input.units.slice(i, i + 100).map(unit => ({
            deckId: deck.id,
            unitIndex: unit.unitIndex,
            pageStart: unit.pageStart,
            pageEnd: unit.pageEnd,
            pageTexts: unit.pageTexts,
          }))
        )
        .returning({ id: examFocusUnits.id });
      unitIds.push(...rows.map(row => row.id));
    }
    return { created: true, deckId: deck.id, unitIds };
  });
}

export async function deleteExamFocusDeckForUser(
  userId: string,
  bookId: string
) {
  const db = requireDb();
  await db
    .delete(examFocusDecks)
    .where(
      and(eq(examFocusDecks.bookId, bookId), eq(examFocusDecks.userId, userId))
    );
}

// Deck + per-unit progress (never the page text / facts, which can be
// large) + category counts for the filter chips. `userId` is the deck's
// owner; `viewerId` (owner or an accepted share recipient — the caller
// checks access) scopes the personal bookmark count.
export async function getExamFocusDeckForUser(
  userId: string,
  bookId: string,
  viewerId: string = userId
) {
  const db = getDb();
  if (!db) return null;
  const [deck] = await db
    .select()
    .from(examFocusDecks)
    .where(
      and(eq(examFocusDecks.bookId, bookId), eq(examFocusDecks.userId, userId))
    );
  if (!deck) return null;
  const units = await db
    .select({
      id: examFocusUnits.id,
      unitIndex: examFocusUnits.unitIndex,
      pageStart: examFocusUnits.pageStart,
      pageEnd: examFocusUnits.pageEnd,
      status: examFocusUnits.status,
      attemptCount: examFocusUnits.attemptCount,
      errorMessage: examFocusUnits.errorMessage,
      factCount: sql<number>`coalesce(jsonb_array_length(${examFocusUnits.facts}), 0)`,
    })
    .from(examFocusUnits)
    .where(eq(examFocusUnits.deckId, deck.id))
    .orderBy(asc(examFocusUnits.unitIndex));
  const categoryRows = await db
    .select({ category: examFocusCards.category, n: count() })
    .from(examFocusCards)
    .where(eq(examFocusCards.deckId, deck.id))
    .groupBy(examFocusCards.category);
  const [saved] = await db
    .select({ n: count() })
    .from(examFocusBookmarks)
    .innerJoin(examFocusCards, eq(examFocusCards.id, examFocusBookmarks.cardId))
    .where(
      and(
        eq(examFocusCards.deckId, deck.id),
        eq(examFocusBookmarks.userId, viewerId)
      )
    );
  return {
    deck,
    units: units.map(unit => ({ ...unit, factCount: Number(unit.factCount) })),
    categoryCounts: Object.fromEntries(
      categoryRows.map(row => [row.category, Number(row.n)])
    ) as Record<string, number>,
    bookmarkedCount: Number(saved?.n ?? 0),
  };
}

// ── Unit worker ──────────────────────────────────────────────────────────
export async function getExamFocusUnitForWorker(unitId: string) {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select({
      unit: examFocusUnits,
      userId: examFocusDecks.userId,
      totalUnits: examFocusDecks.totalUnits,
      fileName: books.fileName,
    })
    .from(examFocusUnits)
    .innerJoin(examFocusDecks, eq(examFocusDecks.id, examFocusUnits.deckId))
    .innerJoin(books, eq(books.id, examFocusDecks.bookId))
    .where(eq(examFocusUnits.id, unitId));
  return row ?? null;
}

export async function claimExamFocusUnit(unitId: string) {
  const db = requireDb();
  const staleBefore = new Date(Date.now() - STALE_EXAM_FOCUS_UNIT_MS);
  const [row] = await db
    .update(examFocusUnits)
    .set({
      status: "processing",
      attemptCount: sql`${examFocusUnits.attemptCount} + 1`,
      lastStartedAt: new Date(),
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(examFocusUnits.id, unitId),
        or(
          inArray(examFocusUnits.status, ["pending", "retrying"]),
          and(
            eq(examFocusUnits.status, "processing"),
            lt(examFocusUnits.lastStartedAt, staleBefore)
          )
        )
      )
    )
    .returning({ attemptCount: examFocusUnits.attemptCount });
  return row ?? null;
}

export async function countProcessingExamFocusUnitsForUser(userId: string) {
  const db = getDb();
  if (!db) return 0;
  const staleBefore = new Date(Date.now() - STALE_EXAM_FOCUS_UNIT_MS);
  const [row] = await db
    .select({ n: count() })
    .from(examFocusUnits)
    .innerJoin(examFocusDecks, eq(examFocusDecks.id, examFocusUnits.deckId))
    .where(
      and(
        eq(examFocusDecks.userId, userId),
        eq(examFocusUnits.status, "processing"),
        gte(examFocusUnits.lastStartedAt, staleBefore)
      )
    );
  return Number(row?.n ?? 0);
}

export async function completeExamFocusUnit(
  unitId: string,
  facts: ExamFocusFact[],
  declaredEmptyPages: number[]
) {
  const db = requireDb();
  await db
    .update(examFocusUnits)
    .set({
      status: "complete",
      facts,
      declaredEmptyPages,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(examFocusUnits.id, unitId));
}

export async function markExamFocusUnit(
  unitId: string,
  status: "retrying" | "failed",
  errorMessage: string
) {
  const db = requireDb();
  await db
    .update(examFocusUnits)
    .set({ status, errorMessage, updatedAt: new Date() })
    .where(eq(examFocusUnits.id, unitId));
}

// True once no unit of the deck can still change (all complete/failed).
export async function allExamFocusUnitsSettled(deckId: string) {
  const db = requireDb();
  const [row] = await db
    .select({ n: count() })
    .from(examFocusUnits)
    .where(
      and(
        eq(examFocusUnits.deckId, deckId),
        inArray(examFocusUnits.status, ["pending", "processing", "retrying"])
      )
    );
  return Number(row?.n ?? 0) === 0;
}

// ── Finalize ─────────────────────────────────────────────────────────────
// processing → finalizing, only when every unit is settled; a finalize
// that died mid-way (still "finalizing" after STALE_EXAM_FOCUS_FINALIZE_MS)
// can be claimed again.
export async function claimExamFocusFinalize(deckId: string) {
  const db = requireDb();
  const staleBefore = new Date(Date.now() - STALE_EXAM_FOCUS_FINALIZE_MS);
  const [row] = await db
    .update(examFocusDecks)
    .set({ status: "finalizing", updatedAt: new Date() })
    .where(
      and(
        eq(examFocusDecks.id, deckId),
        or(
          eq(examFocusDecks.status, "processing"),
          and(
            eq(examFocusDecks.status, "finalizing"),
            lt(examFocusDecks.updatedAt, staleBefore)
          )
        ),
        sql`not exists (select 1 from ${examFocusUnits} where ${examFocusUnits.deckId} = ${deckId} and ${examFocusUnits.status} in ('pending', 'processing', 'retrying'))`
      )
    )
    .returning({
      id: examFocusDecks.id,
      totalPages: examFocusDecks.totalPages,
    });
  return row ?? null;
}

export async function releaseExamFocusFinalize(deckId: string) {
  const db = requireDb();
  await db
    .update(examFocusDecks)
    .set({ status: "processing", updatedAt: new Date() })
    .where(
      and(
        eq(examFocusDecks.id, deckId),
        eq(examFocusDecks.status, "finalizing")
      )
    );
}

export async function getExamFocusUnitsForFinalize(deckId: string) {
  const db = requireDb();
  return db
    .select({
      unitIndex: examFocusUnits.unitIndex,
      pageStart: examFocusUnits.pageStart,
      pageEnd: examFocusUnits.pageEnd,
      status: examFocusUnits.status,
      pageTexts: examFocusUnits.pageTexts,
      facts: examFocusUnits.facts,
      declaredEmptyPages: examFocusUnits.declaredEmptyPages,
    })
    .from(examFocusUnits)
    .where(eq(examFocusUnits.deckId, deckId))
    .orderBy(asc(examFocusUnits.unitIndex));
}

// Replaces the deck's cards with the finalized set in one transaction — a
// re-run after a crash never leaves half a deck or duplicate cards.
export async function saveExamFocusDeck(input: {
  deckId: string;
  cards: OrderedFact[];
  coverage: ExamFocusCoverage;
  status: "complete" | "partial_failed" | "failed";
  errorMessage: string | null;
}) {
  const db = requireDb();
  await db.transaction(async tx => {
    await tx
      .delete(examFocusCards)
      .where(eq(examFocusCards.deckId, input.deckId));
    for (let i = 0; i < input.cards.length; i += 200) {
      await tx.insert(examFocusCards).values(
        input.cards.slice(i, i + 200).map((card, offset) => ({
          deckId: input.deckId,
          orderIndex: i + offset,
          category: card.category,
          topic: card.topic,
          title: card.title,
          points: card.points,
          highlightLabel: card.highlightLabel,
          highlightText: card.highlightText,
          flag: card.flag,
          sourcePages: card.sourcePages,
          unitIndex: card.unitIndex,
          searchText: buildSearchText(card),
        }))
      );
    }
    await tx
      .update(examFocusDecks)
      .set({
        status: input.status,
        totalCards: input.cards.length,
        coverage: input.coverage,
        errorMessage: input.errorMessage,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(examFocusDecks.id, input.deckId));
  });
}

// ── Recovery ─────────────────────────────────────────────────────────────
// Student-initiated retry of the units that exhausted their attempts —
// back to pending with a fresh budget; the deck returns to processing.
export async function resetFailedExamFocusUnits(
  userId: string,
  bookId: string
): Promise<{ deckId: string; unitIds: string[] } | null> {
  const db = requireDb();
  const [deck] = await db
    .select({ id: examFocusDecks.id, status: examFocusDecks.status })
    .from(examFocusDecks)
    .where(
      and(eq(examFocusDecks.bookId, bookId), eq(examFocusDecks.userId, userId))
    );
  if (!deck || deck.status === "processing" || deck.status === "finalizing") {
    return null;
  }
  return db.transaction(async tx => {
    const reset = await tx
      .update(examFocusUnits)
      .set({
        status: "pending",
        attemptCount: 0,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(examFocusUnits.deckId, deck.id),
          eq(examFocusUnits.status, "failed")
        )
      )
      .returning({ id: examFocusUnits.id });
    if (!reset.length) return { deckId: deck.id, unitIds: [] };
    await tx
      .update(examFocusDecks)
      .set({ status: "processing", errorMessage: null, updatedAt: new Date() })
      .where(eq(examFocusDecks.id, deck.id));
    return { deckId: deck.id, unitIds: reset.map(row => row.id) };
  });
}

// Pure: which units of an in-progress deck nothing will ever pick up again.
export function pickStalledExamFocusUnits(
  units: {
    id: string;
    status: string;
    updatedAt: Date | null;
    lastStartedAt: Date | null;
  }[],
  now = Date.now()
): string[] {
  return units
    .filter(unit =>
      unit.status === "processing"
        ? !!unit.lastStartedAt &&
          unit.lastStartedAt.getTime() < now - STALE_EXAM_FOCUS_UNIT_MS
        : (unit.status === "pending" || unit.status === "retrying") &&
          !!unit.updatedAt &&
          unit.updatedAt.getTime() < now - STALLED_EXAM_FOCUS_UNIT_MS
    )
    .map(unit => unit.id);
}

export async function findStalledExamFocusWork(userId: string, bookId: string) {
  const db = getDb();
  if (!db) return null;
  const [deck] = await db
    .select({
      id: examFocusDecks.id,
      status: examFocusDecks.status,
      updatedAt: examFocusDecks.updatedAt,
    })
    .from(examFocusDecks)
    .where(
      and(eq(examFocusDecks.bookId, bookId), eq(examFocusDecks.userId, userId))
    );
  if (!deck || (deck.status !== "processing" && deck.status !== "finalizing")) {
    return null;
  }
  const units = await db
    .select({
      id: examFocusUnits.id,
      status: examFocusUnits.status,
      updatedAt: examFocusUnits.updatedAt,
      lastStartedAt: examFocusUnits.lastStartedAt,
    })
    .from(examFocusUnits)
    .where(eq(examFocusUnits.deckId, deck.id));
  const settled = units.every(
    unit => unit.status === "complete" || unit.status === "failed"
  );
  return {
    deckId: deck.id,
    stalledUnitIds: pickStalledExamFocusUnits(units),
    // Every unit settled but finalize never ran (lost message), or a
    // finalize that died mid-way: re-trigger it.
    needsFinalize:
      (deck.status === "processing" && settled) ||
      (deck.status === "finalizing" &&
        deck.updatedAt.getTime() < Date.now() - STALE_EXAM_FOCUS_FINALIZE_MS),
  };
}

// ── Cards (reader) ───────────────────────────────────────────────────────
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, match => `\\${match}`);
}

// Server-side filter + search over the WHOLE persisted deck, paginated —
// the swipe UI fetches pages of this as the student moves forward.
export async function listExamFocusCardsForUser(input: {
  // Deck owner; `viewerId` (defaults to the owner) scopes bookmarks.
  userId: string;
  viewerId?: string;
  bookId: string;
  category?: string;
  bookmarkedOnly?: boolean;
  search?: string;
  offset: number;
  limit: number;
}) {
  const db = getDb();
  if (!db) return { items: [], total: 0 };
  const [deck] = await db
    .select({ id: examFocusDecks.id })
    .from(examFocusDecks)
    .where(
      and(
        eq(examFocusDecks.bookId, input.bookId),
        eq(examFocusDecks.userId, input.userId)
      )
    );
  if (!deck) return { items: [], total: 0 };
  const viewerId = input.viewerId ?? input.userId;
  const bookmarkedByViewer = sql<boolean>`exists (
    select 1 from ${examFocusBookmarks}
    where ${examFocusBookmarks.cardId} = ${examFocusCards.id}
      and ${examFocusBookmarks.userId} = ${viewerId}
  )`;
  const conditions = [eq(examFocusCards.deckId, deck.id)];
  if (input.category) {
    conditions.push(eq(examFocusCards.category, input.category));
  }
  if (input.bookmarkedOnly) {
    conditions.push(bookmarkedByViewer);
  }
  const search = input.search?.trim().toLowerCase();
  if (search) {
    conditions.push(
      ilike(examFocusCards.searchText, `%${escapeLike(search)}%`)
    );
  }
  const where = and(...conditions);
  const [totalRow] = await db
    .select({ n: count() })
    .from(examFocusCards)
    .where(where);
  const items = await db
    .select({
      id: examFocusCards.id,
      orderIndex: examFocusCards.orderIndex,
      category: examFocusCards.category,
      topic: examFocusCards.topic,
      title: examFocusCards.title,
      points: examFocusCards.points,
      highlightLabel: examFocusCards.highlightLabel,
      highlightText: examFocusCards.highlightText,
      flag: examFocusCards.flag,
      sourcePages: examFocusCards.sourcePages,
      bookmarked: bookmarkedByViewer,
    })
    .from(examFocusCards)
    .where(where)
    .orderBy(asc(examFocusCards.orderIndex))
    .offset(input.offset)
    .limit(input.limit);
  return { items, total: Number(totalRow?.n ?? 0) };
}

// A viewer's personal bookmark (the caller has checked access via
// lib/book-access.ts's getExamFocusCardAccess). `isOwner` also mirrors the
// owner's choice onto the legacy examFocusCards.bookmarked column so a
// rollback to pre-sharing code keeps the owner's bookmarks.
export async function setExamFocusCardBookmark(
  viewerId: string,
  cardId: string,
  bookmarked: boolean,
  isOwner: boolean
) {
  const db = requireDb();
  await db.transaction(async tx => {
    if (bookmarked) {
      await tx
        .insert(examFocusBookmarks)
        .values({ userId: viewerId, cardId })
        .onConflictDoNothing();
    } else {
      await tx
        .delete(examFocusBookmarks)
        .where(
          and(
            eq(examFocusBookmarks.userId, viewerId),
            eq(examFocusBookmarks.cardId, cardId)
          )
        );
    }
    if (isOwner) {
      await tx
        .update(examFocusCards)
        .set({ bookmarked })
        .where(eq(examFocusCards.id, cardId));
    }
  });
  return true;
}
