// Data-access layer for StudyOS subjects (PR2) — mirrors lib/db-books.ts's
// established conventions: getDb() singleton, ownership-scoped queries via
// and(eq(id,...), eq(userId,...)), read functions return safe empty
// defaults, write functions throw when the DB isn't configured. Deliberately
// its own file (not folded into db-books.ts) since subjects are a
// cross-cutting concept (will eventually group books, and later
// decks/quizzes/errors/notes — see the StudyOS plan's later phases), not
// كتبي-specific.
import { and, count, desc, eq, isNotNull, max } from "drizzle-orm";
import { books, decks, subjects, type Subject } from "../drizzle/schema";
import { getDb } from "./db";

export type SubjectInput = {
  name: string;
  type?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  examDate?: Date | null;
  targetDate?: Date | null;
};

export async function createSubject(
  userId: string,
  input: SubjectInput
): Promise<Subject> {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const [subject] = await db
    .insert(subjects)
    .values({
      userId,
      name: input.name,
      type: (input.type ?? "general") as Subject["type"],
      description: input.description ?? null,
      color: input.color ?? null,
      icon: input.icon ?? null,
      examDate: input.examDate ?? null,
      targetDate: input.targetDate ?? null,
    })
    .returning();
  return subject;
}

// Lists a user's subjects with how many books each one has — cheap enough
// to always compute (a student has a handful of subjects, not hundreds).
export async function listSubjectsForUser(userId: string) {
  const db = getDb();
  if (!db) return [];

  return db
    .select({
      id: subjects.id,
      name: subjects.name,
      type: subjects.type,
      description: subjects.description,
      color: subjects.color,
      icon: subjects.icon,
      examDate: subjects.examDate,
      targetDate: subjects.targetDate,
      createdAt: subjects.createdAt,
      bookCount: count(books.id),
      lastUpdatedAt: max(books.updatedAt),
    })
    .from(subjects)
    .leftJoin(books, eq(books.subjectId, subjects.id))
    .where(eq(subjects.userId, userId))
    .groupBy(subjects.id)
    .orderBy(desc(subjects.createdAt));
}

export async function getSubjectForUser(
  userId: string,
  subjectId: string
): Promise<Subject | null> {
  const db = getDb();
  if (!db) return null;

  const [subject] = await db
    .select()
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
    .limit(1);
  return subject ?? null;
}

export async function updateSubject(
  userId: string,
  subjectId: string,
  input: Partial<SubjectInput>
): Promise<boolean> {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const updated = await db
    .update(subjects)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined
        ? { type: input.type as Subject["type"] }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.examDate !== undefined ? { examDate: input.examDate } : {}),
      ...(input.targetDate !== undefined
        ? { targetDate: input.targetDate }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
    .returning({ id: subjects.id });
  return updated.length > 0;
}

// Deleting a subject never deletes its books (onDelete: "set null" on
// books.subjectId, see schema) — a subject is an organizational label, the
// books are the student's actual content.
export async function deleteSubject(
  userId: string,
  subjectId: string
): Promise<boolean> {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const deleted = await db
    .delete(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
    .returning({ id: subjects.id });
  return deleted.length > 0;
}

// Moves a book into a subject (or out of one, if subjectId is null) — both
// sides' ownership are checked so a student can never attach their book to
// someone else's subject id (or vice versa). Returns false if either the
// book or the target subject (when not null) doesn't belong to this user.
export async function assignBookToSubject(
  userId: string,
  bookId: string,
  subjectId: string | null
): Promise<boolean> {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  if (subjectId) {
    const owned = await getSubjectForUser(userId, subjectId);
    if (!owned) return false;
  }

  const updated = await db
    .update(books)
    .set({ subjectId, updatedAt: new Date() })
    .where(and(eq(books.id, bookId), eq(books.userId, userId)))
    .returning({ id: books.id });
  return updated.length > 0;
}

// Separate query rather than a second leftJoin bolted onto
// listSubjectsForUser above — joining both books and decks off the same
// subjects row in one query would cross-multiply each subject's book rows
// against its deck rows before COUNT ever saw them, inflating both counts.
// Returns only subjects that actually have at least one deck, so callers
// merge it as a sparse lookup rather than assuming every subject id exists.
export async function listDeckCountsBySubjectForUser(
  userId: string
): Promise<Map<string, number>> {
  const db = getDb();
  if (!db) return new Map();

  const rows = await db
    .select({ subjectId: decks.subjectId, deckCount: count(decks.id) })
    .from(decks)
    .where(and(eq(decks.userId, userId), isNotNull(decks.subjectId)))
    .groupBy(decks.subjectId);
  return new Map(rows.map(row => [row.subjectId as string, row.deckCount]));
}

// Moves a مِرآة deck (ملف أسئلة) into a subject/folder — same ownership
// checks and "unassign rather than delete" semantics as assignBookToSubject
// above, so a book and a deck can live in the same folder without either
// system needing to know about the other's table.
export async function assignDeckToSubject(
  userId: string,
  deckId: string,
  subjectId: string | null
): Promise<boolean> {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  if (subjectId) {
    const owned = await getSubjectForUser(userId, subjectId);
    if (!owned) return false;
  }

  const updated = await db
    .update(decks)
    .set({ subjectId, updatedAt: new Date() })
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
    .returning({ id: decks.id });
  return updated.length > 0;
}
