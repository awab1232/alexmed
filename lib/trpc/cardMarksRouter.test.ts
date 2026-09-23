import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db-card-marks", () => ({
  getCardMarks: vi.fn(),
  saveCardMarks: vi.fn(),
}));

import { cardMarksRouter } from "./cardMarksRouter";
import { getCardMarks, saveCardMarks } from "../db-card-marks";

const mockGet = getCardMarks as unknown as ReturnType<typeof vi.fn>;
const mockSave = saveCardMarks as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function caller() {
  return cardMarksRouter.createCaller({
    user: {
      id: "u1",
      email: "test@example.com",
      name: "Test",
      role: "user",
      passwordHash: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: null,
    },
  });
}

describe("cardMarksRouter.get", () => {
  it("returns whatever the data layer resolves for this card", async () => {
    mockGet.mockResolvedValue({ highlights: [], strokes: [] });
    const result = await caller().get({ cardId: "c1" });
    expect(result).toEqual({ highlights: [], strokes: [] });
    expect(mockGet).toHaveBeenCalledWith("u1", "c1");
  });
});

describe("cardMarksRouter.save", () => {
  it("returns NOT_FOUND when the card isn't the caller's", async () => {
    mockSave.mockResolvedValue(false);
    await expect(
      caller().save({ cardId: "someone-elses-card", highlights: [], strokes: [] })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("succeeds and forwards the caller's own userId when the card is owned", async () => {
    mockSave.mockResolvedValue(true);
    const result = await caller().save({
      cardId: "c1",
      highlights: [
        { id: "h1", field: "question", start: 0, end: 3, color: "#fde68a" },
      ],
      strokes: [],
    });
    expect(result).toEqual({ success: true });
    expect(mockSave).toHaveBeenCalledWith("u1", "c1", {
      highlights: [
        { id: "h1", field: "question", start: 0, end: 3, color: "#fde68a" },
      ],
      strokes: [],
    });
  });

  it("rejects a non-hex color before it ever reaches the data layer", async () => {
    await expect(
      caller().save({
        cardId: "c1",
        highlights: [
          { id: "h1", field: "question", start: 0, end: 3, color: "red" },
        ],
        strokes: [],
      })
    ).rejects.toBeTruthy();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("rejects a field name outside MARK_FIELDS", async () => {
    await expect(
      caller().save({
        cardId: "c1",
        highlights: [
          {
            id: "h1",
            field: "notARealField",
            start: 0,
            end: 3,
            color: "#fde68a",
          } as never,
        ],
        strokes: [],
      })
    ).rejects.toBeTruthy();
  });
});
