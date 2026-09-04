import { describe, expect, it } from "vitest";
import {
  chunkChapterPages,
  mergeSubChunkResults,
  parseChapterAnalysis,
  type BookChapterAnalysis,
  type BookPageInput,
} from "./book-analysis";

function makePages(count: number): BookPageInput[] {
  return Array.from({ length: count }, (_, i) => ({
    page: i + 1,
    text: `Page ${i + 1} text.`,
  }));
}

function makeAnalysis(
  overrides: Partial<BookChapterAnalysis> = {}
): BookChapterAnalysis {
  return {
    explanationAr: "شرح",
    explanationEn: "explanation",
    keyPoints: ["point"],
    medicalTerms: [{ ar: "مصطلح", en: "term", pronunciation: "TUR-m" }],
    flashcards: [
      {
        questionAr: "سؤال",
        questionEn: "question",
        answerAr: "جواب",
        answerEn: "answer",
        relatedTermEn: "term",
        sourcePage: 1,
      },
    ],
    mcqs: [
      {
        questionEn: "mcq",
        choices: ["a", "b", "c", "d"],
        correctIndex: 0,
        explanationEn: "why",
        sourcePage: 1,
      },
    ],
    chapterSummary: "summary",
    ...overrides,
  };
}

describe("chunkChapterPages", () => {
  it("returns a single chunk for a chapter within the max page count", () => {
    const chunks = chunkChapterPages(makePages(5), 8);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(5);
  });

  it("splits a longer chapter into consecutive sub-chunks", () => {
    const chunks = chunkChapterPages(makePages(20), 8);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].map(p => p.page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(chunks[1].map(p => p.page)).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
    expect(chunks[2].map(p => p.page)).toEqual([17, 18, 19, 20]);
  });

  it("returns an empty array for no pages", () => {
    expect(chunkChapterPages([])).toEqual([]);
  });
});

describe("mergeSubChunkResults", () => {
  it("concatenates arrays and joins explanations across sub-chunks", () => {
    const first = makeAnalysis({
      explanationAr: "الجزء الأول",
      explanationEn: "part one",
      chapterSummary: "summary one",
    });
    const second = makeAnalysis({
      explanationAr: "الجزء الثاني",
      explanationEn: "part two",
      chapterSummary: "summary two",
    });

    const merged = mergeSubChunkResults([first, second]);

    expect(merged.explanationAr).toBe("الجزء الأول\n\nالجزء الثاني");
    expect(merged.explanationEn).toBe("part one\n\npart two");
    expect(merged.keyPoints).toHaveLength(2);
    expect(merged.medicalTerms).toHaveLength(2);
    expect(merged.flashcards).toHaveLength(2);
    expect(merged.mcqs).toHaveLength(2);
    expect(merged.summaries).toEqual(["summary one", "summary two"]);
  });

  it("passes a single sub-chunk's content through unchanged in shape", () => {
    const only = makeAnalysis();
    const merged = mergeSubChunkResults([only]);

    expect(merged.explanationAr).toBe(only.explanationAr);
    expect(merged.summaries).toEqual([only.chapterSummary]);
  });
});

describe("parseChapterAnalysis", () => {
  it("parses a plain JSON string response", () => {
    const analysis = makeAnalysis();
    const result = parseChapterAnalysis(JSON.stringify(analysis));
    expect(result).toEqual(analysis);
  });

  it("strips markdown fences before parsing", () => {
    const analysis = makeAnalysis();
    const fenced = "```json\n" + JSON.stringify(analysis) + "\n```";
    const result = parseChapterAnalysis(fenced);
    expect(result).toEqual(analysis);
  });
});
