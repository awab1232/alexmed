import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
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

// ── كتبي (Book Study) — separate feature/data layer from decks/cards above.
// A book is uploaded once, split into chapters (heading-detected or fixed
// page windows — see lib/book-chapters.ts), and each chapter is analyzed by
// its own bounded AI call (never the whole book at once) whose result is
// persisted the instant that one chapter's request completes — this is what
// makes the whole pipeline resumable without any job queue: "pending" chapter
// rows are themselves the resume marker (see lib/book-analysis.ts).

export const books = pgTable("books", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fileName: text("fileName").notNull(),
  fileKey: text("fileKey"),
  pageCount: integer("pageCount").default(0).notNull(),
  // How chapters were determined — "headings" (regex-detected) or
  // "fixed_windows" (fallback fixed-size page chunks) — see detectChapters().
  chapterDetectionMethod: text("chapterDetectionMethod").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const bookChapterStatusEnum = pgEnum("book_chapter_status", [
  "pending",
  "analyzing",
  "complete",
  "failed",
]);

export const bookChapters = pgTable("book_chapters", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookId: uuid("bookId")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  orderIndex: integer("orderIndex").notNull(),
  title: text("title").notNull(),
  startPage: integer("startPage").notNull(),
  endPage: integer("endPage").notNull(),
  status: bookChapterStatusEnum("status").default("pending").notNull(),
  // This chapter's own slice of extracted page text, stored at plan time so
  // the analyze route never has to re-fetch/re-parse the whole book PDF.
  pageTexts: jsonb("pageTexts").$type<{ page: number; text: string }[]>(),
  explanationAr: text("explanationAr"),
  explanationEn: text("explanationEn"),
  keyPoints: jsonb("keyPoints").$type<string[]>(),
  chapterSummary: text("chapterSummary"),
  // Last failure reason, when status is "failed" — surfaced with a retry
  // button rather than leaving the chapter stuck silently.
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const bookTerms = pgTable("book_terms", {
  id: uuid("id").defaultRandom().primaryKey(),
  chapterId: uuid("chapterId")
    .notNull()
    .references(() => bookChapters.id, { onDelete: "cascade" }),
  ar: text("ar").notNull(),
  en: text("en").notNull(),
  pronunciation: text("pronunciation").notNull(),
});

export const bookCardRatingEnum = pgEnum("book_card_rating", [
  "hard",
  "good",
  "easy",
]);

export const bookCards = pgTable("book_cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  chapterId: uuid("chapterId")
    .notNull()
    .references(() => bookChapters.id, { onDelete: "cascade" }),
  // Denormalized from chapter->book->userId so "cards due across the whole
  // library" can query this table directly without joining through books.
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  questionAr: text("questionAr").notNull(),
  questionEn: text("questionEn").notNull(),
  answerAr: text("answerAr").notNull(),
  answerEn: text("answerEn").notNull(),
  relatedTermEn: text("relatedTermEn"),
  sourcePage: integer("sourcePage").notNull(),
  // SRS (SM-2-style) scheduling fields — see lib/srs.ts's applySrsRating().
  easeFactor: real("easeFactor").default(2.5).notNull(),
  intervalDays: integer("intervalDays").default(0).notNull(),
  dueAt: timestamp("dueAt", { withTimezone: true }).defaultNow().notNull(),
  reviewCount: integer("reviewCount").default(0).notNull(),
  lastRating: bookCardRatingEnum("lastRating"),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const bookMcqs = pgTable("book_mcqs", {
  id: uuid("id").defaultRandom().primaryKey(),
  chapterId: uuid("chapterId")
    .notNull()
    .references(() => bookChapters.id, { onDelete: "cascade" }),
  questionEn: text("questionEn").notNull(),
  choices: jsonb("choices").$type<string[]>().notNull(),
  correctIndex: integer("correctIndex").notNull(),
  explanationEn: text("explanationEn").notNull(),
  sourcePage: integer("sourcePage").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const bookMcqAttempts = pgTable("book_mcq_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  mcqId: uuid("mcqId")
    .notNull()
    .references(() => bookMcqs.id, { onDelete: "cascade" }),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  selectedIndex: integer("selectedIndex").notNull(),
  isCorrect: boolean("isCorrect").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Append-only SRS rating log — separate from book_cards' own (mutable,
// current-state) SRS fields, because stats (accuracy history, streaks) need
// to query "how many reviews happened on day X", which a field that gets
// overwritten on every rating can never answer.
export const bookReviewEvents = pgTable("book_review_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  cardId: uuid("cardId")
    .notNull()
    .references(() => bookCards.id, { onDelete: "cascade" }),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  rating: bookCardRatingEnum("rating").notNull(),
  reviewedAt: timestamp("reviewedAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Book = typeof books.$inferSelect;
export type InsertBook = typeof books.$inferInsert;
export type BookChapter = typeof bookChapters.$inferSelect;
export type InsertBookChapter = typeof bookChapters.$inferInsert;
export type BookTerm = typeof bookTerms.$inferSelect;
export type BookCard = typeof bookCards.$inferSelect;
export type InsertBookCard = typeof bookCards.$inferInsert;
export type BookMcq = typeof bookMcqs.$inferSelect;
export type BookMcqAttempt = typeof bookMcqAttempts.$inferSelect;
export type BookReviewEvent = typeof bookReviewEvents.$inferSelect;
