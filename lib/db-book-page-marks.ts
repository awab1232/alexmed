// Data-access for كتبي's PDF-page تضليل/قلم markings (see lib/pdf-marks.ts) —
// same conventions as lib/db-card-marks.ts: getDb() singleton, reads return
// safe empty defaults, writes throw when the DB isn't configured. Ownership
// is verified by joining up to books.userId (bookPageMarks itself carries a
// userId column too, same denormalisation reasoning as bookCards).
import { and, eq } from "drizzle-orm";
import { bookPageMarks } from "../drizzle/schema";
import { getBookAccess } from "./book-access";
import { isEmptyPageMarks, type PdfPageMarks } from "./pdf-marks";
import { getDb } from "./db";

// Loads every page's marks for a book in one query — the reader shows many
// pages at once (a scrollable multi-page view), so fetching per-page would
// be an N+1 query on open. Returns a Map keyed by page number; a page with
// no saved marks simply has no entry (callers fall back to emptyPageMarks()).
export async function listBookPageMarks(
  userId: string,
  bookId: string
): Promise<Map<number, PdfPageMarks>> {
  const db = getDb();
  if (!db) return new Map();

  const rows = await db
    .select({
      pageNumber: bookPageMarks.pageNumber,
      highlights: bookPageMarks.highlights,
      strokes: bookPageMarks.strokes,
    })
    .from(bookPageMarks)
    .where(
      and(eq(bookPageMarks.bookId, bookId), eq(bookPageMarks.userId, userId))
    );

  return new Map(
    rows.map(row => [
      row.pageNumber,
      { highlights: row.highlights, strokes: row.strokes } as PdfPageMarks,
    ])
  );
}

// Returns false when the book doesn't exist or isn't the user's, so the
// router can answer NOT_FOUND without leaking which one it was.
export async function saveBookPageMarks(
  userId: string,
  bookId: string,
  pageNumber: number,
  marks: PdfPageMarks
): Promise<boolean> {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  // Owner or accepted share recipient — the marks row itself is always the
  // caller's own (keyed by userId), never visible to the other side.
  if (!(await getBookAccess(userId, bookId))) return false;

  if (isEmptyPageMarks(marks)) {
    await db
      .delete(bookPageMarks)
      .where(
        and(
          eq(bookPageMarks.bookId, bookId),
          eq(bookPageMarks.userId, userId),
          eq(bookPageMarks.pageNumber, pageNumber)
        )
      );
    return true;
  }

  await db
    .insert(bookPageMarks)
    .values({
      bookId,
      userId,
      pageNumber,
      highlights: marks.highlights,
      strokes: marks.strokes,
    })
    .onConflictDoUpdate({
      target: [
        bookPageMarks.userId,
        bookPageMarks.bookId,
        bookPageMarks.pageNumber,
      ],
      set: {
        highlights: marks.highlights,
        strokes: marks.strokes,
        updatedAt: new Date(),
      },
    });
  return true;
}
