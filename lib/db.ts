import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { InsertUser, users } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    const client = postgres(process.env.DATABASE_URL, { prepare: false });
    _db = drizzle(client);
  }
  return _db;
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

// TODO: add feature queries here as your schema grows (decks, cards, uploads).
