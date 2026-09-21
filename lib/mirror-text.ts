// Pure helpers for مِرآة's "paste question text" input (no PDF involved):
// cleaning the pasted text, validating its size, estimating how many
// questions it holds, and slicing it into page-like chunks so it can flow
// through exactly the same batch/generation pipeline as an extracted PDF
// (see lib/db-mirror.ts's createMirrorTextJob). Kept free of DB/React so it
// is unit-testable and shared by the server (validation, splitting) and the
// input form (limits, live estimate).

export type MirrorTextPage = { page: number; text: string; hasText: true };

export const MIRROR_TEXT_MIN_CHARS = 30;
export const MIRROR_TEXT_MAX_CHARS = 60_000;

// Target size of one page-like chunk. Kept comfortably below the batch
// ceiling in lib/db-mirror.ts (BATCH_MAX_CHARS) so a chunk is never re-split
// mid-question there.
const CHUNK_TARGET_CHARS = 2_500;

// A line that starts a new numbered question: "1.", "12)", "3-", "Q4",
// "Question 5", "س6", "السؤال 7". Deliberately NOT lettered answer options
// ("A.", "b)") — counting those would multiply the estimate for MCQs.
const QUESTION_START =
  /^\s*(?:\(?\d{1,3}\s*[.)\-–:]|Q(?:uestion)?\s*\.?\s*\d{1,3}\b|س\s*\d{1,3}\b|السؤال\s*\d{1,3}\b)/i;

// Cleans clipboard noise without touching the content: unifies line endings,
// drops control and zero-width characters (but keeps the RTL/LTR marks that
// Arabic text legitimately uses), trims trailing spaces and collapses runs of
// blank lines.
export function normalizeQuestionText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type MirrorTextValidation =
  | { ok: true; text: string }
  | { ok: false; error: string };

export function validateQuestionText(raw: string): MirrorTextValidation {
  const text = normalizeQuestionText(raw);
  if (text.length < MIRROR_TEXT_MIN_CHARS) {
    return { ok: false, error: "الصق نص الأسئلة أولًا (نص قصير جدًا)." };
  }
  if (text.length > MIRROR_TEXT_MAX_CHARS) {
    return {
      ok: false,
      error: `النص أطول من ${MIRROR_TEXT_MAX_CHARS.toLocaleString("en")} حرفًا. قسّمه على دفعتين وأضف الثانية لنفس الملف.`,
    };
  }
  return { ok: true, text };
}

// Rough count of numbered questions, for the live "≈ N سؤال" hint. Returns 0
// when the text has no numbering to go by, in which case the form shows no
// estimate rather than a wrong one.
export function estimateQuestionCount(text: string): number {
  return text.split("\n").filter(line => QUESTION_START.test(line)).length;
}

function toBlocks(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim());
  if (paragraphs.length > 1) return paragraphs;

  // One unbroken block: split before each numbered question if the text has
  // numbering, otherwise fall back to single lines.
  const lines = text.split("\n").filter(line => line.trim());
  if (lines.filter(line => QUESTION_START.test(line)).length >= 2) {
    const blocks: string[] = [];
    for (const line of lines) {
      if (QUESTION_START.test(line) || blocks.length === 0) blocks.push(line);
      else blocks[blocks.length - 1] += `\n${line}`;
    }
    return blocks;
  }
  return lines;
}

// Packs the text into page-like chunks of roughly CHUNK_TARGET_CHARS,
// breaking only between blocks (paragraphs, or numbered questions) so a
// question and its options stay together. Page numbers are 1-based and only
// meaningful as an ordering; the UI never shows them for text sections.
export function splitTextIntoPages(text: string): MirrorTextPage[] {
  const normalized = normalizeQuestionText(text);
  if (!normalized) return [];

  const pages: MirrorTextPage[] = [];
  let current = "";
  const flush = () => {
    if (!current.trim()) return;
    pages.push({ page: pages.length + 1, text: current, hasText: true });
    current = "";
  };
  for (const block of toBlocks(normalized)) {
    if (current && current.length + block.length + 2 > CHUNK_TARGET_CHARS) {
      flush();
    }
    current += `${current ? "\n\n" : ""}${block}`;
  }
  flush();
  return pages;
}
