// Data-access for مِرآة card تضليل/قلم markings (see lib/card-marks.ts) —
// same conventions as lib/db-decks-srs.ts: getDb() singleton, reads return
// safe empty defaults, writes throw when the DB isn't configured, and since
// `cards` has no userId column, card ownership is verified by joining up to
// the owning deck.
import { and, eq } from "drizzle-orm";
import { cardMarks, cards, decks } from "../drizzle/schema";
import { emptyMarks, isEmptyMarks, type CardMarks } from "./card-marks";
import { getDb } from "./db";

export async function getCardMarks(
  userId: string,
  cardId: string
): Promise<CardMarks> {
  const db = getDb();
  if (!db) return emptyMarks();

  const [row] = await db
    .select({ highlights: cardMarks.highlights, strokes: cardMarks.strokes })
    .from(cardMarks)
    .where(and(eq(cardMarks.cardId, cardId), eq(cardMarks.userId, userId)))
    .limit(1);
  if (!row) return emptyMarks();
  // The jsonb columns are typed loosely on purpose (drizzle/schema.ts can't
  // import the union type without a cycle); rows are only ever written
  // through saveCardMarks below, which the router has already validated.
  return row as CardMarks;
}

// Returns false when the card doesn't exist or isn't the user's, so the
// router can answer NOT_FOUND without leaking which one it was.
export async function saveCardMarks(
  userId: string,
  cardId: string,
  marks: CardMarks
): Promise<boolean> {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const [owned] = await db
    .select({ id: cards.id })
    .from(cards)
    .innerJoin(decks, eq(decks.id, cards.deckId))
    .where(and(eq(cards.id, cardId), eq(decks.userId, userId)))
    .limit(1);
  if (!owned) return false;

  if (isEmptyMarks(marks)) {
    await db
      .delete(cardMarks)
      .where(and(eq(cardMarks.cardId, cardId), eq(cardMarks.userId, userId)));
    return true;
  }

  await db
    .insert(cardMarks)
    .values({
      cardId,
      userId,
      highlights: marks.highlights,
      strokes: marks.strokes,
    })
    .onConflictDoUpdate({
      target: [cardMarks.userId, cardMarks.cardId],
      set: {
        highlights: marks.highlights,
        strokes: marks.strokes,
        updatedAt: new Date(),
      },
    });
  return true;
}
