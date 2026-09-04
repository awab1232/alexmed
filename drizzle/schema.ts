import {
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

/**
 * Core user table. Shape is a superset of what @auth/drizzle-adapter expects
 * (id/name/email/emailVerified/image) plus our own fields (passwordHash,
 * role). passwordHash is nullable because a Google-only account never sets
 * one — Credentials sign-in must treat a null passwordHash as "no password
 * set" rather than comparing against it.
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("passwordHash"),
  name: text("name"),
  emailVerified: timestamp("emailVerified", { withTimezone: true }),
  image: text("image"),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// --- @auth/drizzle-adapter tables (Google OAuth account linking) ---
// Session strategy stays "jwt" (see lib/auth.ts) so `sessions` is never
// actually read/written by Auth.js today, but the adapter's TypeScript
// contract and its internal codepaths still reference it, so it must exist
// with this exact shape.

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  account => ({
    compositePk: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  vt => ({
    compositePk: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

export const cardStatusEnum = pgEnum("card_status", [
  "complete",
  "needs_review",
]);
export const cardConfidenceEnum = pgEnum("card_confidence", [
  "high",
  "medium",
  "low",
]);

// A saved study session: one uploaded PDF's generated cards, so a user can
// come back to them later without re-uploading the file.
export const decks = pgTable("decks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fileName: text("fileName").notNull(),
  // Storage key (see lib/storage.ts) — nullable since the underlying object
  // may expire/be removed independently of the deck's saved cards.
  fileKey: text("fileKey"),
  pageCount: integer("pageCount").default(0).notNull(),
  depth: text("depth").default("balanced").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const cards = pgTable("cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  deckId: uuid("deckId")
    .notNull()
    .references(() => decks.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  questionArabic: text("questionArabic").notNull(),
  answer: text("answer").notNull(),
  answerArabic: text("answerArabic").notNull(),
  explanation: text("explanation").notNull(),
  explanationArabic: text("explanationArabic").notNull(),
  keyIdea: text("keyIdea").notNull(),
  keyIdeaArabic: text("keyIdeaArabic").notNull(),
  keyword: text("keyword").notNull(),
  keywordArabic: text("keywordArabic").notNull(),
  sourcePage: integer("sourcePage").notNull(),
  status: cardStatusEnum("status").notNull(),
  confidence: cardConfidenceEnum("confidence").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Deck = typeof decks.$inferSelect;
export type InsertDeck = typeof decks.$inferInsert;
export type CardRow = typeof cards.$inferSelect;
export type InsertCardRow = typeof cards.$inferInsert;
