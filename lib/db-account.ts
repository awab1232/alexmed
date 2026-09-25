// Full account deletion (the student's "حذف حسابي" on /account, and the
// admin dashboard's delete): removes the user row — which cascades to every
// book, deck, card, progress row, chat, share, notification and session —
// and then every stored file the account owned. The privacy policy
// (app/privacy/page.tsx) promises exactly this, so keep them in sync.
import { eq, inArray } from "drizzle-orm";
import {
  bookPages,
  books,
  bookVisualAssets,
  decks,
  extractedQuestionImages,
  mirrorJobs,
  mirrorPageImages,
  users,
} from "../drizzle/schema";
import { requireDb } from "./db";
import { deleteObjects } from "./storage";

// Every storage key the account owns, across every table that holds one
// (uploaded PDFs, rendered pages, visual crops, question images, مِرآة
// pages). Exported for tests.
export async function collectUserStorageKeys(userId: string) {
  const db = requireDb();
  const [ownedBooks, ownedDecks, ownedJobs] = await Promise.all([
    db
      .select({ id: books.id, fileKey: books.fileKey })
      .from(books)
      .where(eq(books.userId, userId)),
    db
      .select({ fileKey: decks.fileKey })
      .from(decks)
      .where(eq(decks.userId, userId)),
    db
      .select({ id: mirrorJobs.id, fileKey: mirrorJobs.fileKey })
      .from(mirrorJobs)
      .where(eq(mirrorJobs.userId, userId)),
  ]);
  const bookIds = ownedBooks.map(book => book.id);
  const jobIds = ownedJobs.map(job => job.id);
  const [pages, visuals, questionImages, mirrorImages] = await Promise.all([
    bookIds.length
      ? db
          .select({ a: bookPages.storageKey, b: bookPages.previewKey })
          .from(bookPages)
          .where(inArray(bookPages.bookId, bookIds))
      : [],
    bookIds.length
      ? db
          .select({
            a: bookVisualAssets.storageKey,
            b: bookVisualAssets.previewKey,
          })
          .from(bookVisualAssets)
          .where(inArray(bookVisualAssets.bookId, bookIds))
      : [],
    bookIds.length
      ? db
          .select({ a: extractedQuestionImages.storageKey })
          .from(extractedQuestionImages)
          .where(inArray(extractedQuestionImages.bookId, bookIds))
      : [],
    jobIds.length
      ? db
          .select({ a: mirrorPageImages.storageKey })
          .from(mirrorPageImages)
          .where(inArray(mirrorPageImages.jobId, jobIds))
      : [],
  ]);
  const keys: (string | null | undefined)[] = [
    ...ownedBooks.map(book => book.fileKey),
    ...ownedDecks.map(deck => deck.fileKey),
    ...ownedJobs.map(job => job.fileKey),
    ...pages.flatMap(row => [row.a, row.b]),
    ...visuals.flatMap(row => [row.a, row.b]),
    ...questionImages.map(row => row.a),
    ...mirrorImages.map(row => row.a),
  ];
  return [
    ...new Set(
      keys.filter((key): key is string => typeof key === "string" && !!key)
    ),
  ];
}

// Returns false when the user doesn't exist. Database first (so the data is
// gone even if storage cleanup hiccups), then files, best-effort.
export async function deleteAccountCompletely(
  userId: string
): Promise<boolean> {
  const db = requireDb();
  const keys = await collectUserStorageKeys(userId);
  const deleted = await db
    .delete(users)
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  if (!deleted.length) return false;
  if (keys.length) {
    try {
      await deleteObjects(keys);
    } catch (error) {
      console.error("[Account] Failed to delete some stored files", {
        userId,
        count: keys.length,
        error,
      });
    }
  }
  return true;
}
