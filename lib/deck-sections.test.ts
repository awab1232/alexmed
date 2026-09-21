import { describe, expect, it } from "vitest";
import {
  ORIGINAL_SECTION_ID,
  buildDeckSections,
  pickDeckJob,
  sectionIdForCard,
  sortCardsBySection,
  totalFailedBatches,
  type DeckJobInfo,
} from "./deck-sections";

const at = (day: number) => new Date(Date.UTC(2026, 8, day));

const job = (
  id: string,
  day: number,
  overrides: Partial<DeckJobInfo> = {}
): DeckJobInfo => ({
  id,
  status: "complete",
  fileName: `name-${id}`,
  sourceType: "file",
  createdAt: at(day),
  failedBatchCount: 0,
  ...overrides,
});

describe("sectionIdForCard", () => {
  it("uses the card's own job id when it has one", () => {
    expect(
      sectionIdForCard({ jobId: "b", createdAt: at(5) }, [job("a", 1)])
    ).toBe("b");
  });

  it("assigns a card without a job to the deck's earliest job", () => {
    const jobs = [job("b", 3), job("a", 1)];
    expect(sectionIdForCard({ jobId: null, createdAt: at(2) }, jobs)).toBe("a");
  });

  it("falls back to the original section when the earliest job is newer than the card", () => {
    // The original job was deleted; only a later addition remains.
    const jobs = [job("addition", 9)];
    expect(sectionIdForCard({ jobId: null, createdAt: at(2) }, jobs)).toBe(
      ORIGINAL_SECTION_ID
    );
  });

  it("falls back to the original section when the deck has no jobs at all", () => {
    expect(sectionIdForCard({ jobId: null, createdAt: at(2) }, [])).toBe(
      ORIGINAL_SECTION_ID
    );
  });
});

describe("buildDeckSections", () => {
  it("labels the first job 'الأصلي' and later ones with their own name", () => {
    const jobs = [
      job("a", 1),
      job("b", 5, { sourceType: "text", fileName: "الفصل الثاني" }),
    ];
    const sections = buildDeckSections(jobs, [
      { jobId: null, createdAt: at(2) },
      { jobId: null, createdAt: at(2) },
      { jobId: "b", createdAt: at(6) },
    ]);
    expect(sections).toEqual([
      { id: "a", label: "الأصلي", sourceType: "file", cardCount: 2 },
      { id: "b", label: "الفصل الثاني", sourceType: "text", cardCount: 1 },
    ]);
  });

  it("keeps a still-generating job with no cards yet, but drops a finished empty one", () => {
    const jobs = [
      job("a", 1),
      job("live", 5, { status: "pending", fileName: "live" }),
      job("dead", 6, { status: "failed", fileName: "dead" }),
    ];
    const sections = buildDeckSections(jobs, [
      { jobId: "a", createdAt: at(2) },
    ]);
    expect(sections.map(s => s.id)).toEqual(["a", "live"]);
  });

  it("puts cards of a deleted original job in a synthetic first section", () => {
    const jobs = [job("addition", 9, { fileName: "إضافة 1" })];
    const sections = buildDeckSections(jobs, [
      { jobId: null, createdAt: at(2) },
      { jobId: "addition", createdAt: at(10) },
    ]);
    expect(sections.map(s => [s.id, s.label, s.cardCount])).toEqual([
      [ORIGINAL_SECTION_ID, "الأصلي", 1],
      ["addition", "إضافة 1", 1],
    ]);
  });
});

describe("sortCardsBySection", () => {
  it("orders by section first, then source page", () => {
    const sections = [
      { id: "a", label: "الأصلي", sourceType: "file" as const, cardCount: 2 },
      { id: "b", label: "x", sourceType: "text" as const, cardCount: 2 },
    ];
    const sorted = sortCardsBySection(
      [
        { sectionId: "b", sourcePage: 1 },
        { sectionId: "a", sourcePage: 7 },
        { sectionId: "b", sourcePage: 2 },
        { sectionId: "a", sourcePage: 3 },
      ],
      sections
    );
    expect(sorted.map(c => `${c.sectionId}${c.sourcePage}`)).toEqual([
      "a3",
      "a7",
      "b1",
      "b2",
    ]);
  });
});

describe("pickDeckJob / totalFailedBatches", () => {
  it("returns null when there are no jobs", () => {
    expect(pickDeckJob([])).toBeNull();
  });

  it("prefers a job that is still generating", () => {
    const jobs = [
      job("old", 1, { failedBatchCount: 2 }),
      job("live", 5, { status: "pending" }),
    ];
    expect(pickDeckJob(jobs)?.id).toBe("live");
  });

  it("otherwise prefers the newest job with failed batches", () => {
    const jobs = [
      job("a", 1, { failedBatchCount: 1 }),
      job("b", 5),
      job("c", 7, { failedBatchCount: 3 }),
      job("d", 9),
    ];
    expect(pickDeckJob(jobs)?.id).toBe("c");
  });

  it("otherwise returns the newest job", () => {
    expect(pickDeckJob([job("a", 1), job("b", 5)])?.id).toBe("b");
  });

  it("sums failed batches across jobs", () => {
    expect(
      totalFailedBatches([
        job("a", 1, { failedBatchCount: 1 }),
        job("b", 5, { failedBatchCount: 2 }),
      ])
    ).toBe(3);
  });
});
