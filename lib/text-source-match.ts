// Finds where a flashcard/MCQ answer likely came from inside its source
// page's extracted text, so the reader can highlight it the way it
// highlights a student's own annotations (components/BookPageViewer.tsx's
// `highlights` prop). No new column/migration for this — bookCards/bookMcqs
// only ever stored `sourcePage` (see drizzle/schema.ts), never a character
// range, so this is computed at read time from text already on hand instead
// of requiring a backfill.
//
// The answer is LLM-generated, not a literal excerpt, so an exact substring
// match is the lucky case, not the common one. This falls back through
// progressively looser strategies and returns null rather than a
// low-confidence guess — a page-only jump with no highlight is honest;
// highlighting the wrong sentence is not.

export type SourceHighlightRange = { start: number; end: number };

const MIN_SENTENCE_MATCH_LENGTH = 15;
const MIN_FUZZY_MATCH_LENGTH = 20;

function normalizeForCompare(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

// Case-insensitive indexOf that returns offsets valid for slicing the
// ORIGINAL (non-lowercased) haystack — only the comparison is case-folded.
function findCaseInsensitive(
  haystack: string,
  needle: string
): SourceHighlightRange | null {
  const index = haystack.toLowerCase().indexOf(needle.toLowerCase());
  if (index === -1) return null;
  return { start: index, end: index + needle.length };
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.؟?!])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

// Longest common substring between needle and haystack, case-insensitive.
// Both inputs are bounded (a single page's text, a single answer field), so
// the O(n*m) DP table is small in practice (low thousands of cells at most).
function longestCommonSubstring(
  haystack: string,
  needle: string
): SourceHighlightRange | null {
  const a = haystack.toLowerCase();
  const b = needle.toLowerCase();
  if (!a.length || !b.length) return null;

  let bestLength = 0;
  let bestEndInHaystack = 0;
  let previousRow = new Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    const currentRow = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        currentRow[j] = previousRow[j - 1] + 1;
        if (currentRow[j] > bestLength) {
          bestLength = currentRow[j];
          bestEndInHaystack = i;
        }
      }
    }
    previousRow = currentRow;
  }

  if (bestLength < MIN_FUZZY_MATCH_LENGTH) return null;
  return { start: bestEndInHaystack - bestLength, end: bestEndInHaystack };
}

// Tries, in order: the whole needle verbatim, each of its sentences
// verbatim (longest first, so a card's more distinctive claim wins over a
// short lead-in clause), then a fuzzy longest-common-substring fallback.
// Returns null when nothing crosses the confidence bar rather than
// highlighting a coincidental short overlap.
export function findSourceHighlight(
  pageText: string | null | undefined,
  answerText: string | null | undefined
): SourceHighlightRange | null {
  if (!pageText || !answerText) return null;
  const needle = normalizeForCompare(answerText);
  if (!needle) return null;

  const wholeMatch = findCaseInsensitive(pageText, answerText.trim());
  if (wholeMatch) return wholeMatch;

  const sentences = splitSentences(answerText)
    .filter(sentence => sentence.length >= MIN_SENTENCE_MATCH_LENGTH)
    .sort((a, b) => b.length - a.length);
  for (const sentence of sentences) {
    const match = findCaseInsensitive(pageText, sentence);
    if (match) return match;
  }

  return longestCommonSubstring(pageText, answerText);
}
