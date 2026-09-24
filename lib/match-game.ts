// Quizlet-style "match" game (app/books/[bookId]/match): pure pair picking
// and tile shuffling, so the rules are unit-testable.

export type MatchPair = { id: string; prompt: string; answer: string };
export type MatchTile = {
  id: string;
  pairId: string;
  text: string;
  kind: "prompt" | "answer";
};

// Tiles are small squares — long card text doesn't fit, so only reasonably
// short questions/answers are used (terms fill in when cards are too long).
const MAX_PROMPT_CHARS = 90;
const MAX_ANSWER_CHARS = 70;

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

export function buildMatchPairs(
  cards: { id: string; questionEn: string; answerEn: string }[],
  terms: { id: string; en: string; ar: string }[],
  count = 6,
  random: () => number = Math.random
): MatchPair[] {
  const seen = new Set<string>();
  const pairs: MatchPair[] = [];
  const add = (id: string, prompt: string, answer: string) => {
    const key = prompt.toLowerCase();
    const answerKey = `a:${answer.toLowerCase()}`;
    if (!prompt || !answer || seen.has(key) || seen.has(answerKey)) return;
    seen.add(key);
    seen.add(answerKey);
    pairs.push({ id, prompt, answer });
  };
  for (const card of shuffle(cards, random)) {
    if (pairs.length >= count) break;
    const prompt = clean(card.questionEn);
    const answer = clean(card.answerEn);
    if (
      prompt.length <= MAX_PROMPT_CHARS &&
      answer.length <= MAX_ANSWER_CHARS
    ) {
      add(`card-${card.id}`, prompt, answer);
    }
  }
  for (const term of shuffle(terms, random)) {
    if (pairs.length >= count) break;
    const en = clean(term.en);
    const ar = clean(term.ar);
    if (en.length <= MAX_PROMPT_CHARS && ar.length <= MAX_ANSWER_CHARS) {
      add(`term-${term.id}`, en, ar);
    }
  }
  return pairs;
}

export function buildMatchTiles(
  pairs: MatchPair[],
  random: () => number = Math.random
): MatchTile[] {
  return shuffle(
    pairs.flatMap(pair => [
      {
        id: `${pair.id}:p`,
        pairId: pair.id,
        text: pair.prompt,
        kind: "prompt" as const,
      },
      {
        id: `${pair.id}:a`,
        pairId: pair.id,
        text: pair.answer,
        kind: "answer" as const,
      },
    ]),
    random
  );
}

// Two tapped tiles match when they're the two halves of the same pair.
export function isMatch(a: MatchTile, b: MatchTile): boolean {
  return a.pairId === b.pairId && a.id !== b.id;
}

// Each wrong match adds a one-second penalty, like Quizlet.
export const MISMATCH_PENALTY_MS = 1000;
