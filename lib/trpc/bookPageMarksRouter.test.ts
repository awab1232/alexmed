import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db-book-page-marks", () => ({
  listBookPageMarks: vi.fn(),
  saveBookPageMarks: vi.fn(),
}));

import { bookPageMarksRouter } from "./bookPageMarksRouter";
import { listBookPageMarks, saveBookPageMarks } from "../db-book-page-marks";

const mockList = listBookPageMarks as unknown as ReturnType<typeof vi.fn>;
const mockSave = saveBookPageMarks as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function caller() {
  return bookPageMarksRouter.createCaller({
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

describe("bookPageMarksRouter.list", () => {
  it("returns whatever the data layer resolves for this book", async () => {
    const marks = new Map([[1, { highlights: [], strokes: [] }]]);
    mockList.mockResolvedValue(marks);
    const result = await caller().list({ bookId: "b1" });
    expect(result).toEqual(marks);
    expect(mockList).toHaveBeenCalledWith("u1", "b1");
  });
});

describe("bookPageMarksRouter.save", () => {
  it("returns NOT_FOUND when the book isn't the caller's", async () => {
    mockSave.mockResolvedValue(false);
    await expect(
      caller().save({
        bookId: "someone-elses-book",
        pageNumber: 1,
        highlights: [],
        strokes: [],
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("succeeds and forwards the caller's own userId + pageNumber when owned", async () => {
    mockSave.mockResolvedValue(true);
    const result = await caller().save({
      bookId: "b1",
      pageNumber: 3,
      highlights: [
        {
          id: "h1",
          color: "#fde68a",
          rects: [{ x: 0, y: 0, width: 0.2, height: 0.02 }],
        },
      ],
      strokes: [],
    });
    expect(result).toEqual({ success: true });
    expect(mockSave).toHaveBeenCalledWith("u1", "b1", 3, {
      highlights: [
        {
          id: "h1",
          color: "#fde68a",
          rects: [{ x: 0, y: 0, width: 0.2, height: 0.02 }],
        },
      ],
      strokes: [],
    });
  });

  it("rejects a highlight with zero rects", async () => {
    await expect(
      caller().save({
        bookId: "b1",
        pageNumber: 1,
        highlights: [{ id: "h1", color: "#fde68a", rects: [] }],
        strokes: [],
      })
    ).rejects.toBeTruthy();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("rejects pageNumber below 1", async () => {
    await expect(
      caller().save({ bookId: "b1", pageNumber: 0, highlights: [], strokes: [] })
    ).rejects.toBeTruthy();
  });
});
