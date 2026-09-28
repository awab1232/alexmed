// Audit Phase 5 — Question Validation Agent, moved out of
// lib/trpc/booksRouter.ts unchanged so it runs as a background job
// (lib/generation-jobs.ts, kind "mcq_validation") instead of inside an
// HTTP request. Ownership is checked when the job is created; this takes a
// bare chapterId like the other worker-callable generators.
//
// Lazy + idempotent: skips straight to the cached statuses once every MCQ
// in the chapter has already been checked, so re-running never re-pays for
// validation. Duplicates are caught deterministically first
// (findDuplicateMcqIds, no LLM needed); only the remaining, non-duplicate
// MCQs go through the LLM correctness/grounding check against this
// chapter's own explanation.
//
// Coverage-based gap-filling ("generate additional questions for uncovered
// sections") then runs using the FINAL statuses above: a page whose only
// MCQ just got flagged is a gap again just as much as a page that never had
// one. New questions are generated only from this chapter's own
// already-stored page text (never invented), and only for the exact pages
// still missing coverage.
import {
  buildGapQuestionsMessages,
  buildMcqValidationMessages,
  findDuplicateMcqIds,
  findUncoveredPages,
  gapQuestionsResponseSchema,
  mcqValidationResponseSchema,
  parseGapQuestions,
  parseMcqValidation,
} from "./book-analysis";
import { generationBudget } from "./chapter-generation";
import {
  getChapterById,
  getChapterMcqsForValidation,
  insertBookMcqs,
  saveMcqValidationResults,
} from "./db-books";
import { invokeLLM } from "./llm";

export type McqValidationSummary = {
  total: number;
  valid: number;
  flagged: number;
  generated: number;
};

export async function validateAndFillChapterMcqs(
  chapterId: string
): Promise<McqValidationSummary | null> {
  const chapter = await getChapterById(chapterId);
  if (!chapter || chapter.status !== "complete") return null;

  let mcqs = await getChapterMcqsForValidation(chapter.id);
  const alreadyValidated = mcqs.every(
    mcq => mcq.validationStatus !== "pending"
  );

  if (!alreadyValidated) {
    // Only the still-pending ones — duplicates are checked across the
    // WHOLE chapter (a fresh gap-filled question can duplicate an
    // already-valid older one), but an already-valid/flagged MCQ is never
    // re-sent to the LLM just because some other MCQ in the same chapter
    // is still pending.
    const duplicateIds = new Set(findDuplicateMcqIds(mcqs));
    const toValidate = mcqs.filter(
      mcq => !duplicateIds.has(mcq.id) && mcq.validationStatus === "pending"
    );

    const results: {
      id: string;
      status: "valid" | "flagged";
      note: string | null;
    }[] = Array.from(duplicateIds, id => ({
      id,
      status: "flagged" as const,
      note: "سؤال مكرر داخل هذا الفصل.",
    }));

    if (toValidate.length) {
      // Reasoning models spend hidden tokens first — the old flat 2000
      // could end before any JSON was written, flagging every question.
      const response = await invokeLLM({
        max_tokens: generationBudget(toValidate.length * 120),
        messages: buildMcqValidationMessages(
          chapter.explanationEn ?? "",
          toValidate
        ),
        response_format: mcqValidationResponseSchema,
      });
      const validation = parseMcqValidation(
        response.choices[0]?.message.content
      );
      const validationById = new Map(validation.map(v => [v.id, v]));
      for (const mcq of toValidate) {
        const result = validationById.get(mcq.id);
        results.push({
          id: mcq.id,
          status: result?.valid ? "valid" : "flagged",
          note: result?.valid ? null : (result?.note ?? "لم يجتز التحقق."),
        });
      }
    }

    await saveMcqValidationResults(results);
    const resultById = new Map(results.map(r => [r.id, r]));
    mcqs = mcqs.map(mcq => {
      const result = resultById.get(mcq.id);
      return result ? { ...mcq, validationStatus: result.status } : mcq;
    });
  }

  const coveredPages = mcqs
    .filter(mcq => mcq.validationStatus !== "flagged")
    .map(mcq => mcq.sourcePage);
  const uncoveredPages = findUncoveredPages(
    chapter.startPage,
    chapter.endPage,
    coveredPages
  );
  let generatedCount = 0;
  if (uncoveredPages.length && chapter.pageTexts?.length) {
    const gapPages = chapter.pageTexts.filter(page =>
      uncoveredPages.includes(page.page)
    );
    if (gapPages.length) {
      const response = await invokeLLM({
        max_tokens: generationBudget(gapPages.length * 500),
        messages: buildGapQuestionsMessages(chapter.title, gapPages),
        response_format: gapQuestionsResponseSchema,
      });
      const generated = parseGapQuestions(
        response.choices[0]?.message.content,
        uncoveredPages
      );
      if (generated.length) {
        await insertBookMcqs(chapter.id, generated);
        generatedCount = generated.length;
      }
    }
  }

  return {
    total: mcqs.length + generatedCount,
    valid: mcqs.filter(mcq => mcq.validationStatus === "valid").length,
    flagged: mcqs.filter(mcq => mcq.validationStatus === "flagged").length,
    generated: generatedCount,
  };
}
