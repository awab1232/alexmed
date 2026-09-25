// Retrieval for the study chat (المحادثة مع المصادر, PR5 — the study sheets'
// "المساعد الذكي" and the chapter page's "اسألني" tab). Keyword/full-text
// search (Postgres to_tsvector / to_tsquery), not embedding search: no
// pgvector extension or confirmed production embedding model exists yet.
// "simple" config is used (not "arabic", which Postgres doesn't ship) so
// Arabic and English text both just get whitespace/punctuation tokenization
// — no stemming, which the OR + prefix query below compensates for.
import { sql } from "drizzle-orm";
import { getDb } from "./db";

export type RetrievedChunk = {
  bookId: string;
  bookFileName: string;
  chapterId: string | null;
  pageNumber: number;
  text: string;
};

export type ChatScope = "page" | "chapter" | "book" | "subject";

const SEARCH_LIMIT = 6;
// Keeps a single invokeLLM call's prompt bounded regardless of how many/how
// large the matched pages are — chunks are added in rank order until the
// budget is hit, never mid-chunk truncated (a half-sentence of "evidence"
// is worse than one fewer whole page of it).
const MAX_CONTEXT_CHARS = 12_000;
// The file/chapter overview sent alongside (or instead of) matched pages.
const MAX_OVERVIEW_CHARS = 6_000;

// Words too common to help ranking (Arabic + English question words,
// particles and fillers students type).
const STOPWORDS = new Set([
  "في",
  "من",
  "على",
  "إلى",
  "الى",
  "عن",
  "مع",
  "هو",
  "هي",
  "هذا",
  "هذه",
  "ذلك",
  "تلك",
  "ما",
  "ماذا",
  "لماذا",
  "ليش",
  "شو",
  "كيف",
  "متى",
  "أين",
  "وين",
  "هل",
  "أو",
  "او",
  "ثم",
  "كل",
  "بعض",
  "أي",
  "اي",
  "لا",
  "لم",
  "لن",
  "قد",
  "كان",
  "كانت",
  "يكون",
  "التي",
  "الذي",
  "الذين",
  "اللي",
  "عند",
  "بين",
  "بعد",
  "قبل",
  "حتى",
  "لو",
  "إذا",
  "اذا",
  "انا",
  "أنا",
  "انت",
  "أنت",
  "نحن",
  "هم",
  "لي",
  "لك",
  "اشرح",
  "اشرحلي",
  "وضح",
  "ممكن",
  "يعني",
  "the",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "for",
  "and",
  "or",
  "is",
  "are",
  "was",
  "were",
  "be",
  "what",
  "why",
  "how",
  "when",
  "where",
  "which",
  "who",
  "does",
  "do",
  "did",
  "can",
  "could",
  "with",
  "about",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "me",
  "explain",
  "please",
]);

// Postgres tsquery that matches pages containing ANY meaningful word of the
// question (OR), longer words also as prefixes ("cardiac:*" matches
// "cardiac", "cardiology"…); ts_rank still puts pages matching more words
// first. The old plainto_tsquery required EVERY word on one page, so most
// natural questions retrieved nothing. Terms are letters/digits only, so no
// tsquery syntax can be injected. Null when the question has no usable
// words.
export function buildSearchQuery(question: string): string | null {
  const words =
    question
      .toLowerCase()
      .replace(/\p{M}/gu, "")
      .match(/[\p{L}\p{N}]+/gu) ?? [];
  const terms = [
    ...new Set(words.filter(word => word.length >= 2 && !STOPWORDS.has(word))),
  ].slice(0, 12);
  if (!terms.length) return null;
  return terms.map(term => (term.length >= 4 ? `${term}:*` : term)).join(" | ");
}

export function capChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const kept: RetrievedChunk[] = [];
  let total = 0;
  for (const chunk of chunks) {
    if (kept.length && total + chunk.text.length > MAX_CONTEXT_CHARS) break;
    kept.push(chunk);
    total += chunk.text.length;
  }
  return kept;
}

// ⚠️ getPageChunk/search*Pages/getScopeOverview below take a bare id and do
// NOT check access themselves — they trust the caller already verified it.
// Currently safe: the study chat (lib/study-chat.ts) is the only caller,
// and it only ever passes ids sourced from a chatSessions row that
// getOrCreateChatSession() already checked (owner or accepted share)
// before creating. A future direct caller MUST do its own check first.

type ChunkRow = {
  bookId: string;
  bookFileName: string;
  chapterId: string | null;
  pageNumber: number;
  text: string | null;
};

function keepText(rows: ChunkRow[]): RetrievedChunk[] {
  return capChunks(
    rows.filter((row): row is ChunkRow & { text: string } => !!row.text)
  );
}

// scope="page" never searches — the one page IS the context, in full.
export async function getPageChunk(pageId: string): Promise<RetrievedChunk[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db.execute<ChunkRow>(sql`
    select bp."bookId" as "bookId",
           b."fileName" as "bookFileName",
           bp."chapterId" as "chapterId",
           bp."pageNumber" as "pageNumber",
           bp."extractedText" as "text"
    from book_pages bp
    inner join books b on b.id = bp."bookId"
    where bp.id = ${pageId}
    limit 1
  `);
  const row = rows[0];
  if (!row || !row.text) return [];
  return [{ ...row, text: row.text }];
}

// scope="chapter" — ranked search within just this chapter's own pages, so
// a long chapter still gets a bounded, relevant context instead of every
// page dumped in regardless of relevance to the actual question.
export async function searchChapterPages(
  chapterId: string,
  question: string,
  limit = SEARCH_LIMIT
): Promise<RetrievedChunk[]> {
  const db = getDb();
  const query = buildSearchQuery(question);
  if (!db || !query) return [];

  const rows = await db.execute<ChunkRow>(sql`
    select bp."bookId" as "bookId",
           b."fileName" as "bookFileName",
           bp."chapterId" as "chapterId",
           bp."pageNumber" as "pageNumber",
           bp."extractedText" as "text"
    from book_pages bp
    inner join books b on b.id = bp."bookId"
    where bp."chapterId" = ${chapterId}
      and bp."extractedText" is not null
      and to_tsvector('simple', bp."extractedText") @@ to_tsquery('simple', ${query})
    order by ts_rank(to_tsvector('simple', bp."extractedText"), to_tsquery('simple', ${query})) desc
    limit ${limit}
  `);
  return keepText(rows);
}

// scope="book" — same idea across the whole book.
export async function searchBookPages(
  bookId: string,
  question: string,
  limit = SEARCH_LIMIT
): Promise<RetrievedChunk[]> {
  const db = getDb();
  const query = buildSearchQuery(question);
  if (!db || !query) return [];

  const rows = await db.execute<ChunkRow>(sql`
    select bp."bookId" as "bookId",
           b."fileName" as "bookFileName",
           bp."chapterId" as "chapterId",
           bp."pageNumber" as "pageNumber",
           bp."extractedText" as "text"
    from book_pages bp
    inner join books b on b.id = bp."bookId"
    where bp."bookId" = ${bookId}
      and bp."extractedText" is not null
      and to_tsvector('simple', bp."extractedText") @@ to_tsquery('simple', ${query})
    order by ts_rank(to_tsvector('simple', bp."extractedText"), to_tsquery('simple', ${query})) desc
    limit ${limit}
  `);
  return keepText(rows);
}

// scope="subject" — across every book that belongs to the subject. Never
// mixes in another subject's books (the WHERE clause), so file excerpts
// stay from the right folder even though the answer itself may add
// general knowledge.
export async function searchSubjectPages(
  subjectId: string,
  question: string,
  limit = SEARCH_LIMIT
): Promise<RetrievedChunk[]> {
  const db = getDb();
  const query = buildSearchQuery(question);
  if (!db || !query) return [];

  const rows = await db.execute<ChunkRow>(sql`
    select bp."bookId" as "bookId",
           b."fileName" as "bookFileName",
           bp."chapterId" as "chapterId",
           bp."pageNumber" as "pageNumber",
           bp."extractedText" as "text"
    from book_pages bp
    inner join books b on b.id = bp."bookId"
    where b."subjectId" = ${subjectId}
      and bp."extractedText" is not null
      and to_tsvector('simple', bp."extractedText") @@ to_tsquery('simple', ${query})
    order by ts_rank(to_tsvector('simple', bp."extractedText"), to_tsquery('simple', ${query})) desc
    limit ${limit}
  `);
  return keepText(rows);
}

function capText(text: string, max = MAX_OVERVIEW_CHARS): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// What the chat always knows about its scope even when no page matched the
// question: the chapter's own summary/explanation/key points, or the book's
// chapter-by-chapter summaries, or the subject's file list. Lets "summarise
// this chapter" / "what's this file about?" work, and gives the model the
// topic for questions whose words simply aren't on any page.
export async function getScopeOverview(session: {
  scope: ChatScope;
  pageId: string | null;
  chapterId: string | null;
  bookId: string | null;
  subjectId: string | null;
}): Promise<string> {
  const db = getDb();
  if (!db) return "";

  if (session.scope === "chapter" && session.chapterId) {
    const rows = await db.execute<{
      title: string;
      fileName: string;
      startPage: number;
      endPage: number;
      chapterSummary: string | null;
      explanationEn: string | null;
      explanationAr: string | null;
      keyPoints: string[] | null;
    }>(sql`
      select c.title, b."fileName" as "fileName", c."startPage" as "startPage",
             c."endPage" as "endPage", c."chapterSummary" as "chapterSummary",
             c."explanationEn" as "explanationEn", c."explanationAr" as "explanationAr",
             c."keyPoints" as "keyPoints"
      from book_chapters c
      inner join books b on b.id = c."bookId"
      where c.id = ${session.chapterId}
      limit 1
    `);
    const chapter = rows[0];
    if (!chapter) return "";
    return capText(
      [
        `File: ${chapter.fileName} — part "${chapter.title}" (pages ${chapter.startPage}-${chapter.endPage})`,
        chapter.chapterSummary && `Summary: ${chapter.chapterSummary}`,
        chapter.explanationEn && `Explanation: ${chapter.explanationEn}`,
        !chapter.explanationEn &&
          chapter.explanationAr &&
          `الشرح: ${chapter.explanationAr}`,
        chapter.keyPoints?.length &&
          `Key points:\n- ${chapter.keyPoints.join("\n- ")}`,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  if (
    (session.scope === "book" || session.scope === "page") &&
    (session.bookId || session.pageId)
  ) {
    const bookFilter = session.bookId
      ? sql`b.id = ${session.bookId}`
      : sql`b.id = (select "bookId" from book_pages where id = ${session.pageId})`;
    const rows = await db.execute<{
      fileName: string;
      pageCount: number;
      title: string | null;
      startPage: number | null;
      endPage: number | null;
      summary: string | null;
    }>(sql`
      select b."fileName" as "fileName", b."pageCount" as "pageCount",
             c.title, c."startPage" as "startPage", c."endPage" as "endPage",
             coalesce(c."chapterSummary", left(c."explanationEn", 600)) as summary
      from books b
      left join book_chapters c on c."bookId" = b.id and c.status = 'complete'
      where ${bookFilter}
      order by c."orderIndex" asc
    `);
    if (!rows.length) return "";
    const header = `File: ${rows[0].fileName} (${rows[0].pageCount} pages)`;
    if (session.scope === "page") return header;
    const parts = rows
      .filter(row => row.title)
      .map(
        row =>
          `- ${row.title} (pages ${row.startPage}-${row.endPage})${row.summary ? `: ${row.summary}` : ""}`
      );
    return capText(
      [header, parts.length ? `Parts:\n${parts.join("\n")}` : ""]
        .filter(Boolean)
        .join("\n")
    );
  }

  if (session.scope === "subject" && session.subjectId) {
    const rows = await db.execute<{
      name: string;
      fileName: string | null;
    }>(sql`
      select s.name, b."fileName" as "fileName"
      from subjects s
      left join books b on b."subjectId" = s.id
      where s.id = ${session.subjectId}
      order by b."createdAt" desc
      limit 40
    `);
    if (!rows.length) return "";
    const files = rows.map(row => row.fileName).filter(Boolean);
    return `Folder: ${rows[0].name}${files.length ? `\nFiles: ${files.join(", ")}` : ""}`;
  }

  return "";
}

function scopeLabel(scope: ChatScope): string {
  switch (scope) {
    case "page":
      return "the current page";
    case "chapter":
      return "the current chapter";
    case "book":
      return "the current book";
    case "subject":
      return "every book in the current subject";
  }
}

// System prompt shared by every scope — what changes is which overview and
// which pages were retrieved into the user message (buildStudyContext).
export function buildRagSystemPrompt(scope: ChatScope): string {
  return [
    `You are "مساعد NiroLearn", a brilliant, warm study tutor inside an Arabic study app. The student is studying ${scopeLabel(scope)} of their own uploaded material; its overview and the most relevant pages (SOURCE EXCERPTS, each tagged with its page number) are given in their message.`,
    "Help with ANYTHING they ask — about this material or beyond it (related topics, other subjects, general knowledge, study advice). Never refuse or say you can only answer from the file.",
    "When the excerpts cover the question, build your answer on them and cite the page for facts taken from them (e.g. 'صفحة 12'). Never invent what the file says or cite a page that wasn't given.",
    "When the question goes beyond the excerpts, still answer fully from your own knowledge, and mark that part briefly (e.g. start it with '📚 من خارج الملف:') so the student knows it isn't from their file. If your knowledge and the file disagree, say so.",
    "If asked to quiz the student ('اختبرني'), ask ONE question at a time (from the material when possible) and do not reveal the correct answer until they respond or explicitly ask for it; then tell them if they were right and why.",
    "Personality: friendly, encouraging and patient; a few fitting emojis (1-3) are welcome. Reply in the student's language — Arabic by default, keeping English scientific/medical terms in English next to their meaning.",
    "Formatting: Markdown — short paragraphs, **bold** key terms, bullet or numbered lists for steps, tables for comparisons. Write math in plain text with Unicode symbols (×, ÷, ≈, √, ², →) — never LaTeX. Get to the point; offer to go deeper at the end of longer answers.",
  ].join("\n");
}

export function buildContextBlock(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      chunk =>
        `\n===== ${chunk.bookFileName} — صفحة ${chunk.pageNumber} =====\n${chunk.text}`
    )
    .join("\n");
}

// The user turn the model answers: overview + matched pages + question.
export function buildStudyContext(
  overview: string,
  chunks: RetrievedChunk[],
  question: string
): string {
  return [
    overview && `MATERIAL OVERVIEW:\n${overview}`,
    chunks.length
      ? `SOURCE EXCERPTS (most relevant pages):\n${buildContextBlock(chunks)}`
      : "SOURCE EXCERPTS: none of the file's pages matched this question's words — use the overview if it helps, otherwise answer from your own knowledge (marked as outside the file).",
    `QUESTION: ${question}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
