// Audit Phase 6/7 — shared orchestration for the lazy/automatic
// post-processing enrichments layered on top of an already-complete
// chapter: hierarchical mind-map sections and visual-explanation insights.
// Deliberately its own file (not lib/db-books.ts, which stays DB-only per
// its own header comment, and not lib/book-analysis.ts, which stays pure
// prompt-building) since this does real orchestration (DB read -> LLM call
// -> DB write) shared by two different callers:
//   - lib/trpc/booksRouter.ts (a student's on-demand click; does its OWN
//     ownership check via getChapterForUser BEFORE calling these, since
//     these take a bare chapterId with no ownership filter of their own —
//     same trust-boundary split as every other worker-callable helper).
//   - app/api/books/generate-mindmap-sections/route.ts (the automatic
//     QStash trigger fired right after a chapter completes).
// Both generation functions are idempotent (return the cached value if
// already generated), so calling either twice — whether from a retry, a
// race between the automatic trigger and a manual click, or QStash's
// at-least-once delivery — never re-pays for or overwrites a completed
// result.
import {
  getChapterById,
  getChapterCardCount,
  getChapterMcqCount,
  getChapterTerms,
  getChapterVisualAssets,
  insertBookCards,
  insertBookMcqs,
  saveChapterMindMapSections,
  saveChapterVisualInsights,
} from "./db-books";
import {
  buildChapterFlashcardsMessages,
  buildChapterMcqsMessages,
  buildMindMapSectionsMessages,
  buildVisualInsightsMessages,
  chapterFlashcardsResponseSchema,
  chapterMcqsResponseSchema,
  mindMapSectionsResponseSchema,
  parseChapterFlashcards,
  parseChapterMcqs,
  parseMindMapSections,
  parseVisualInsights,
  visualInsightsResponseSchema,
  type ChapterFlashcard,
  type ChapterMcq,
  type ChapterMindMapSection,
} from "./book-analysis";
import { invokeLLM } from "./llm";

export async function generateAndSaveMindMapSections(
  chapterId: string
): Promise<ChapterMindMapSection[] | null> {
  const chapter = await getChapterById(chapterId);
  if (!chapter || chapter.status !== "complete") return null;
  if (chapter.mindMapSections) return chapter.mindMapSections;

  const terms = await getChapterTerms(chapter.id);
  const validPages = Array.from(
    { length: chapter.endPage - chapter.startPage + 1 },
    (_, i) => chapter.startPage + i
  );
  const response = await invokeLLM({
    max_tokens: 2000,
    messages: buildMindMapSectionsMessages(
      chapter.title,
      chapter.explanationAr ?? "",
      chapter.keyPoints ?? [],
      terms,
      validPages
    ),
    response_format: mindMapSectionsResponseSchema,
  });
  const sections = parseMindMapSections(
    response.choices[0]?.message.content,
    validPages
  );
  await saveChapterMindMapSections(chapter.id, sections);
  return sections;
}

export async function generateAndSaveVisualInsights(
  chapterId: string
): Promise<string | null> {
  const chapter = await getChapterById(chapterId);
  if (!chapter || chapter.status !== "complete") return null;
  if (chapter.visualInsightsAr !== null) return chapter.visualInsightsAr;

  const visuals = await getChapterVisualAssets(chapter.id);
  if (!visuals.length) return "";

  const response = await invokeLLM({
    max_tokens: 800,
    messages: buildVisualInsightsMessages(chapter.explanationAr ?? "", visuals),
    response_format: visualInsightsResponseSchema,
  });
  const visualInsightsAr = parseVisualInsights(
    response.choices[0]?.message.content
  );
  await saveChapterVisualInsights(chapter.id, visualInsightsAr);
  return visualInsightsAr;
}

// On-demand flashcards/MCQs (see lib/book-analysis.ts's comment on
// buildChapterAnalysisMessages) — the automatic chapter-analysis call no
// longer generates these itself, so a chapter reaching "complete" now means
// only explanation/keyPoints/terms/summary are ready; a student who wants
// study tools triggers one of these, same idempotent shape as the mind-map/
// visual-insights generators above (count-check instead of a cached-field
// check, since cards/mcqs are their own normalized tables, not a column on
// bookChapters).
export async function generateAndSaveChapterFlashcards(
  chapterId: string
): Promise<ChapterFlashcard[] | null> {
  const chapter = await getChapterById(chapterId);
  if (!chapter || chapter.status !== "complete") return null;
  if ((await getChapterCardCount(chapterId)) > 0) return null;
  if (!chapter.pageTexts?.length) return [];

  const response = await invokeLLM({
    max_tokens: 3000,
    messages: buildChapterFlashcardsMessages(chapter.title, chapter.pageTexts),
    response_format: chapterFlashcardsResponseSchema,
  });
  const flashcards = parseChapterFlashcards(
    response.choices[0]?.message.content
  );
  await insertBookCards(chapter.id, chapter.userId, flashcards);
  return flashcards;
}

export async function generateAndSaveChapterMcqs(
  chapterId: string
): Promise<ChapterMcq[] | null> {
  const chapter = await getChapterById(chapterId);
  if (!chapter || chapter.status !== "complete") return null;
  if ((await getChapterMcqCount(chapterId)) > 0) return null;
  if (!chapter.pageTexts?.length) return [];

  const response = await invokeLLM({
    max_tokens: 3000,
    messages: buildChapterMcqsMessages(chapter.title, chapter.pageTexts),
    response_format: chapterMcqsResponseSchema,
  });
  const mcqs = parseChapterMcqs(response.choices[0]?.message.content);
  await insertBookMcqs(chapter.id, mcqs);
  return mcqs;
}
