// Question-file DOCUMENT UNDERSTANDING — deterministic, no AI.
//
//   pages (text or OCR)
//     → clean: drop page numbers and repeated headers / footers / watermarks
//     → re-line: split what OCR ran together ("…saliva. B. Cyanosis…",
//       "…saliva. 9. Which of…") at option and next-question markers
//     → classify pages: cover · front matter (intro, objectives,
//       instructions, contents) · question · answer key · explanations ·
//       appendix · blank · unknown
//     → segment: the QUESTION SECTION starts at the first page that really
//       holds a question block (a numbered stem followed by options) —
//       never at page 1 just because it has text
//     → parse question blocks (lib/question-parse-core.ts) over the
//       section as ONE stream, so a question can span pages
//     → attach a separate answer key / explanations section by question
//       number
//     → validate: an incomplete or contaminated question is NOT saved as a
//       valid question; it is reported as needs-review with its reason.
//
// Nothing here generates text: every stored field is text the file states.

import {
  normalize,
  parseKeyEntry,
  parseQuestionStream,
  resolveAnswer,
  toAsciiDigits,
  type AnswerKeyEntry,
  type ExtractedQuestionInput,
  type ParsedQuestion,
  type StreamLine,
} from "./question-parse-core";

export type PageKind =
  | "cover"
  | "front_matter"
  | "question"
  | "answer_key"
  | "explanations"
  | "appendix"
  | "blank"
  | "unknown";

export type PageClassification = {
  page: number;
  kind: PageKind;
  // Whether the page's text is part of the question stream.
  inQuestionSection: boolean;
};

export type NeedsReviewQuestion = {
  number: number;
  sourcePage: number;
  reasons: string[];
  excerpt: string;
};

// Every parsed block in file order, as stored: valid ones with reviewStatus
// null, failed ones "needs_review" with their reasons (kept for the doctor,
// never shown to students).
export type StoredQuestionInput = ExtractedQuestionInput & {
  reviewStatus: "needs_review" | null;
  reviewReason: string | null;
};

export type QuestionDocumentAnalysis = {
  questions: ExtractedQuestionInput[];
  // Parsed blocks that failed validation — never valid questions.
  needsReview: NeedsReviewQuestion[];
  // Valid AND needs-review blocks, in file order, ready to store.
  all: StoredQuestionInput[];
  pages: PageClassification[];
  // Each stored question's page span [sourcePage, endPage] (same order as
  // `questions`), for image association.
  spans: { startPage: number; endPage: number }[];
};

type Page = { page: number; text: string };

// ── 1. Cleaning ─────────────────────────────────────────────────────────

const PAGE_NUMBER_LINE =
  /^\s*(?:[-–—]\s*)?(?:page|p\.?|صفحة)?\s*[\d٠-٩]{1,4}\s*(?:(?:of|\/|من)\s*[\d٠-٩]{1,4})?\s*(?:[-–—])?\s*$/i;
const SCANNER_MARK = /\b(?:camscanner|scanned with|scanned by)\b.*$/i;
const STRUCTURAL_LINE =
  /^\s*(?:\(?[A-Ha-hأابجد١-٨]\s?[.):]|\(?[A-Ha-h]\)|[\d٠-٩]{1,3}\s*[.):\-]\s|(?:correct answer|answer|ans|key|explanation|note|الإجابة|الجواب)\b)/i;

function lineKey(line: string): string {
  return toAsciiDigits(line)
    .toLowerCase()
    .replace(/\d+/g, "#")
    .replace(/[^\p{L}#]+/gu, " ")
    .trim();
}

// Short lines that recur on many pages (running headers, footers, the book
// title, watermark text) — dropped as lines and cut off where OCR glued
// them onto the end of real text.
export function findRepeatedLines(pages: Page[]): Set<string> {
  const counts = new Map<string, number>();
  for (const { text } of pages) {
    const seen = new Set<string>();
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      const words = line.split(/\s+/).filter(Boolean).length;
      if (!line || words > 8) continue;
      // Structure is never a header: identical options ("A. True",
      // "B. False"), answer lines and numbered lines recur legitimately.
      if (STRUCTURAL_LINE.test(line)) continue;
      const key = lineKey(line);
      if (key.replace(/#/g, "").trim().length < 4 || seen.has(key)) continue;
      seen.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const threshold = Math.max(3, Math.ceil(pages.length * 0.3));
  return new Set(
    [...counts].filter(([, n]) => n >= threshold).map(([key]) => key)
  );
}

export function cleanPages(pages: Page[]): Page[] {
  const repeated = findRepeatedLines(pages);
  const repeatedPhrases = [...repeated].filter(key => !key.includes("#"));
  return pages.map(({ page, text }) => {
    const lines: string[] = [];
    for (const raw of text.split("\n")) {
      let line = raw.replace(SCANNER_MARK, "").trim();
      if (!line || PAGE_NUMBER_LINE.test(line)) continue;
      if (repeated.has(lineKey(line))) continue;
      // A repeated footer glued to the end of a real line by OCR.
      for (const phrase of repeatedPhrases) {
        const lower = line.toLowerCase();
        const at = lower.lastIndexOf(phrase.split(" ")[0]);
        if (at > 0 && lineKey(line.slice(at)) === phrase) {
          line = line.slice(0, at).trim();
        }
      }
      if (line) lines.push(line);
    }
    return { page, text: lines.join("\n") };
  });
}

// ── 2. Re-lining ────────────────────────────────────────────────────────

// Option markers OCR left mid-line: "…?  A. x  B. y" or "…saliva. B. Cyanosis".
// Split before a marker when the line holds a run of them in order, or
// when a single B–H marker follows the end of a sentence.
const LABELLED_LINE =
  /^\s*(?:the\s+)?(?:correct answer|right answer|answer|ans|key|explanation|rationale|comments?|discussion|note|notes|الإجابة|الجواب|الشرح|التفسير|ملاحظة)\b/i;

function splitInlineOptions(line: string): string[] {
  // "Answer: B. Note: …" / "Explanation: A. is correct because …" are
  // not option runs.
  if (LABELLED_LINE.test(line)) return [line];
  const markers = [...line.matchAll(/(^|\s)\(?([A-Ha-h])\s?[.)]\s+/g)].map(
    match => ({
      letter: match[2].toLowerCase(),
      at: match.index! + match[1].length,
      prev: line.slice(0, match.index!).trimEnd(),
    })
  );
  if (!markers.length) return [line];
  const cuts: number[] = [];
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    if (marker.at === 0) continue;
    const prevMarker = markers[i - 1];
    const inRun =
      !!prevMarker &&
      "abcdefgh".indexOf(marker.letter) ===
        "abcdefgh".indexOf(prevMarker.letter) + 1;
    const nextInRun =
      !!markers[i + 1] &&
      "abcdefgh".indexOf(markers[i + 1].letter) ===
        "abcdefgh".indexOf(marker.letter) + 1;
    const afterSentence = /[.?!:)]$/.test(marker.prev);
    if (
      inRun ||
      (marker.letter === "a" && nextInRun) ||
      (marker.letter !== "a" && afterSentence)
    ) {
      cuts.push(marker.at);
    }
  }
  if (!cuts.length) return [line];
  const parts: string[] = [];
  let start = 0;
  for (const cut of cuts) {
    parts.push(line.slice(start, cut).trim());
    start = cut;
  }
  parts.push(line.slice(start).trim());
  return parts.filter(Boolean);
}

const LINE_QUESTION_NUMBER =
  /^\s*(?:(?:question|q)\s*\.?\s*)?(\d{1,3})\s*[.):\-]\s+\S/i;

// Answer / explanation / note markers OCR ran onto the end of a line.
const INLINE_SECTION =
  /\s(?=(?:correct answer|answer|explanation|note)\s*[:\-])/i;

// Builds the question stream: page text split into lines, OCR run-ons
// split, and a next-question number buried mid-line ("…saliva. 9. Which…")
// broken out — only when it IS the next number, so "Stage 2. The patient…"
// never becomes a question.
export function relinePages(pages: Page[]): StreamLine[] {
  const out: StreamLine[] = [];
  let lastNumber = 0;
  for (const { page, text } of pages) {
    for (const raw of text.split("\n")) {
      const pending = [raw.trim()];
      while (pending.length) {
        const line = pending.shift()!;
        if (!line) continue;
        const own = toAsciiDigits(line).match(LINE_QUESTION_NUMBER);
        if (own) lastNumber = Number(own[1]);
        const next = lastNumber + 1;
        const buried = new RegExp(
          `([.?!)])\\s+(?:Q(?:uestion)?\\s*)?${next}\\s*[.)]\\s+(?=[A-Z\\u0600-\\u06FF(])`
        ).exec(toAsciiDigits(line));
        if (buried && buried.index > 0) {
          const cut = buried.index + buried[1].length;
          pending.unshift(line.slice(cut).trim());
          pending.unshift(line.slice(0, cut).trim());
          // Re-process the first part with the current number.
          const first = pending.shift()!;
          for (const part of splitInlineOptions(first)) {
            pushWithSections(out, page, part);
          }
          continue;
        }
        for (const part of splitInlineOptions(line)) {
          pushWithSections(out, page, part);
        }
      }
    }
  }
  return out;
}

function pushWithSections(out: StreamLine[], page: number, line: string) {
  const at = line.search(INLINE_SECTION);
  if (
    at > 0 &&
    !/^\s*(?:correct answer|answer|explanation|note)\b/i.test(line)
  ) {
    out.push({ page, text: line.slice(0, at).trim(), index: out.length });
    out.push({ page, text: line.slice(at).trim(), index: out.length });
    return;
  }
  out.push({ page, text: line, index: out.length });
}

// ── 3. Page classification & segmentation ───────────────────────────────

const FRONT_MATTER_HEADING =
  /^\s*(?:introduction|preface|foreword|objectives?|learning objectives|aims?|instructions?|how to use( this book)?|table of contents|contents|index|acknowledge?ments?|dedication|about (the|this) (book|author)|copyright|المقدمة|مقدمة|الأهداف|التعليمات|تعليمات|الفهرس|المحتويات|شكر)\b/i;
// Section headings are plural / explicit ("Answer Key", "Answers",
// "Explanations"); a question's own "Answer:" / "Explanation:" label is
// singular and never starts a section.
const ANSWER_KEY_HEADING =
  /^\s*(?:answer\s*keys?|answers|key answers|model answers|correct answers|الإجابات|مفتاح الإجابة|مفتاح الإجابات|الأجوبة)\s*:?\s*$/i;
const EXPLANATIONS_HEADING =
  /^\s*(?:explanations|answers?\s*(?:and|&)\s*explanations?|rationales|detailed answers|التفسيرات|الإجابات والشرح)\s*:?\s*$/i;
const APPENDIX_HEADING =
  /^\s*(?:references?|bibliography|appendix|appendices|glossary|المراجع|المصادر|الملحق)\s*:?\s*$/i;
// "Forensic medicine MCQs ........ Page 87" / "Chapter 2 .... 34"
const TOC_LINE = /(?:\.{3,}|…|\bpage\b|صفحة)\s*\$?[\d٠-٩]{1,4}\.?\s*$/i;

type Stats = {
  starts: number;
  options: number;
  keyEntries: number;
  answers: number;
  toc: number;
  chars: number;
  lines: number;
  mcqBlock: boolean;
  heading: "front" | "key" | "explanations" | "appendix" | null;
};

function pageStats(lines: StreamLine[]): Stats {
  const stats: Stats = {
    starts: 0,
    options: 0,
    keyEntries: 0,
    answers: 0,
    toc: 0,
    chars: 0,
    lines: lines.length,
    mcqBlock: false,
    heading: null,
  };
  let lastStart = -1;
  let optionsSinceStart = 0;
  lines.forEach((line, i) => {
    const text = line.text;
    stats.chars += text.length;
    if (i < 4 && !stats.heading) {
      if (ANSWER_KEY_HEADING.test(text)) stats.heading = "key";
      else if (EXPLANATIONS_HEADING.test(text)) stats.heading = "explanations";
      else if (APPENDIX_HEADING.test(text)) stats.heading = "appendix";
      else if (FRONT_MATTER_HEADING.test(text)) stats.heading = "front";
    }
    if (TOC_LINE.test(text)) stats.toc++;
    if (parseKeyEntry(text)) {
      stats.keyEntries++;
      return;
    }
    if (/^\s*(?:correct answer|answer|ans)\s*[:\-]/i.test(text))
      stats.answers++;
    if (
      LINE_QUESTION_NUMBER.test(toAsciiDigits(text)) &&
      !TOC_LINE.test(text)
    ) {
      stats.starts++;
      lastStart = i;
      optionsSinceStart = 0;
    }
    if (/^\s*(?:\([A-Ha-h]\)|[A-Ha-h]\s?[.)])\s+\S/.test(text)) {
      stats.options++;
      if (lastStart >= 0 && i - lastStart <= 16) {
        optionsSinceStart++;
        if (optionsSinceStart >= 2) stats.mcqBlock = true;
      }
    }
  });
  return stats;
}

export function classifyPages(stream: StreamLine[], pageNumbers: number[]) {
  const byPage = new Map<number, StreamLine[]>();
  for (const page of pageNumbers) byPage.set(page, []);
  for (const line of stream) byPage.get(line.page)?.push(line);

  const stats = new Map(
    pageNumbers.map(page => [page, pageStats(byPage.get(page) ?? [])])
  );
  const anyMcq = [...stats.values()].some(s => s.mcqBlock);
  // A question page: a real question block. Documents with no MCQs at all
  // (short-answer banks) fall back to numbered questions ending in "?".
  const isQuestionPage = (page: number) => {
    const s = stats.get(page)!;
    if (s.heading === "front" || s.toc >= 2) return false;
    if (anyMcq) return s.mcqBlock;
    return (byPage.get(page) ?? []).some(
      line =>
        LINE_QUESTION_NUMBER.test(toAsciiDigits(line.text)) &&
        /[?؟]\s*$/.test(line.text)
    );
  };
  const firstQuestionPage = pageNumbers.find(isQuestionPage);

  let section: "before" | "questions" | "key" | "explanations" | "appendix" =
    "before";
  const classes: PageClassification[] = [];
  for (const page of pageNumbers) {
    const s = stats.get(page)!;
    let kind: PageKind;
    if (s.chars < 8) kind = "blank";
    else if (
      s.heading === "key" ||
      (s.keyEntries >= 5 && s.keyEntries >= s.lines * 0.5)
    )
      kind = "answer_key";
    else if (s.heading === "explanations") kind = "explanations";
    else if (s.heading === "appendix") kind = "appendix";
    else if (isQuestionPage(page)) kind = "question";
    else if (s.heading === "front" || s.toc >= 2) kind = "front_matter";
    else if (firstQuestionPage === undefined || page < firstQuestionPage)
      kind =
        page === pageNumbers[0] && s.chars < 600 ? "cover" : "front_matter";
    else kind = "unknown";

    if (firstQuestionPage !== undefined && page >= firstQuestionPage) {
      if (kind === "question") section = "questions";
      else if (kind === "answer_key") section = "key";
      else if (kind === "explanations") section = "explanations";
      else if (kind === "appendix") section = "appendix";
    }
    // Inside the question section, a page with no question structure at
    // all and little text (a section divider, a title page) is not part of
    // the stream — its title must not glue onto the previous question.
    const divider =
      kind === "unknown" &&
      s.starts === 0 &&
      s.options === 0 &&
      s.answers === 0 &&
      s.chars < 400;
    classes.push({
      page,
      kind,
      inQuestionSection:
        section === "questions" &&
        (kind === "question" || (kind === "unknown" && !divider)),
    });
  }
  return classes;
}

// ── 4. Answer keys & explanation sections ───────────────────────────────

const PACKED_KEY = /(\d{1,3})\s*[.)\-:]?\s*([A-Ha-h])(?![A-Za-z])/g;

// "1-B  2-C  3-A" on one line.
function parsePackedKey(line: string): AnswerKeyEntry[] {
  const text = toAsciiDigits(line);
  const entries = [...text.matchAll(PACKED_KEY)].map(m => ({
    number: Number(m[1]),
    answer: m[2],
  }));
  const leftover = text.replace(PACKED_KEY, "").replace(/[\s,;|]/g, "");
  return entries.length >= 2 && leftover.length <= 2 ? entries : [];
}

function parseKeyLines(lines: StreamLine[]): {
  entries: (AnswerKeyEntry & { index: number })[];
} {
  const entries: (AnswerKeyEntry & { index: number })[] = [];
  for (const line of lines) {
    const single = parseKeyEntry(line.text);
    if (single) {
      entries.push({ ...single, index: line.index });
      continue;
    }
    for (const entry of parsePackedKey(line.text)) {
      entries.push({ ...entry, index: line.index });
    }
  }
  return { entries };
}

// Numbered explanation entries ("12. B — because …" / "12. Because …").
function parseExplanationLines(lines: StreamLine[]) {
  const out = new Map<number, string[]>();
  let current: number | null = null;
  for (const line of lines) {
    const start = toAsciiDigits(line.text).match(LINE_QUESTION_NUMBER);
    if (start) {
      current = Number(start[1]);
      out.set(current, [
        line.text.replace(
          /^\s*(?:(?:question|q)\s*\.?\s*)?[\d٠-٩]{1,3}\s*[.):\-]\s+/i,
          ""
        ),
      ]);
    } else if (current !== null) {
      out.get(current)!.push(line.text);
    }
  }
  return out;
}

// Each answer-key block belongs to the run of questions right before it:
// a file whose sections each number from 1 keeps "1. B" with ITS question 1.
function applyAnswerKey(
  questions: ParsedQuestion[],
  key: (AnswerKeyEntry & { index: number })[]
) {
  if (!key.length) return;
  const runs: ParsedQuestion[][] = [];
  for (const question of questions) {
    const run = runs[runs.length - 1];
    if (!run || question.number <= run[run.length - 1].number) {
      runs.push([question]);
    } else run.push(question);
  }
  for (const entry of key) {
    const run =
      [...runs]
        .reverse()
        .find(
          r =>
            r[0].streamIndex < entry.index &&
            r.some(q => q.number === entry.number)
        ) ?? runs.find(r => r.some(q => q.number === entry.number));
    const question = run?.find(q => q.number === entry.number);
    if (!question || question.extractedAnswerText) continue;
    const answer = resolveAnswer(entry.answer, question.options ?? []);
    if (answer.index !== null) {
      question.extractedAnswerIndex = answer.index;
      question.extractedAnswerText = answer.text;
    }
  }
}

// ── 5. Validation ───────────────────────────────────────────────────────

// A stem that stops on one of these words was cut off.
const DANGLING_END =
  /\b(?:the|a|an|of|to|is|are|was|were|for|with|and|or|in|on|by|at|from|as|most|likely|which|following|that|this|these|than|be|been|has|have|following:)\s*$/i;

export function validateQuestion(
  question: ParsedQuestion,
  mcqDocument: boolean
): string[] {
  const reasons: string[] = [];
  const stem = question.questionText.trim();
  const letters = stem.replace(/[^\p{L}]/gu, "");
  const options = question.options ?? [];
  if (letters.length < 3) reasons.push("empty_or_fragment_stem");
  else if (!/[?؟:.)]\s*$/.test(stem) && DANGLING_END.test(stem)) {
    reasons.push("incomplete_stem");
  }
  if (/\b(?:correct answer|answer)\s*[:\-]\s*\(?[A-Ha-h]\b/i.test(stem)) {
    reasons.push("answer_inside_stem");
  }
  if (options.length === 1) reasons.push("single_option");
  if (options.length > 6) reasons.push("too_many_options");
  if (
    options.some(option => option.replace(/[^\p{L}\p{N}]/gu, "").length === 0)
  ) {
    reasons.push("empty_option");
  }
  if (
    options.some(option =>
      /\b(?:correct answer|answer|explanation|rationale)\s*[:\-]|^\s*note\b/i.test(
        option
      )
    )
  ) {
    reasons.push("answer_or_explanation_inside_option");
  }
  if (
    options.some(option =>
      /[.?!]\s+\d{1,3}\s*[.)]\s+(?:which|what|a|an|the|in|all|all of|how|why|when|where)\b/i.test(
        option
      )
    )
  ) {
    reasons.push("next_question_inside_option");
  }
  if (mcqDocument && options.length === 0) reasons.push("missing_options");
  if (question.flags.includes("option_sequence_broken") && options.length < 3) {
    reasons.push("options_out_of_order");
  }
  return reasons;
}

// ── 6. The whole analysis ───────────────────────────────────────────────

export function analyzeQuestionDocument(
  rawPages: Page[]
): QuestionDocumentAnalysis {
  const pages = [...rawPages].sort((a, b) => a.page - b.page);
  const cleaned = cleanPages(pages);
  const fullStream = relinePages(cleaned);
  const classes = classifyPages(
    fullStream,
    pages.map(p => p.page)
  );
  const classOf = new Map(classes.map(c => [c.page, c]));

  // The question stream: question-section pages only. Answer-key and
  // explanation pages are read separately, never parsed as questions.
  const keyLines: StreamLine[] = [];
  const explanationLines: StreamLine[] = [];
  const stream: StreamLine[] = [];
  let lineMode: "questions" | "key" | "explanations" = "questions";
  for (const line of fullStream) {
    const pageClass = classOf.get(line.page)!;
    if (pageClass.kind === "answer_key") {
      keyLines.push(line);
      continue;
    }
    if (pageClass.kind === "explanations") {
      explanationLines.push(line);
      continue;
    }
    if (!pageClass.inQuestionSection) continue;
    // A heading in the middle of a question page switches section.
    if (ANSWER_KEY_HEADING.test(line.text)) {
      lineMode = "key";
      continue;
    }
    if (EXPLANATIONS_HEADING.test(line.text)) {
      lineMode = "explanations";
      continue;
    }
    if (lineMode === "key") {
      if (parseKeyEntry(line.text) || parsePackedKey(line.text).length) {
        keyLines.push(line);
        continue;
      }
      lineMode = "questions";
    }
    if (lineMode === "explanations") {
      explanationLines.push(line);
      continue;
    }
    stream.push(line);
  }

  const inlineKey: (AnswerKeyEntry & { index: number })[] = [];
  const parsed = parseQuestionStream(stream, {
    onKeyEntry: (entry, index) => inlineKey.push({ ...entry, index }),
  });

  applyAnswerKey(parsed, [...parseKeyLines(keyLines).entries, ...inlineKey]);

  const explanations = parseExplanationLines(explanationLines);
  for (const question of parsed) {
    const extra = explanations.get(question.number);
    if (!extra || question.explanationText) continue;
    let text = extra.join(" ").trim();
    // "12. B — because …": the letter is the answer, the rest explains.
    const lead = text.match(/^\(?([A-Ha-h])\)?\s*[.)\-–—:]\s*(.*)$/);
    if (lead && !question.extractedAnswerText) {
      const answer = resolveAnswer(lead[1], question.options ?? []);
      if (answer.index !== null) {
        question.extractedAnswerIndex = answer.index;
        question.extractedAnswerText = answer.text;
        text = lead[2];
      }
    }
    if (text) question.explanationText = text;
  }

  const withOptions = parsed.filter(q => (q.options?.length ?? 0) >= 2).length;
  const mcqDocument = parsed.length > 0 && withOptions / parsed.length >= 0.6;

  const questions: ExtractedQuestionInput[] = [];
  const spans: { startPage: number; endPage: number }[] = [];
  const needsReview: NeedsReviewQuestion[] = [];
  const all: StoredQuestionInput[] = [];
  for (const question of parsed) {
    const reasons = validateQuestion(question, mcqDocument);
    const notes = question.notes.length ? question.notes.join("\n") : "";
    const stored: ExtractedQuestionInput = {
      orderIndex: all.length,
      questionText: question.questionText,
      options: question.options,
      extractedAnswerIndex: question.extractedAnswerIndex,
      extractedAnswerText: question.extractedAnswerText,
      // Notes stay text the file states, kept apart from the explanation
      // by a blank line (no separate column).
      explanationText:
        [question.explanationText, notes].filter(Boolean).join("\n\n") || null,
      sourcePage: question.sourcePage,
      questionTextAr: question.questionTextAr,
      optionsAr: question.optionsAr,
    };
    all.push({
      ...stored,
      reviewStatus: reasons.length ? "needs_review" : null,
      reviewReason: reasons.length ? reasons.join(",") : null,
    });
    if (reasons.length) {
      needsReview.push({
        number: question.number,
        sourcePage: question.sourcePage,
        reasons,
        excerpt: normalize(question.questionText).slice(0, 120),
      });
      continue;
    }
    questions.push({ ...stored, orderIndex: questions.length });
    spans.push({ startPage: question.sourcePage, endPage: question.endPage });
  }

  return { questions, needsReview, all, pages: classes, spans };
}
