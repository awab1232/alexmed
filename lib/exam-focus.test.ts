import { describe, expect, it, vi } from "vitest";
import {
  EXAM_FOCUS_UNIT_MAX_PAGES,
  composeExamFocusDeck,
  dedupeFacts,
  extractExamFocusUnit,
  orderFacts,
  parseExamFocusExtraction,
  planExamFocusUnits,
  uncoveredUnitPages,
  validateExamFocusCoverage,
  withVisualDescriptions,
  type ExamFocusFact,
  type ExamFocusLlm,
  type OrderedFact,
} from "./exam-focus";
import {
  fortyPageTexts,
  LATE_PAGE_FACTS,
} from "./test-fixtures/forty-page-medical-pdf";

const fact = (overrides: Partial<OrderedFact> = {}): OrderedFact => ({
  category: "high_yield",
  topic: "Chemical injury",
  title: "Alkali burns",
  points: ["Alkali burns are more dangerous than acid burns"],
  highlightLabel: "",
  highlightText: "",
  flag: "",
  sourcePages: [1],
  unitIndex: 0,
  ...overrides,
});

const fortyPages = () =>
  fortyPageTexts().map((text, i) => ({ page: i + 1, text }));

// Stand-in model that behaves like a well-behaved extractor: one card per
// [PAGE n] block with real content (built from that page's own text),
// pages under 80 chars declared empty. Runs the whole pipeline with no AI.
const echoLlm: ExamFocusLlm = async ({ messages }) => {
  const user = messages[messages.length - 1].content as string;
  const blocks = [
    ...user.matchAll(/\[PAGE (\d+)\]\n([\s\S]*?)(?=\n\n\[PAGE |$)/g),
  ];
  const cards = blocks
    .filter(([, , text]) => text.trim().length >= 80)
    .map(([, page, text]) => {
      const sentences = text
        .replace(/\s+/g, " ")
        .trim()
        .split(/(?<=\.)\s+/);
      return {
        category: "high_yield",
        topic: "",
        title: sentences[0],
        points: sentences.slice(1).length ? sentences.slice(1) : sentences,
        highlightLabel: "",
        highlightText: "",
        flag: "",
        sourcePages: [Number(page)],
      };
    });
  const empty = blocks
    .filter(([, , text]) => text.trim().length < 80)
    .map(([, page]) => Number(page));
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({ cards, pagesWithoutExamContent: empty }),
        },
      },
    ],
  };
};

describe("planExamFocusUnits — whole-file coverage", () => {
  it("puts every page of a 40-page file into a unit, in order", () => {
    const units = planExamFocusUnits(fortyPages());
    const pages = units.flatMap(unit => unit.pageTexts.map(p => p.page));
    expect(new Set(pages)).toEqual(
      new Set(Array.from({ length: 40 }, (_, i) => i + 1))
    );
    expect(units[0].pageStart).toBe(1);
    expect(units[units.length - 1].pageEnd).toBe(40);
    for (const unit of units) {
      expect(new Set(unit.pageTexts.map(p => p.page)).size).toBeLessThanOrEqual(
        EXAM_FOCUS_UNIT_MAX_PAGES
      );
    }
    expect(units.map(unit => unit.unitIndex)).toEqual(units.map((_, i) => i));
  });

  it("skips empty pages instead of sending them to the model", () => {
    const units = planExamFocusUnits([
      { page: 1, text: "Real content page about sepsis management." },
      { page: 2, text: "   " },
    ]);
    expect(units.flatMap(u => u.pageTexts.map(p => p.page))).toEqual([1]);
  });

  it("handles a file with no chapter headings (plain text only)", () => {
    const pages = Array.from({ length: 13 }, (_, i) => ({
      page: i + 1,
      text: "plain paragraph without any heading ".repeat(20),
    }));
    const units = planExamFocusUnits(pages);
    expect(units.length).toBeGreaterThanOrEqual(3);
    expect(units[units.length - 1].pageEnd).toBe(13);
  });

  it("appends table/figure descriptions so visual-only facts are extracted", () => {
    const [page] = withVisualDescriptions(
      [{ page: 3, text: "Grading of chemical injury." }],
      [
        {
          pageNumber: 3,
          assetType: "table",
          descriptionEn: "Grade 1 → excellent prognosis; Grade 4 → poor",
        },
        { pageNumber: 9, assetType: "figure", descriptionEn: "other page" },
      ]
    );
    expect(page.text).toContain("[VISUAL table — page 3]");
    expect(page.text).toContain("Grade 4 → poor");
    expect(page.text).not.toContain("other page");
  });
});

describe("parseExamFocusExtraction — grounding", () => {
  it("normalises string page numbers and unknown categories", () => {
    const result = parseExamFocusExtraction(
      JSON.stringify({
        cards: [
          {
            category: "made_up",
            topic: " Sepsis ",
            title: "qSOFA",
            points: ["RR ≥ 22", "", "SBP ≤ 100"],
            highlightLabel: "KEY NUMBER",
            highlightText: "2 of 3 criteria",
            flag: "",
            sourcePages: ["5"],
          },
        ],
        pagesWithoutExamContent: [4, 99],
      }),
      [4, 5, 6]
    );
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]).toMatchObject({
      category: "high_yield",
      topic: "Sepsis",
      points: ["RR ≥ 22", "SBP ≤ 100"],
      sourcePages: [5],
    });
    expect(result.pagesWithoutExamContent).toEqual([4]);
  });

  it("drops a card cited only outside its unit (never guesses a page)", () => {
    const result = parseExamFocusExtraction(
      JSON.stringify({
        cards: [
          { ...fact(), sourcePages: [42] },
          { ...fact({ title: "Kept" }), sourcePages: [5] },
        ],
        pagesWithoutExamContent: [],
      }),
      [4, 5, 6]
    );
    expect(result.facts.map(f => f.title)).toEqual(["Kept"]);
    expect(result.droppedUngrounded).toBe(1);
  });

  it("repairs a missing citation in a single-page unit", () => {
    const result = parseExamFocusExtraction(
      JSON.stringify({
        cards: [{ ...fact(), sourcePages: [] }],
        pagesWithoutExamContent: [],
      }),
      [7]
    );
    expect(result.facts[0].sourcePages).toEqual([7]);
  });

  it("throws on a non-JSON answer so the unit is retried", () => {
    expect(() => parseExamFocusExtraction("Sorry, I can't.", [1])).toThrow();
  });
});

describe("extractExamFocusUnit — per-unit retries", () => {
  const pages = [
    { page: 1, text: "A".repeat(120) },
    { page: 2, text: "B".repeat(120) },
  ];
  const answer = (cards: unknown[], empty: number[] = []) => ({
    choices: [
      {
        message: {
          content: JSON.stringify({ cards, pagesWithoutExamContent: empty }),
        },
      },
    ],
  });

  it("asks again about exactly the pages the first pass skipped", async () => {
    const llm = vi
      .fn<ExamFocusLlm>()
      .mockResolvedValueOnce(answer([{ ...fact(), sourcePages: [1] }]))
      .mockResolvedValueOnce(
        answer([{ ...fact({ title: "Page 2 fact" }), sourcePages: [2] }])
      );
    const result = await extractExamFocusUnit({
      fileName: "f.pdf",
      unitIndex: 0,
      totalUnits: 1,
      pageTexts: pages,
      llm,
    });
    expect(llm).toHaveBeenCalledTimes(2);
    const followUp = llm.mock.calls[1][0].messages[1].content as string;
    expect(followUp).toContain("[PAGE 2]");
    expect(followUp).not.toContain("[PAGE 1]");
    expect(result.facts.map(f => f.sourcePages[0])).toEqual([1, 2]);
    expect(result.uncoveredPages).toEqual([]);
  });

  it("keeps the first pass when the follow-up fails, reporting the gap", async () => {
    const llm = vi
      .fn<ExamFocusLlm>()
      .mockResolvedValueOnce(answer([{ ...fact(), sourcePages: [1] }]))
      .mockRejectedValueOnce(new Error("provider down"));
    const result = await extractExamFocusUnit({
      fileName: "f.pdf",
      unitIndex: 0,
      totalUnits: 1,
      pageTexts: pages,
      llm,
    });
    expect(result.facts).toHaveLength(1);
    expect(result.uncoveredPages).toEqual([2]);
  });

  it("throws when the first call fails (the worker retries the unit)", async () => {
    const llm = vi.fn<ExamFocusLlm>().mockRejectedValue(new Error("502"));
    await expect(
      extractExamFocusUnit({
        fileName: "f.pdf",
        unitIndex: 0,
        totalUnits: 1,
        pageTexts: pages,
        llm,
      })
    ).rejects.toThrow("502");
  });

  it("never asks the model for a card count", async () => {
    const llm = vi
      .fn<ExamFocusLlm>()
      .mockResolvedValue(answer([{ ...fact(), sourcePages: [1, 2] }]));
    await extractExamFocusUnit({
      fileName: "f.pdf",
      unitIndex: 0,
      totalUnits: 1,
      pageTexts: pages,
      llm,
    });
    const system = llm.mock.calls[0][0].messages[0].content as string;
    expect(system).toMatch(/NO target number/);
    expect(system).not.toMatch(/generate \d+ cards/i);
  });
});

describe("dedupeFacts", () => {
  it("merges the same fact worded differently, keeping pages and urgency", () => {
    const { facts, removed } = dedupeFacts([
      fact({ sourcePages: [3] }),
      fact({
        title: "Alkaline burns",
        points: ["Alkaline burns are more dangerous than acid burns"],
        sourcePages: [12],
        category: "emergency",
        unitIndex: 2,
      }),
    ]);
    expect(removed).toBe(1);
    expect(facts).toHaveLength(1);
    expect(facts[0].sourcePages).toEqual([3, 12]);
    expect(facts[0].category).toBe("emergency");
    expect(facts[0].unitIndex).toBe(0);
  });

  it("keeps the more detailed card when one contains the other", () => {
    const { facts } = dedupeFacts([
      fact({
        title: "Irrigation",
        points: ["Copious irrigation is the first treatment"],
      }),
      fact({
        title: "Irrigation",
        points: [
          "Copious irrigation is the first treatment",
          "Continue for 15–30 minutes or until pH normalizes",
        ],
        sourcePages: [2],
      }),
    ]);
    expect(facts).toHaveLength(1);
    expect(facts[0].points).toHaveLength(2);
  });

  it("does not merge different facts about the same topic", () => {
    const { facts } = dedupeFacts([
      fact(),
      fact({
        title: "Acid burns",
        points: ["Acids coagulate surface proteins forming a barrier"],
      }),
      fact({
        title: "Grading",
        points: ["Grading depends on corneal clarity and limbal ischemia"],
      }),
    ]);
    expect(facts).toHaveLength(3);
  });

  it("does not merge cards that differ only in their numbers", () => {
    const { facts } = dedupeFacts([
      fact({ title: "Dose", points: ["Adrenaline 0.5 mg IM every 5 minutes"] }),
      fact({ title: "Dose", points: ["Adrenaline 1 mg IV every 3 minutes"] }),
    ]);
    expect(facts).toHaveLength(2);
  });
});

describe("orderFacts", () => {
  it("keeps the file's order by part, urgent cards first inside a part", () => {
    const ordered = orderFacts([
      fact({ title: "late def", category: "definition", unitIndex: 1 }),
      fact({ title: "def", category: "definition", unitIndex: 0 }),
      fact({ title: "emergency", category: "emergency", unitIndex: 0 }),
      fact({ title: "late must", category: "must_know", unitIndex: 1 }),
    ]);
    expect(ordered.map(f => f.title)).toEqual([
      "emergency",
      "def",
      "late must",
      "late def",
    ]);
  });
});

describe("validateExamFocusCoverage", () => {
  const unit = (
    pageStart: number,
    pageEnd: number,
    status = "complete",
    declaredEmptyPages: number[] = []
  ) => ({
    pageStart,
    pageEnd,
    status,
    declaredEmptyPages,
    pageTexts: Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => ({
      page: pageStart + i,
      text: "x".repeat(200),
    })),
  });
  const base = { extractedFacts: 0, duplicatesRemoved: 0 };

  it("is COMPLETE only when every content page is cited or declared empty", () => {
    const coverage = validateExamFocusCoverage({
      ...base,
      totalPages: 4,
      units: [unit(1, 2, "complete", [1]), unit(3, 4)],
      cards: [{ sourcePages: [2, 3] }, { sourcePages: [4] }],
    });
    expect(coverage.status).toBe("COMPLETE");
    expect(coverage.percent).toBe(100);
  });

  it("is PARTIAL (never silently complete) when a unit failed", () => {
    const coverage = validateExamFocusCoverage({
      ...base,
      totalPages: 4,
      units: [unit(1, 2), unit(3, 4, "failed")],
      cards: [{ sourcePages: [1, 2] }],
    });
    expect(coverage.status).toBe("PARTIAL");
    expect(coverage.failedRanges).toEqual([{ pageStart: 3, pageEnd: 4 }]);
    expect(coverage.uncoveredContentPages).toEqual([3, 4]);
  });

  it("reports pages the extractor never read (no text)", () => {
    const coverage = validateExamFocusCoverage({
      ...base,
      totalPages: 3,
      units: [unit(1, 2)],
      cards: [{ sourcePages: [1, 2] }],
    });
    expect(coverage.status).toBe("PARTIAL");
    expect(coverage.pagesWithoutText).toEqual([3]);
  });

  it("is FAILED when every unit failed", () => {
    const coverage = validateExamFocusCoverage({
      ...base,
      totalPages: 2,
      units: [unit(1, 2, "failed")],
      cards: [],
    });
    expect(coverage.status).toBe("FAILED");
  });
});

describe("composeExamFocusDeck — 40-page file end to end (echo model)", () => {
  it("covers all 40 pages, keeps late-page facts, dedupes repeated topics", async () => {
    const units = planExamFocusUnits(fortyPages());
    const extracted = [];
    for (const plan of units) {
      const result = await extractExamFocusUnit({
        fileName: "forty.pdf",
        unitIndex: plan.unitIndex,
        totalUnits: units.length,
        pageTexts: plan.pageTexts,
        llm: echoLlm,
      });
      extracted.push({
        ...plan,
        status: "complete",
        facts: result.facts,
        declaredEmptyPages: result.declaredEmptyPages,
      });
    }
    const { cards, coverage } = composeExamFocusDeck({
      totalPages: 40,
      units: extracted,
    });
    expect(coverage.status).toBe("COMPLETE");
    expect(coverage.unitsComplete).toBe(units.length);
    expect(coverage.uncoveredContentPages).toEqual([]);
    const cited = new Set(cards.flatMap(card => card.sourcePages));
    expect(cited.has(40)).toBe(true);
    // The fixture's topics repeat every few pages — merged, not repeated.
    expect(coverage.duplicatesRemoved).toBeGreaterThan(0);
    expect(cards.length).toBeLessThan(coverage.extractedFacts);
    // Facts that only exist on late pages survive dedupe.
    const allText = cards
      .map(card => [card.title, ...card.points].join(" "))
      .join(" ")
      .toLowerCase();
    for (const late of Object.values(LATE_PAGE_FACTS)) {
      expect(allText).toContain(late.keyword.toLowerCase());
    }
  });

  it("builds a PARTIAL deck from the parts that worked when one part failed", () => {
    const units = planExamFocusUnits(fortyPages());
    const { cards, coverage } = composeExamFocusDeck({
      totalPages: 40,
      units: units.map((plan, i) => ({
        ...plan,
        status: i === units.length - 1 ? "failed" : "complete",
        facts: [
          fact({
            title: `part ${i}`,
            points: [`unique fact ${i} about topic ${i * 7}`],
            sourcePages: [plan.pageStart],
          }),
        ],
        declaredEmptyPages: [],
      })),
    });
    expect(coverage.status).toBe("PARTIAL");
    expect(coverage.failedRanges).toHaveLength(1);
    expect(cards).toHaveLength(units.length - 1);
  });
});

describe("large deck behaviour", () => {
  it("dedupes and orders 1,500 facts quickly", () => {
    const facts: OrderedFact[] = Array.from({ length: 1500 }, (_, i) =>
      fact({
        title: `Topic ${i % 600}`,
        points: [
          `Distinct fact number ${i % 600} regarding structure ${i % 600}x`,
        ],
        sourcePages: [1 + (i % 300)],
        unitIndex: Math.floor((i % 300) / 6),
      })
    );
    const started = Date.now();
    const { facts: kept } = dedupeFacts(facts);
    const ordered = orderFacts(kept);
    expect(Date.now() - started).toBeLessThan(4000);
    expect(kept.length).toBe(600);
    expect(ordered).toHaveLength(600);
  });
});

describe("uncoveredUnitPages", () => {
  it("ignores near-empty pages and counts declared-empty ones as covered", () => {
    const pages = [
      { page: 1, text: "short" },
      { page: 2, text: "y".repeat(100) },
      { page: 3, text: "z".repeat(100) },
    ];
    const facts: ExamFocusFact[] = [{ ...fact(), sourcePages: [2] }];
    expect(uncoveredUnitPages(pages, facts, [])).toEqual([3]);
    expect(uncoveredUnitPages(pages, facts, [3])).toEqual([]);
  });
});
