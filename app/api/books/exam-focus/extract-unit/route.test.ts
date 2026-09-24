import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queue/verify", () => ({ verifyQStashRequest: vi.fn() }));
vi.mock("@/lib/queue/client", () => ({ publishMessage: vi.fn() }));
vi.mock("@/lib/llm", async importOriginal => ({
  ...(await importOriginal<typeof import("@/lib/llm")>()),
  invokeLLM: vi.fn(),
}));
vi.mock("@/lib/db-exam-focus", () => ({
  allExamFocusUnitsSettled: vi.fn(),
  claimExamFocusUnit: vi.fn(),
  completeExamFocusUnit: vi.fn(),
  countProcessingExamFocusUnitsForUser: vi.fn(),
  getExamFocusUnitForWorker: vi.fn(),
  markExamFocusUnit: vi.fn(),
}));

import { verifyQStashRequest } from "@/lib/queue/verify";
import { publishMessage } from "@/lib/queue/client";
import { invokeLLM } from "@/lib/llm";
import {
  allExamFocusUnitsSettled,
  claimExamFocusUnit,
  completeExamFocusUnit,
  countProcessingExamFocusUnitsForUser,
  getExamFocusUnitForWorker,
  markExamFocusUnit,
} from "@/lib/db-exam-focus";
import { POST } from "./route";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const unitRow = {
  unit: {
    id: "unit-1",
    deckId: "deck-1",
    unitIndex: 3,
    pageStart: 19,
    pageEnd: 24,
    pageTexts: [
      { page: 19, text: "Alkali burns penetrate deeply. ".repeat(5) },
    ],
  },
  userId: "u1",
  totalUnits: 7,
  fileName: "eye.pdf",
};

const modelAnswer = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          cards: [
            {
              category: "exam_trap",
              topic: "Chemical injury",
              title: "Alkali burns",
              points: ["More dangerous than acid burns"],
              highlightLabel: "",
              highlightText: "",
              flag: "",
              sourcePages: [19],
            },
          ],
          pagesWithoutExamContent: [],
        }),
      },
    },
  ],
};

function request(body: unknown) {
  return new Request(
    "https://app.example.com/api/books/exam-focus/extract-unit",
    { method: "POST", body: JSON.stringify(body) }
  );
}

describe("POST /api/books/exam-focus/extract-unit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m(verifyQStashRequest).mockResolvedValue(true);
    m(getExamFocusUnitForWorker).mockResolvedValue(unitRow);
    m(countProcessingExamFocusUnitsForUser).mockResolvedValue(0);
    m(claimExamFocusUnit).mockResolvedValue({ attemptCount: 1 });
    m(allExamFocusUnitsSettled).mockResolvedValue(false);
    m(publishMessage).mockResolvedValue(undefined);
  });

  it("rejects unsigned requests before touching the DB", async () => {
    m(verifyQStashRequest).mockResolvedValue(false);
    const response = await POST(request({ unitId: "unit-1" }));
    expect(response.status).toBe(401);
    expect(getExamFocusUnitForWorker).not.toHaveBeenCalled();
  });

  it("drops a message for a deleted/regenerated unit", async () => {
    m(getExamFocusUnitForWorker).mockResolvedValue(null);
    const body = await (await POST(request({ unitId: "gone" }))).json();
    expect(body.status).toBe("skipped");
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("waits for a free per-student slot with its own delayed message", async () => {
    m(countProcessingExamFocusUnitsForUser).mockResolvedValue(3);
    const response = await POST(request({ unitId: "unit-1" }));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("throttled");
    expect(claimExamFocusUnit).not.toHaveBeenCalled();
    expect(publishMessage).toHaveBeenCalledWith(
      { type: "extract_exam_focus_unit", unitId: "unit-1", deckId: "deck-1" },
      { delay: 20 }
    );
  });

  it("does nothing when another delivery already claimed the unit", async () => {
    m(claimExamFocusUnit).mockResolvedValue(null);
    const body = await (await POST(request({ unitId: "unit-1" }))).json();
    expect(body.status).toBe("already_processing");
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("saves the unit's grounded facts and queues finalize after the last unit", async () => {
    m(invokeLLM).mockResolvedValue(modelAnswer);
    m(allExamFocusUnitsSettled).mockResolvedValue(true);
    const body = await (await POST(request({ unitId: "unit-1" }))).json();
    expect(body.status).toBe("complete");
    expect(completeExamFocusUnit).toHaveBeenCalledWith(
      "unit-1",
      [expect.objectContaining({ title: "Alkali burns", sourcePages: [19] })],
      []
    );
    expect(publishMessage).toHaveBeenCalledWith({
      type: "finalize_exam_focus",
      deckId: "deck-1",
    });
  });

  it("does not finalize while other units are still running", async () => {
    m(invokeLLM).mockResolvedValue(modelAnswer);
    await POST(request({ unitId: "unit-1" }));
    expect(publishMessage).not.toHaveBeenCalled();
  });

  it("retries ONLY this unit, with backoff, when the model fails", async () => {
    m(invokeLLM).mockRejectedValue(new Error("provider 502"));
    m(claimExamFocusUnit).mockResolvedValue({ attemptCount: 2 });
    const body = await (await POST(request({ unitId: "unit-1" }))).json();
    expect(body.status).toBe("retry_scheduled");
    expect(markExamFocusUnit).toHaveBeenCalledWith(
      "unit-1",
      "retrying",
      expect.stringContaining("19–24")
    );
    expect(publishMessage).toHaveBeenCalledWith(
      { type: "extract_exam_focus_unit", unitId: "unit-1", deckId: "deck-1" },
      { delay: 30 }
    );
    expect(completeExamFocusUnit).not.toHaveBeenCalled();
  });

  it("marks the unit failed (not done) after the last attempt, then finalizes", async () => {
    m(invokeLLM).mockRejectedValue(new Error("provider 502"));
    m(claimExamFocusUnit).mockResolvedValue({ attemptCount: 4 });
    m(allExamFocusUnitsSettled).mockResolvedValue(true);
    const body = await (await POST(request({ unitId: "unit-1" }))).json();
    expect(body.status).toBe("failed");
    expect(markExamFocusUnit).toHaveBeenCalledWith(
      "unit-1",
      "failed",
      expect.any(String)
    );
    expect(publishMessage).toHaveBeenCalledWith({
      type: "finalize_exam_focus",
      deckId: "deck-1",
    });
  });
});
