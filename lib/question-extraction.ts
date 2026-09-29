// Real, non-AI extraction of pre-existing questions from a "question_file"
// book's own text (PR16) — never an LLM call, and never invents a question,
// an option or an answer the source doesn't state.
//
// The work is split in two layers:
//   lib/question-document.ts    — document understanding: cleaning,
//     page classification (cover / front matter / questions / answer key /
//     explanations), segmentation, answer keys, validation.
//   lib/question-parse-core.ts  — parsing one question stream into
//     stem / options / answer / explanation / notes (incl. bilingual files).
// This module is the stable entry point the pipeline and tests use.
import { analyzeQuestionDocument } from "./question-document";
import type { ExtractedQuestionInput } from "./question-parse-core";

export type { ExtractedQuestionInput } from "./question-parse-core";
export { isArabicText } from "./question-parse-core";
export {
  analyzeQuestionDocument,
  type NeedsReviewQuestion,
  type PageClassification,
  type QuestionDocumentAnalysis,
} from "./question-document";

// The VALID questions of a file (incomplete / contaminated blocks are
// reported by analyzeQuestionDocument's needsReview, never returned here).
export function extractQuestionsFromPages(
  pages: { page: number; text: string }[]
): ExtractedQuestionInput[] {
  return analyzeQuestionDocument(pages).questions;
}
