import {
  boolean,
  index,
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
import type { GeneratedCard } from "../lib/pdf-cards";

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

// Shared SRS rating domain — used by both مِرآة's `cards` (below) and كتبي's
// `bookCards` (see the كتبي section further down). Declared up here (rather
// than only where `bookCards` is defined) since `cards` now needs it too and
// a pgEnum() const must be initialized before any pgTable() that references
// it.
export const bookCardRatingEnum = pgEnum("book_card_rating", [
  "hard",
  "good",
  "easy",
]);

// A saved study session: one uploaded PDF's generated cards, so a user can
// come back to them later without re-uploading the file.
export const decks = pgTable(
  "decks",
  {
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
  },
  table => ({
    userCreatedIdx: index("decks_user_id_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
  })
);

export const cards = pgTable(
  "cards",
  {
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
    // SRS (SM-2-style) scheduling fields — same shape/defaults as كتبي's
    // bookCards below, so lib/srs.ts's applySrsRating() works unmodified for
    // either table. dueAt defaults to now() so a freshly generated card is
    // immediately due, matching bookCards' behavior for a freshly-analyzed
    // chapter's cards.
    easeFactor: real("easeFactor").default(2.5).notNull(),
    intervalDays: integer("intervalDays").default(0).notNull(),
    dueAt: timestamp("dueAt", { withTimezone: true }).defaultNow().notNull(),
    reviewCount: integer("reviewCount").default(0).notNull(),
    lastRating: bookCardRatingEnum("lastRating"),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    deckSourcePageIdx: index("cards_deck_id_source_page_idx").on(
      table.deckId,
      table.sourcePage
    ),
    dueAtIdx: index("cards_due_at_idx").on(table.dueAt),
  })
);

// Append-only SRS rating log for مِرآة cards — mirrors bookReviewEvents
// further down for the same reason documented there (stats/streak queries
// need per-review history, which a mutable current-state column can't give).
export const cardReviewEvents = pgTable(
  "card_review_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cardId: uuid("cardId")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: bookCardRatingEnum("rating").notNull(),
    reviewedAt: timestamp("reviewedAt", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    userReviewedIdx: index("card_review_events_user_id_reviewed_at_idx").on(
      table.userId,
      table.reviewedAt
    ),
  })
);

export type Deck = typeof decks.$inferSelect;
export type InsertDeck = typeof decks.$inferInsert;
export type CardRow = typeof cards.$inferSelect;
export type InsertCardRow = typeof cards.$inferInsert;
export type CardReviewEvent = typeof cardReviewEvents.$inferSelect;

// ── مِرآة generation jobs — a server-side, resumable staging area for the
// upload→extract→OCR→generate pipeline, replacing browser localStorage as
// the source of truth (Item D of the reliability plan). Mirrors كتبي's
// books/bookChapters pattern directly below: a job is planned once (all
// batches "pending"), each batch is driven through its own bounded AI call
// by /api/mirror/generate-batch, and once every batch reaches "complete" the
// job "graduates" — its cards are copied into a real decks/cards row via the
// existing createDeckWithCards() (lib/db.ts), so the established
// library/browse/SRS-review UI needs no changes. mirror_jobs/mirror_batches
// are transient (read once during generation, then not read again after
// graduation) — unlike decks/cards, which stay the durable, permanently
// queried library.

// "partial_failed"/"processing"/"retrying" added for the QStash queue
// migration — enum values are additive-only (Postgres can't cheaply drop or
// rename a value already in use), so "generating"/"analyzing" (see
// bookChapterStatusEnum below) stay as legacy values a row can technically
// still hold, we just stop ever assigning them going forward.
// "extracting"/"failed" added when PDF text-extraction + OCR itself moved to
// a background QStash worker (was previously run synchronously inside
// upload-and-plan, which could exceed Vercel's 60s function limit on
// multi-page scanned files). "extracting" = OCR/extraction in progress;
// "failed" = extraction failed permanently (bad file), distinct from
// "partial_failed" which means generation finished with some batches failed.
export const mirrorJobStatusEnum = pgEnum("mirror_job_status", [
  "pending",
  "complete",
  "partial_failed",
  "extracting",
  "failed",
]);
export const mirrorBatchStatusEnum = pgEnum("mirror_batch_status", [
  "pending",
  "generating",
  "complete",
  "failed",
  "processing",
  "retrying",
]);

export const mirrorJobs = pgTable(
  "mirror_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileName: text("fileName").notNull(),
    fileKey: text("fileKey").notNull(),
    pageCount: integer("pageCount").default(0).notNull(),
    depth: text("depth").default("balanced").notNull(),
    status: mirrorJobStatusEnum("status").default("pending").notNull(),
    // Set once graduateMirrorJob() creates the real deck — null while the job
    // is still generating.
    deckId: uuid("deckId").references(() => decks.id),
    // Extraction/OCR staging (background worker, app/api/mirror/extract) —
    // accumulated page text + which pages still need OCR. Cleared once
    // finalizeMirrorJobExtraction() creates the real mirrorBatches rows,
    // since each batch then owns its own pageTexts slice.
    pageTexts:
      jsonb("pageTexts").$type<
        { page: number; text: string; hasText: boolean }[]
      >(),
    pagesNeedingOcr: jsonb("pagesNeedingOcr").$type<number[]>(),
    ocrFailedPages: jsonb("ocrFailedPages").$type<number[]>(),
    extractionError: text("extractionError"),
    extractionAttemptCount: integer("extractionAttemptCount")
      .default(0)
      .notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    userCreatedIdx: index("mirror_jobs_user_id_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
  })
);

export const mirrorBatches = pgTable(
  "mirror_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("jobId")
      .notNull()
      .references(() => mirrorJobs.id, { onDelete: "cascade" }),
    orderIndex: integer("orderIndex").notNull(),
    startPage: integer("startPage").notNull(),
    endPage: integer("endPage").notNull(),
    status: mirrorBatchStatusEnum("status").default("pending").notNull(),
    // This batch's own slice of extracted (+ OCR'd) page text, stored at
    // plan time — same rationale as bookChapters.pageTexts below: the
    // generate-batch route never has to re-fetch/re-parse the whole PDF.
    pageTexts:
      jsonb("pageTexts").$type<
        { page: number; text: string; hasText: boolean }[]
      >(),
    // Generated cards, stored as a transient blob (not a normalized child
    // table): this data is written once and read at most twice — once for
    // progress display, once to graduate into real `cards` rows — never
    // queried/joined afterward, same one-shot-content pattern as
    // bookChapters.explanationAr/keyPoints below.
    cards: jsonb("cards").$type<GeneratedCard[]>(),
    errorMessage: text("errorMessage"),
    // Queue-worker bookkeeping (QStash migration): attemptCount backs the
    // retry-vs-terminal-failure decision (compared against
    // QUEUE_MAX_ATTEMPTS), the three timestamps are observability-only.
    attemptCount: integer("attemptCount").default(0).notNull(),
    lastStartedAt: timestamp("lastStartedAt", { withTimezone: true }),
    lastCompletedAt: timestamp("lastCompletedAt", { withTimezone: true }),
    lastErrorAt: timestamp("lastErrorAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    jobOrderIdx: index("mirror_batches_job_id_order_index_idx").on(
      table.jobId,
      table.orderIndex
    ),
    statusIdx: index("mirror_batches_status_idx").on(table.status),
  })
);

export type MirrorJob = typeof mirrorJobs.$inferSelect;
export type MirrorBatch = typeof mirrorBatches.$inferSelect;

// ── كتبي (Book Study) — separate feature/data layer from decks/cards above.
// A book is uploaded once, split into chapters (heading-detected or fixed
// page windows — see lib/book-chapters.ts), and each chapter is analyzed by
// its own bounded AI call (never the whole book at once) whose result is
// persisted the instant that one chapter's request completes — this is what
// makes the whole pipeline resumable without any job queue: "pending" chapter
// rows are themselves the resume marker (see lib/book-analysis.ts).

// Book-level status (QStash queue migration) — books had no status column
// at all before this; mirrors mirrorJobs.status's role.
// "extracting"/"failed" mirror mirrorJobStatusEnum's additions above — same
// reasoning, for كتبي's own extraction/OCR background worker.
export const bookStatusEnum = pgEnum("book_status", [
  "pending",
  "processing",
  "complete",
  "partial_failed",
  "extracting",
  "failed",
]);

export const books = pgTable(
  "books",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileName: text("fileName").notNull(),
    fileKey: text("fileKey"),
    pageCount: integer("pageCount").default(0).notNull(),
    // How chapters were determined — "headings" (regex-detected) or
    // "fixed_windows" (fallback fixed-size page chunks) — see detectChapters().
    // Null while status is "extracting": unknown until finalizeBookExtraction()
    // runs detectChapters() against the fully-extracted text.
    chapterDetectionMethod: text("chapterDetectionMethod"),
    status: bookStatusEnum("status").default("pending").notNull(),
    // Extraction/OCR staging (background worker, app/api/books/extract) —
    // same role as mirrorJobs' equivalent columns above. Cleared once
    // finalizeBookExtraction() creates the real bookChapters rows.
    pageTexts:
      jsonb("pageTexts").$type<
        { page: number; text: string; hasText: boolean }[]
      >(),
    pagesNeedingOcr: jsonb("pagesNeedingOcr").$type<number[]>(),
    ocrFailedPages: jsonb("ocrFailedPages").$type<number[]>(),
    extractionError: text("extractionError"),
    extractionAttemptCount: integer("extractionAttemptCount")
      .default(0)
      .notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    userCreatedIdx: index("books_user_id_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
  })
);

// "processing"/"retrying" added for the QStash queue migration — additive
// only, "analyzing" stays a legacy value (see mirrorBatchStatusEnum above
// for the same reasoning).
export const bookChapterStatusEnum = pgEnum("book_chapter_status", [
  "pending",
  "analyzing",
  "complete",
  "failed",
  "processing",
  "retrying",
]);

export const bookChapters = pgTable(
  "book_chapters",
  {
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
    // Queue-worker bookkeeping (QStash migration) — same role as
    // mirrorBatches' equivalent columns above.
    attemptCount: integer("attemptCount").default(0).notNull(),
    lastStartedAt: timestamp("lastStartedAt", { withTimezone: true }),
    lastCompletedAt: timestamp("lastCompletedAt", { withTimezone: true }),
    lastErrorAt: timestamp("lastErrorAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    bookOrderIdx: index("book_chapters_book_id_order_index_idx").on(
      table.bookId,
      table.orderIndex
    ),
    statusIdx: index("book_chapters_status_idx").on(table.status),
  })
);

export const bookTerms = pgTable("book_terms", {
  id: uuid("id").defaultRandom().primaryKey(),
  chapterId: uuid("chapterId")
    .notNull()
    .references(() => bookChapters.id, { onDelete: "cascade" }),
  ar: text("ar").notNull(),
  en: text("en").notNull(),
  pronunciation: text("pronunciation").notNull(),
});

export const bookCards = pgTable(
  "book_cards",
  {
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
  },
  table => ({
    userDueIdx: index("book_cards_user_id_due_at_idx").on(
      table.userId,
      table.dueAt
    ),
    chapterIdx: index("book_cards_chapter_id_idx").on(table.chapterId),
  })
);

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
export const bookReviewEvents = pgTable(
  "book_review_events",
  {
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
  },
  table => ({
    userReviewedIdx: index("book_review_events_user_id_reviewed_at_idx").on(
      table.userId,
      table.reviewedAt
    ),
  })
);

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
