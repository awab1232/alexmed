import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queue/verify", () => ({ verifyQStashRequest: vi.fn() }));
vi.mock("@/lib/db-exam-focus", () => ({
  claimExamFocusFinalize: vi.fn(),
  getExamFocusUnitsForFinalize: vi.fn(),
  releaseExamFocusFinalize: vi.fn(),
  saveExamFocusDeck: vi.fn(),
}));

import { verifyQStashRequest } from "@/lib/queue/verify";
import {
  claimExamFocusFinalize,
  getExamFocusUnitsForFinalize,
  releaseExamFocusFinalize,
  saveExamFocusDeck,
} from "@/lib/db-exam-focus";
import { POST } from "./route";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const card = (title: string, page: number) => ({
  category: "high_yield",
  topic: "",
  title,
  points: [`${title} unique detail ${page}`],
  highlightLabel: "",
  highlightText: "",
  flag: "",
  sourcePages: [page],
});

const unit = (
  unitIndex: number,
  page: number,
  status: string,
  facts: ReturnType<typeof card>[]
) => ({
  unitIndex,
  pageStart: page,
  pageEnd: page,
  status,
  pageTexts: [{ page, text: "content ".repeat(30) }],
  facts: status === "complete" ? facts : null,
  declaredEmptyPages: [],
});

function request(body: unknown) {
  return new Request("https://app.example.com/api/books/exam-focus/finalize", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/books/exam-focus/finalize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m(verifyQStashRequest).mockResolvedValue(true);
    m(claimExamFocusFinalize).mockResolvedValue({
      id: "deck-1",
      totalPages: 2,
    });
  });

  it("skips when units are still running or it was already finalized", async () => {
    m(claimExamFocusFinalize).mockResolvedValue(null);
    const body = await (await POST(request({ deckId: "deck-1" }))).json();
    expect(body.status).toBe("skipped");
    expect(saveExamFocusDeck).not.toHaveBeenCalled();
  });

  it("persists the deduplicated, ordered deck with a COMPLETE verdict", async () => {
    m(getExamFocusUnitsForFinalize).mockResolvedValue([
      unit(0, 1, "complete", [card("Alpha", 1)]),
      unit(1, 2, "complete", [card("Beta", 2), card("Beta", 2)]),
    ]);
    const body = await (await POST(request({ deckId: "deck-1" }))).json();
    expect(body).toMatchObject({
      status: "complete",
      cards: 2,
      coverage: "COMPLETE",
    });
    const saved = m(saveExamFocusDeck).mock.calls[0][0];
    expect(saved.cards.map((c: { title: string }) => c.title)).toEqual([
      "Alpha",
      "Beta",
    ]);
    expect(saved.coverage.duplicatesRemoved).toBe(1);
    expect(saved.errorMessage).toBeNull();
  });

  it("marks the deck partial_failed (never complete) when a unit failed", async () => {
    m(getExamFocusUnitsForFinalize).mockResolvedValue([
      unit(0, 1, "complete", [card("Alpha", 1)]),
      unit(1, 2, "failed", []),
    ]);
    const body = await (await POST(request({ deckId: "deck-1" }))).json();
    expect(body.status).toBe("partial_failed");
    const saved = m(saveExamFocusDeck).mock.calls[0][0];
    expect(saved.coverage.status).toBe("PARTIAL");
    expect(saved.coverage.failedRanges).toEqual([{ pageStart: 2, pageEnd: 2 }]);
  });

  it("marks the deck failed with an honest message when nothing came out", async () => {
    m(getExamFocusUnitsForFinalize).mockResolvedValue([
      unit(0, 1, "complete", []),
    ]);
    const body = await (await POST(request({ deckId: "deck-1" }))).json();
    expect(body.status).toBe("failed");
    expect(m(saveExamFocusDeck).mock.calls[0][0].errorMessage).toMatch(
      /لم نجد/
    );
  });

  it("hands the claim back when saving fails, so the retry can run", async () => {
    m(getExamFocusUnitsForFinalize).mockResolvedValue([
      unit(0, 1, "complete", [card("Alpha", 1)]),
    ]);
    m(saveExamFocusDeck).mockRejectedValue(new Error("db down"));
    m(releaseExamFocusFinalize).mockResolvedValue(undefined);
    const response = await POST(request({ deckId: "deck-1" }));
    expect(response.status).toBe(502);
    expect(releaseExamFocusFinalize).toHaveBeenCalledWith("deck-1");
  });
});
