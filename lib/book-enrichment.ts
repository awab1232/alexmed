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
//
// Full-document coverage: flashcards, MCQs, notes and the mind map are
// generated chunk by chunk over EVERY page of the chapter
// (lib/chapter-generation.ts), and each one's Quality Gate verdict is
// written into the chapter's coverage manifest — see
// lib/document-coverage.ts.
import {
  getChapterById,
  getChapterCardCount,
  getChapterMcqCount,
  getChapterStudySignals,
  getChapterTerms,
  getChapterVisualAssets,
  insertBookCards,
  insertBookMcqs,
  saveChapterCoverageManifest,
  saveChapterMindMapSections,
  saveChapterMedicalNotePages,
  saveChapterVisualInsights,
} from "./db-books";
import {
  buildVisualInsightsMessages,
  parseVisualInsights,
  visualInsightsResponseSchema,
  type ChapterFlashcard,
  type ChapterMcq,
  type ChapterMindMapSection,
} from "./book-analysis";
import {
  generateChapterFlashcardsCovered,
  generateChapterMcqsCovered,
  generateChapterMindMapCovered,
  generateChapterNotesCovered,
} from "./chapter-generation";
import { buildChapterManifest, type OutputCoverage } from "./document-coverage";
import type { MedicalNotePage } from "./medical-note-composer";
import { invokeLLM } from "./llm";

type LoadedChapter = NonNullable<Awaited<ReturnType<typeof getChapterById>>>;

// Adds one output's coverage verdict to the chapter manifest. Never throws
// into the caller: the generated content is already saved, the manifest is
// observability on top of it.
async function recordCoverage(
  chapter: LoadedChapter,
  output: OutputCoverage,
  errors: string[] = []
) {
  try {
    // Re-read so two generators finishing close together don't overwrite
    // each other's entries with a stale copy.
    const fresh = await getChapterById(chapter.id);
    await saveChapterCoverageManifest(
      chapter.id,
      buildChapterManifest(
        chapter.pageTexts ?? [],
        fresh?.coverageManifest ?? chapter.coverageManifest ?? null,
        {
          output,
          ...(errors.length ? { errors } : {}),
        }
      )
    );
  } catch (error) {
    console.error("[Books] Failed to record coverage manifest", error);
  }
}

function logGate(chapterId: string, output: OutputCoverage) {
  if (output.status !== "COMPLETE") {
    console.warn(
      `[Books][coverage] ${output.kind} for chapter ${chapterId}: ${output.status} — ${output.reasons.join(" ")}`
    );
  }
}

export async function generateAndSaveMindMapSections(
  chapterId: string
): Promise<ChapterMindMapSection[] | null> {
  const chapter = await getChapterById(chapterId);
  if (!chapter || chapter.status !== "complete") return null;
  if (chapter.mindMapSections) {
    // Older cached maps predate the linked English/exam/prompt fields. Keep
    // them readable and let a later explicit regeneration enrich them.
    return chapter.mindMapSections.map(section => ({
      ...section,
      summaryEn: section.summaryEn ?? "",
      examPoints: section.examPoints ?? [],
      cardPrompts: section.cardPrompts ?? [],
      concepts: section.concepts.map(concept => ({
        ...concept,
        explanationEn: concept.explanationEn ?? "",
      })),
    }));
  }

  const terms = await getChapterTerms(chapter.id);
  const studySignals = await getChapterStudySignals(chapter.id);
  const validPages = Array.from(
    { length: chapter.endPage - chapter.startPage + 1 },
    (_, i) => chapter.startPage + i
  );
  const result = await generateChapterMindMapCovered(
    {
      title: chapter.title,
      explanationEn: chapter.explanationEn ?? "",
      explanationAr: chapter.explanationAr ?? "",
      keyPoints: chapter.keyPoints ?? [],
      terms,
      flashcards: studySignals.flashcards,
      mcqs: studySignals.mcqs,
      validPages,
      summarySections: chapter.coverageManifest?.summarySections,
    },
    chapter.pageTexts ?? [],
    invokeLLM
  );
  await saveChapterMindMapSections(chapter.id, result.items);
  logGate(chapter.id, result.coverage);
  await recordCoverage(chapter, result.coverage, result.errors);
  return result.items;
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

  const result = await generateChapterFlashcardsCovered(
    chapter.title,
    chapter.pageTexts,
    invokeLLM
  );
  // Every chunk failing (provider down) is a real failure — surface it so
  // the student can retry, instead of saving zero cards as "done".
  if (!result.items.length && result.errors.length) {
    throw new Error(result.errors[0]);
  }
  await insertBookCards(chapter.id, chapter.userId, result.items);
  logGate(chapter.id, result.coverage);
  await recordCoverage(chapter, result.coverage, result.errors);
  return result.items;
}

export async function generateAndSaveChapterMcqs(
  chapterId: string
): Promise<ChapterMcq[] | null> {
  const chapter = await getChapterById(chapterId);
  if (!chapter || chapter.status !== "complete") return null;
  if ((await getChapterMcqCount(chapterId)) > 0) return null;
  if (!chapter.pageTexts?.length) return [];

  const result = await generateChapterMcqsCovered(
    chapter.title,
    chapter.pageTexts,
    invokeLLM
  );
  if (!result.items.length && result.errors.length) {
    throw new Error(result.errors[0]);
  }
  await insertBookMcqs(chapter.id, result.items);
  logGate(chapter.id, result.coverage);
  await recordCoverage(chapter, result.coverage, result.errors);
  return result.items;
}

export async function generateAndSaveMedicalNotePages(
  chapterId: string
): Promise<MedicalNotePage[] | null> {
  const chapter = await getChapterById(chapterId);
  if (!chapter || chapter.status !== "complete") return null;
  if (chapter.medicalNotePages)
    return chapter.medicalNotePages as MedicalNotePage[];

  const terms = await getChapterTerms(chapter.id);
  const visuals = await getChapterVisualAssets(chapter.id);
  const result = await generateChapterNotesCovered(
    {
      title: chapter.title,
      explanationEn: chapter.explanationEn ?? "",
      explanationAr: chapter.explanationAr ?? "",
      summary: chapter.chapterSummary ?? "",
      keyPoints: chapter.keyPoints ?? [],
      terms,
      visuals,
    },
    (chapter.pageTexts ?? []).map(page => ({
      page: page.page,
      text: page.text,
    })),
    chapter.coverageManifest?.summarySections,
    invokeLLM
  );
  if (!result.items.length && result.errors.length) {
    throw new Error(result.errors[0]);
  }
  await saveChapterMedicalNotePages(chapter.id, result.items);
  logGate(chapter.id, result.coverage);
  await recordCoverage(chapter, result.coverage, result.errors);
  return result.items;
}
