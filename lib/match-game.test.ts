import { describe, expect, it } from "vitest";
import { buildMatchPairs, buildMatchTiles, isMatch } from "./match-game";

const cards = Array.from({ length: 10 }, (_, i) => ({
  id: String(i),
  questionEn: `Question ${i}?`,
  answerEn: `Answer ${i}`,
}));

describe("match game", () => {
  it("builds 6 unique pairs and 12 shuffled tiles", () => {
    const pairs = buildMatchPairs(cards, [], 6);
    expect(pairs).toHaveLength(6);
    const tiles = buildMatchTiles(pairs);
    expect(tiles).toHaveLength(12);
    expect(new Set(tiles.map(t => t.id)).size).toBe(12);
  });

  it("skips cards too long for a tile and fills with terms", () => {
    const long = [{ id: "L", questionEn: "Q?", answerEn: "x".repeat(200) }];
    const terms = [
      { id: "t1", en: "Appendicitis", ar: "التهاب الزائدة" },
      { id: "t2", en: "Anemia", ar: "فقر الدم" },
    ];
    const pairs = buildMatchPairs(long, terms, 6);
    expect(pairs.map(p => p.answer)).toEqual(
      expect.arrayContaining(["التهاب الزائدة", "فقر الدم"])
    );
    expect(pairs.some(p => p.answer.length > 70)).toBe(false);
  });

  it("matches only the two halves of the same pair", () => {
    const [a, b] = buildMatchPairs(cards, [], 2);
    const tiles = buildMatchTiles([a, b]);
    const aPrompt = tiles.find(t => t.pairId === a.id && t.kind === "prompt")!;
    const aAnswer = tiles.find(t => t.pairId === a.id && t.kind === "answer")!;
    const bAnswer = tiles.find(t => t.pairId === b.id && t.kind === "answer")!;
    expect(isMatch(aPrompt, aAnswer)).toBe(true);
    expect(isMatch(aPrompt, bAnswer)).toBe(false);
    expect(isMatch(aPrompt, aPrompt)).toBe(false);
  });
});
