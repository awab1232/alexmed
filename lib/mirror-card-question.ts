// مِرآة flashcards keep a multiple-choice question as ONE text field
// ("…? A. x B. y C. z D. w", on one line or one option per line) and the
// answer as free text ("B. y", "B - y", or just "y"). The question card shows
// the options as tappable choices, so this finds them — at display time
// only; nothing stored changes, and a card this can't parse is shown as it
// always was.
//
// Every piece is returned as a [start, end) range into the ORIGINAL string,
// because card marks (lib/card-marks.ts) store highlights as offsets into
// the whole field: rendering each piece with its range keeps every existing
// highlight exactly where it was.

export type TextRange = { start: number; end: number };

export type ParsedCardQuestion = {
  // The stem, without a leading "12." and without the options.
  stem: TextRange;
  // In order A, B, C… (or أ، ب، ج… / ١، ٢، ٣…); empty = not a parseable MCQ.
  options: TextRange[];
};

// Up to H (some banks have 6+ choices); "A." "A)" "(A)" "A:".
const LATIN_MARKER = /(^|\s)\(?([A-Ha-h])\s?[.):]\s+/g;
const ARABIC_MARKER = /(^|\s)\(?([أاإبجدهوزح]|[١-٨])\s?[.)\-:]\s+/g;
const ANSWER_TAIL =
  /\s*(?:correct answer|answer|ans|الإجابة الصحيحة|الإجابة|الجواب)\s*[:\-][^\n]*$/i;
const NUMBER_PREFIX = /^\s*[\d٠-٩]{1,3}\s*[.)\-]\s+/;

const LATIN_ORDER = "abcdefgh";
// أ ب ج د هـ و ز ح — the Arabic (abjad) option order.
const ARABIC_ORDER: Record<string, number> = {
  أ: 0,
  ا: 0,
  إ: 0,
  ب: 1,
  ج: 2,
  د: 3,
  ه: 4,
  و: 5,
  ز: 6,
  ح: 7,
  "١": 0,
  "٢": 1,
  "٣": 2,
  "٤": 3,
  "٥": 4,
  "٦": 5,
  "٧": 6,
  "٨": 7,
};

type Marker = { order: number; markerStart: number; textStart: number };

function findMarkers(text: string, arabic: boolean): Marker[] {
  const pattern = new RegExp(
    (arabic ? ARABIC_MARKER : LATIN_MARKER).source,
    "g"
  );
  const markers: Marker[] = [];
  for (const match of text.matchAll(pattern)) {
    const letter = match[2];
    const order = arabic
      ? ARABIC_ORDER[letter]
      : LATIN_ORDER.indexOf(letter.toLowerCase());
    if (order === undefined || order < 0) continue;
    const markerStart = match.index! + match[1].length;
    markers.push({
      order,
      markerStart,
      textStart: match.index! + match[0].length,
    });
  }
  return markers;
}

// The first run of markers that counts A, B, C… from A (at least two
// options) — so an "A." inside the stem ("vitamin A. …") without a B after
// it never splits anything.
function optionChain(markers: Marker[]): Marker[] {
  for (let i = 0; i < markers.length; i++) {
    if (markers[i].order !== 0) continue;
    const chain = [markers[i]];
    for (let j = i + 1; j < markers.length; j++) {
      if (markers[j].order === chain.length) chain.push(markers[j]);
    }
    if (chain.length >= 2) return chain;
  }
  return [];
}

function trimRange(text: string, start: number, end: number): TextRange {
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return { start, end };
}

export function parseCardQuestion(
  text: string,
  { arabic = false }: { arabic?: boolean } = {}
): ParsedCardQuestion {
  const prefix = text.match(NUMBER_PREFIX);
  const stemStart = prefix ? prefix[0].length : 0;
  const chain = optionChain(
    findMarkers(text, arabic).filter(m => m.markerStart >= stemStart)
  );
  if (!chain.length) {
    return { stem: trimRange(text, stemStart, text.length), options: [] };
  }
  const options = chain.map((marker, i) => {
    let end = i + 1 < chain.length ? chain[i + 1].markerStart : text.length;
    // "… D. last option. Answer: B." — the answer is never option text.
    if (i === chain.length - 1) {
      const tail = text.slice(marker.textStart, end).match(ANSWER_TAIL);
      if (tail && tail.index !== undefined) end = marker.textStart + tail.index;
    }
    return trimRange(text, marker.textStart, end);
  });
  return {
    stem: trimRange(text, stemStart, chain[0].markerStart),
    options: options.filter(range => range.end > range.start),
  };
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,;:!?()"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Which option the card's answer names: its letter ("B.", "B -", "(b)"), an
// "Answer: B" inside the question, or its exact text. null when unsure —
// the card then just shows the answer as before, without judging a pick.
export function resolveCardAnswer(
  answer: string,
  question: string,
  options: string[]
): number | null {
  if (!options.length) return null;
  const letter = answer.match(/^\s*\(?([A-Ha-h])\s*\)?\s*(?:[.)\-:]|$)/);
  if (letter) {
    const index = LATIN_ORDER.indexOf(letter[1].toLowerCase());
    if (index < options.length) return index;
  }
  const inline = question.match(
    /(?:correct answer|answer|ans)\s*[:\-]\s*\(?([A-Ha-h])\b/i
  );
  if (inline) {
    const index = LATIN_ORDER.indexOf(inline[1].toLowerCase());
    if (index < options.length) return index;
  }
  const wanted = normalize(answer);
  if (!wanted) return null;
  const exact = options.findIndex(option => normalize(option) === wanted);
  if (exact !== -1) return exact;
  const containing = options
    .map((option, index) => ({ index, text: normalize(option) }))
    .filter(
      option =>
        option.text.length >= 3 &&
        (wanted.includes(option.text) || option.text.includes(wanted))
    );
  return containing.length === 1 ? containing[0].index : null;
}
