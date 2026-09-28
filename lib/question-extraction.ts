// Real, non-AI extraction of pre-existing questions from a "question_file"
// book's own text (PR16) — this is regex/heuristic parsing of the literal
// PDF content, never an LLM call, and never invents an answer the source
// doesn't state. A field the parser can't confidently identify is left
// null rather than guessed — see extractedQuestions' schema comment for why
// that distinction (extracted vs. AI-inferred) matters.
//
// Bilingual files: many question banks follow each English question with
// its Arabic version (question, then أ/ب/ج/د or ١/٢/٣/٤ options, then
// "الإجابة: ب"). The Arabic is split out the same way as the English —
// questionTextAr + optionsAr, in the same order as the English options —
// and its answer line only ever feeds the answer, never the text. Without
// this, an Arabic block numbered like the English one ("1. ...") used to
// be read as a separate, duplicate question.
export type ExtractedQuestionInput = {
  orderIndex: number;
  questionText: string;
  options: string[] | null;
  extractedAnswerIndex: number | null;
  extractedAnswerText: string | null;
  explanationText: string | null;
  sourcePage: number;
  // The file's own Arabic version, when it has one (null otherwise).
  // optionsAr is only set when it lines up 1:1 with `options`.
  questionTextAr: string | null;
  optionsAr: string[] | null;
};

const QUESTION_START = /^\s*(\d{1,3})[.)]\s+(.+)$/;
const OPTION_LINE = /^\s*([A-Da-d])[.)]\s+(.+)$/;
const ANSWER_LINE =
  /^\s*(?:correct answer|answer|ans|الإجابة الصحيحة|الإجابة|الجواب)\s*[:\-]\s*(.+)$/i;
const EXPLANATION_LINE =
  /^\s*(?:explanation|rationale|why|التفسير|الشرح|السبب)\s*[:\-]\s*(.+)$/i;
// An Arabic option: a letter (أ ا إ ب ج د ه), an Arabic-Indic or Latin digit,
// or A–D, followed by a separator — "أ. …", "(ب) …", "٣- …", "1) …".
const ARABIC_OPTION_LINE =
  /^\s*\(?([أاإبجده]|[١-٥]|[1-5]|[A-Ea-e])\)?\s*[.)\-:ـ]?\s+(.+)$/;
// "… الإجابة: ب" at the END of an Arabic line (some files put it inline).
const INLINE_ARABIC_ANSWER =
  /\s*(?:الإجابة الصحيحة|الإجابة|الجواب)\s*[:\-]\s*(\(?[أاإبجدA-Da-d١-٤1-4]\)?\.?)\s*$/;

const ARABIC_LETTER_TO_INDEX: Record<string, number> = {
  أ: 0,
  ا: 0,
  إ: 0,
  ب: 1,
  ج: 2,
  د: 3,
  ه: 4,
};
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function toAsciiDigits(text: string): string {
  return text.replace(/[٠-٩]/g, d => String(ARABIC_INDIC_DIGITS.indexOf(d)));
}

function letterToIndex(letter: string): number | null {
  const trimmed = toAsciiDigits(letter.trim());
  const upper = trimmed.toUpperCase();
  if (upper.length === 1 && upper >= "A" && upper <= "D") {
    return upper.charCodeAt(0) - "A".charCodeAt(0);
  }
  if (/^[1-4]$/.test(trimmed)) return Number(trimmed) - 1;
  const arabic = ARABIC_LETTER_TO_INDEX[trimmed];
  return arabic ?? null;
}

const ARABIC_CHAR = /[؀-ۿ]/g;
const LATIN_CHAR = /[A-Za-z]/g;

// Mostly-Arabic text (English medical terms inside an Arabic sentence don't
// make it English).
export function isArabicText(text: string): boolean {
  const arabic = text.match(ARABIC_CHAR)?.length ?? 0;
  const latin = text.match(LATIN_CHAR)?.length ?? 0;
  return arabic > 0 && arabic >= latin;
}

// The first real letter after an optional "12." / "A)" / "(ب)" marker.
function startsInArabic(line: string): boolean {
  const body = line.replace(/^\s*\(?[\dA-Za-z٠-٩]{1,3}\)?[.)\-:]\s*/, "");
  const first = body.match(/[A-Za-z؀-ۿ]/);
  return !!first && /[؀-ۿ]/.test(first[0]);
}

// "Radial nerve العصب الكعبري" → { en: "Radial nerve", ar: "العصب الكعبري" }
// when an English line carries its Arabic translation at the end.
function splitBilingual(text: string): { en: string; ar: string | null } {
  const firstArabic = text.search(/[؀-ۿ]/);
  if (firstArabic <= 0) return { en: text, ar: null };
  // Cut right after the last English word before the Arabic starts, so
  // numbers / punctuation that open the Arabic part ("٦٠-١٠٠", "20-40")
  // stay with it: "20-40 bpm 20-40 نبضة" → "20-40 bpm" | "20-40 نبضة".
  const beforeArabic = text.slice(0, firstArabic);
  const lastLatin = beforeArabic.search(/[A-Za-z][^A-Za-z]*$/);
  if (lastLatin < 0) return { en: text, ar: null };
  const wordEnd = beforeArabic.slice(lastLatin).search(/\s/);
  const cut = wordEnd < 0 ? firstArabic : lastLatin + wordEnd;
  const en = text
    .slice(0, cut)
    .replace(/[\s/|–—-]+$/, "")
    .trim();
  const ar = text
    .slice(cut)
    .replace(/^[\s/|–—-]+/, "")
    .trim();
  if ((en.match(LATIN_CHAR)?.length ?? 0) < 2 || !isArabicText(ar)) {
    return { en: text, ar: null };
  }
  return { en, ar };
}

// Resolves an answer line's free-text value against this question's own
// option list first (handles "Answer: B", "Answer: (B)", "الإجابة: ب", and
// the fairly common "Answer: <the full option text>" all at once); falls
// back to keeping the raw text with no index when neither matches, rather
// than guessing.
function resolveAnswer(
  raw: string,
  options: string[]
): { index: number | null; text: string } {
  const trimmed = raw.trim();
  const letterMatch = trimmed.match(/^\(?([A-Da-dأاإبجد١-٤])\)?\.?$/);
  if (letterMatch) {
    const index = letterToIndex(letterMatch[1]);
    if (index !== null && index < options.length) {
      return { index, text: options[index] };
    }
  }
  const byText = options.findIndex(
    option => option.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (byText !== -1) return { index: byText, text: options[byText] };
  return { index: null, text: trimmed };
}

// pages must already be real extracted/OCR'd text (same pipeline books use
// today — see app/api/books/extract-questions/route.ts) — this function is
// pure text parsing, no I/O.
export function extractQuestionsFromPages(
  pages: { page: number; text: string }[]
): ExtractedQuestionInput[] {
  const results: ExtractedQuestionInput[] = [];
  let orderIndex = 0;

  type Draft = {
    number: number;
    questionLines: string[];
    options: string[];
    answerRaw: string | null;
    // An Arabic answer line only counts when the English gave none.
    answerFromArabic: boolean;
    explanationLines: string[];
    sourcePage: number;
    // The question itself is Arabic (an Arabic-only file): its Arabic
    // options are the options, and there's nothing to translate.
    primaryArabic: boolean;
    arQuestionLines: string[];
    arOptions: string[];
    // Arabic carried at the end of English option lines.
    inlineArOptions: string[];
    // Inside the Arabic block that follows the English one.
    inArabicBlock: boolean;
  };
  let draft: Draft | null = null;
  let mode: "question" | "explanation" = "question";

  function flush() {
    if (!draft) return;
    const questionText = draft.questionLines.join(" ").trim();
    if (questionText) {
      const options = draft.options.length ? draft.options : null;
      const answer = draft.answerRaw
        ? resolveAnswer(draft.answerRaw, draft.options)
        : null;
      const arText = draft.arQuestionLines.join(" ").trim();
      const arOptionsSource = draft.arOptions.length
        ? draft.arOptions
        : draft.inlineArOptions;
      results.push({
        orderIndex: orderIndex++,
        questionText,
        options,
        extractedAnswerIndex: answer?.index ?? null,
        extractedAnswerText: answer ? answer.text : null,
        explanationText: draft.explanationLines.length
          ? draft.explanationLines.join(" ").trim()
          : null,
        sourcePage: draft.sourcePage,
        questionTextAr: draft.primaryArabic ? null : arText || null,
        optionsAr:
          !draft.primaryArabic &&
          options &&
          arOptionsSource.length === options.length
            ? arOptionsSource
            : null,
      });
    }
    draft = null;
    mode = "question";
  }

  function setAnswer(raw: string, fromArabic: boolean) {
    if (!draft) return;
    // The English answer always wins; an Arabic one only fills a gap.
    if (fromArabic && draft.answerRaw && !draft.answerFromArabic) return;
    draft.answerRaw = raw.trim();
    draft.answerFromArabic = fromArabic;
  }

  for (const { page, text } of pages) {
    const lines = text.split("\n");
    for (const rawLine of lines) {
      let line = rawLine.trim();
      if (!line) continue;
      // Inside Arabic text, English terms don't make a line English. Outside
      // it, a line is only Arabic when it STARTS in Arabic (after its number
      // or letter marker) — "A. 60-100 bpm ٦٠-١٠٠ نبضة" is an English option
      // carrying its translation, not an Arabic line.
      const current = draft as Draft | null;
      const arabic: boolean =
        isArabicText(line) &&
        (!!current?.inArabicBlock ||
          !!current?.primaryArabic ||
          startsInArabic(line));

      // "… الإجابة: ب" at the end of an Arabic line: answer only, never text.
      if (arabic && draft) {
        const inline = line.match(INLINE_ARABIC_ANSWER);
        if (inline && inline.index && inline.index > 0) {
          setAnswer(inline[1].replace(/[().]/g, ""), true);
          line = line.slice(0, inline.index).trim();
          if (!line) continue;
        }
      }

      const questionStart = toAsciiDigits(line).match(QUESTION_START);
      if (questionStart) {
        const number = Number(questionStart[1]);
        const body = line.replace(/^\s*[\d٠-٩]{1,3}[.)]\s+/, "").trim();
        // Inside the Arabic block, "1. … 2. … 3. …" counting up from the
        // options already seen are its numbered OPTIONS, not new questions.
        if (
          arabic &&
          draft?.inArabicBlock &&
          number === draft.arOptions.length + 1 &&
          number <= 5
        ) {
          draft.arOptions.push(body);
          mode = "question";
          continue;
        }
        // An Arabic block right after an English question — numbered the
        // same, or restarting the count — is that question's translation,
        // not a new question.
        if (
          arabic &&
          draft &&
          !draft.primaryArabic &&
          draft.questionLines.length &&
          !draft.inArabicBlock &&
          (draft.options.length > 0 || draft.answerRaw !== null) &&
          (number === draft.number || number === 1)
        ) {
          draft.inArabicBlock = true;
          draft.arQuestionLines = [body];
          mode = "question";
          continue;
        }
        flush();
        const split: { en: string; ar: string | null } = arabic
          ? { en: body, ar: null }
          : splitBilingual(body);
        draft = {
          number,
          questionLines: [split.en],
          options: [],
          answerRaw: null,
          answerFromArabic: false,
          explanationLines: [],
          sourcePage: page,
          primaryArabic: arabic,
          arQuestionLines: split.ar ? [split.ar] : [],
          arOptions: [],
          inlineArOptions: [],
          inArabicBlock: false,
        };
        mode = "question";
        continue;
      }
      if (!draft) continue; // Text before the first detected question — skip.

      const answerMatch = line.match(ANSWER_LINE);
      if (answerMatch) {
        setAnswer(answerMatch[1], arabic || /^\s*ال/.test(line));
        mode = "question";
        continue;
      }

      const explanationMatch = line.match(EXPLANATION_LINE);
      if (explanationMatch) {
        draft.explanationLines.push(explanationMatch[1].trim());
        mode = "explanation";
        continue;
      }

      // Arabic options: of an Arabic-only question, or of the Arabic block.
      if (arabic && (draft.primaryArabic || draft.inArabicBlock)) {
        const arOption = toAsciiDigits(line).match(ARABIC_OPTION_LINE);
        const target = draft.primaryArabic ? draft.options : draft.arOptions;
        if (arOption && isArabicText(arOption[2])) {
          target.push(
            line
              .replace(
                /^\s*\(?([أاإبجده]|[١-٥]|[1-5]|[A-Ea-e])\)?\s*[.)\-:ـ]?\s+/,
                ""
              )
              .trim()
          );
          mode = "question";
          continue;
        }
      }

      const optionMatch = !arabic ? line.match(OPTION_LINE) : null;
      if (optionMatch) {
        const { en, ar } = splitBilingual(optionMatch[2].trim());
        draft.options.push(en);
        if (ar) draft.inlineArOptions.push(ar);
        mode = "question";
        continue;
      }

      // A continuation line with no marker of its own — attach it to
      // whichever section we most recently saw (question stem, wrapped
      // across lines, or a multi-line explanation).
      if (mode === "explanation") {
        draft.explanationLines.push(line);
        continue;
      }
      if (arabic && !draft.primaryArabic) {
        if (draft.inArabicBlock) {
          if (draft.arOptions.length === 0) draft.arQuestionLines.push(line);
          else draft.arOptions[draft.arOptions.length - 1] += ` ${line}`;
        } else if (draft.options.length > 0 || draft.answerRaw !== null) {
          // An unnumbered Arabic block after the English options/answer.
          draft.inArabicBlock = true;
          draft.arQuestionLines = [line];
        } else {
          // The Arabic stem sitting between the English stem and options.
          draft.arQuestionLines.push(line);
        }
        continue;
      }
      if (draft.options.length === 0) {
        if (draft.primaryArabic) {
          draft.questionLines.push(line);
        } else {
          const { en, ar } = splitBilingual(line);
          draft.questionLines.push(en);
          if (ar) draft.arQuestionLines.push(ar);
        }
      }
    }
  }
  flush();

  return results;
}
