import bcrypt from "bcryptjs";
import { and, count, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { cards, decks, InsertUser, users } from "../drizzle/schema";
import type { GeneratedCard } from "./pdf-cards";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
// `max`/`connect_timeout` are connection-pool hygiene per serverless
// instance, not the real concurrency lever — the actual cap on how many
// batches/chapters process at once is QUEUE_GLOBAL_CONCURRENCY (see
// lib/queue/types.ts), enforced via QStash Flow Control and a DB backstop.
export function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    const client = postgres(process.env.DATABASE_URL, {
      prepare: false,
      max: 5,
      connect_timeout: 10,
    });
    _db = drizzle(client);
  }
  return _db;
}

// @auth/drizzle-adapter needs the raw drizzle instance (it runs its own
// queries against the tables we hand it in lib/auth.ts) — getDb() already
// throws/returns null when DATABASE_URL is unset, which is fine since Auth.js
// itself would have nothing to authenticate against in that case either.
export function requireDb() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db;
}

export async function getUserByEmail(email: string) {
  const db = getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: string) {
  const db = getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUser(input: {
  email: string;
  password: string;
  name?: string | null;
}) {
  const db = getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const values: InsertUser = {
    email: input.email.toLowerCase().trim(),
    passwordHash,
    name: input.name ?? null,
  };

  const [created] = await db.insert(users).values(values).returning();
  return created;
}

export async function touchLastSignedIn(id: string) {
  const db = getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, id));
}

export async function createDeckWithCards(
  userId: string,
  input: {
    fileName: string;
    fileKey?: string | null;
    pageCount: number;
    depth: string;
    cards: GeneratedCard[];
  }
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const [deck] = await db
    .insert(decks)
    .values({
      userId,
      fileName: input.fileName,
      fileKey: input.fileKey ?? null,
      pageCount: input.pageCount,
      depth: input.depth,
    })
    .returning();

  if (input.cards.length) {
    await db.insert(cards).values(
      input.cards.map(card => ({
        deckId: deck.id,
        question: card.question,
        questionArabic: card.questionArabic,
        answer: card.answer,
        answerArabic: card.answerArabic,
        explanation: card.explanation,
        explanationArabic: card.explanationArabic,
        keyIdea: card.keyIdea,
        keyIdeaArabic: card.keyIdeaArabic,
        keyword: card.keyword,
        keywordArabic: card.keywordArabic,
        sourcePage: card.sourcePage,
        status: card.status,
        confidence: card.confidence,
      }))
    );
  }

  return deck;
}

export async function listDecksForUser(userId: string) {
  const db = getDb();
  if (!db) return [];

  return db
    .select({
      id: decks.id,
      fileName: decks.fileName,
      pageCount: decks.pageCount,
      depth: decks.depth,
      createdAt: decks.createdAt,
      cardCount: count(cards.id),
    })
    .from(decks)
    .leftJoin(cards, eq(cards.deckId, decks.id))
    .where(eq(decks.userId, userId))
    .groupBy(decks.id)
    .orderBy(desc(decks.createdAt));
}

export async function getDeckWithCards(userId: string, deckId: string) {
  const db = getDb();
  if (!db) return null;

  const [deck] = await db
    .select()
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
    .limit(1);
  if (!deck) return null;

  const deckCards = await db
    .select()
    .from(cards)
    .where(eq(cards.deckId, deckId))
    .orderBy(cards.sourcePage);

  return { deck, cards: deckCards };
}

export async function deleteDeck(userId: string, deckId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const deleted = await db
    .delete(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
    .returning({ id: decks.id });
  return deleted.length > 0;
}
