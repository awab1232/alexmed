import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db-exam-focus", () => ({
  createExamFocusDeck: vi.fn(),
  deleteExamFocusDeckForUser: vi.fn(),
  findStalledExamFocusWork: vi.fn(),
  getBookForExamFocus: vi.fn(),
  getBookPagesForExamFocus: vi.fn(),
  getExamFocusDeckForUser: vi.fn(),
  listExamFocusCardsForUser: vi.fn(),
  resetFailedExamFocusUnits: vi.fn(),
  setExamFocusCardBookmark: vi.fn(),
}));
vi.mock("../queue/client", () => ({ publishMessage: vi.fn() }));

import { examFocusRouter } from "./examFocusRouter";
import {
  createExamFocusDeck,
  deleteExamFocusDeckForUser,
  findStalledExamFocusWork,
  getBookForExamFocus,
  getBookPagesForExamFocus,
  listExamFocusCardsForUser,
  resetFailedExamFocusUnits,
  setExamFocusCardBookmark,
} from "../db-exam-focus";
import { publishMessage } from "../queue/client";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function caller() {
  return examFocusRouter.createCaller({
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
  } as never);
}

const readyBook = {
  id: "b1",
  fileName: "eye.pdf",
  pageCount: 13,
  status: "complete",
  sourceType: "study_book",
};

const thirteenPages = Array.from({ length: 13 }, (_, i) => ({
  page: i + 1,
  text: `Page ${i + 1} content about chemical injury. `.repeat(8),
}));

beforeEach(() => {
  vi.clearAllMocks();
  m(getBookForExamFocus).mockResolvedValue(readyBook);
  m(getBookPagesForExamFocus).mockResolvedValue({
    pages: thirteenPages,
    visuals: [],
  });
  m(publishMessage).mockResolvedValue(undefined);
});

describe("examFocus.start", () => {
  it("plans the whole file and queues one job per unit", async () => {
    m(createExamFocusDeck).mockImplementation(
      async (input: { units: unknown[] }) => ({
        created: true,
        deckId: "d1",
        unitIds: input.units.map((_, i) => `unit-${i}`),
      })
    );
    const result = await caller().start({ bookId: "b1" });
    const input = m(createExamFocusDeck).mock.calls[0][0];
    const pages = input.units.flatMap(
      (unit: { pageTexts: { page: number }[] }) =>
        unit.pageTexts.map(p => p.page)
    );
    expect(new Set(pages).size).toBe(13);
    expect(result.units).toBe(input.units.length);
    expect(publishMessage).toHaveBeenCalledTimes(input.units.length);
    expect(publishMessage).toHaveBeenCalledWith({
      type: "extract_exam_focus_unit",
      unitId: "unit-0",
      deckId: "d1",
    });
  });

  it("never generates twice: an existing deck publishes nothing", async () => {
    m(createExamFocusDeck).mockResolvedValue({
      created: false,
      deckId: "d1",
      unitIds: [],
    });
    const result = await caller().start({ bookId: "b1" });
    expect(result.created).toBe(false);
    expect(publishMessage).not.toHaveBeenCalled();
  });

  it("concurrent start requests queue the work exactly once", async () => {
    let created = false;
    m(createExamFocusDeck).mockImplementation(async () => {
      const first = !created;
      created = true;
      return first
        ? { created: true, deckId: "d1", unitIds: ["unit-0", "unit-1"] }
        : { created: false, deckId: "d1", unitIds: [] };
    });
    await Promise.all([
      caller().start({ bookId: "b1" }),
      caller().start({ bookId: "b1" }),
      caller().start({ bookId: "b1" }),
    ]);
    expect(publishMessage).toHaveBeenCalledTimes(2);
  });

  it("waits for page extraction to finish", async () => {
    m(getBookForExamFocus).mockResolvedValue({
      ...readyBook,
      status: "extracting",
    });
    await expect(caller().start({ bookId: "b1" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(createExamFocusDeck).not.toHaveBeenCalled();
  });

  it("is NOT_FOUND for someone else's book", async () => {
    m(getBookForExamFocus).mockResolvedValue(null);
    await expect(caller().start({ bookId: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("examFocus.regenerate / retryFailed / resume", () => {
  it("regenerate drops the old deck then plans again", async () => {
    m(createExamFocusDeck).mockResolvedValue({
      created: true,
      deckId: "d2",
      unitIds: ["unit-0"],
    });
    await caller().regenerate({ bookId: "b1" });
    expect(deleteExamFocusDeckForUser).toHaveBeenCalledWith("u1", "b1");
    expect(createExamFocusDeck).toHaveBeenCalled();
  });

  it("retryFailed re-queues only the failed units", async () => {
    m(resetFailedExamFocusUnits).mockResolvedValue({
      deckId: "d1",
      unitIds: ["unit-5"],
    });
    const result = await caller().retryFailed({ bookId: "b1" });
    expect(result.retried).toBe(1);
    expect(publishMessage).toHaveBeenCalledTimes(1);
    expect(publishMessage).toHaveBeenCalledWith({
      type: "extract_exam_focus_unit",
      unitId: "unit-5",
      deckId: "d1",
    });
  });

  it("resume re-queues stalled units and a finalize that never ran", async () => {
    m(findStalledExamFocusWork).mockResolvedValue({
      deckId: "d1",
      stalledUnitIds: ["unit-2"],
      needsFinalize: true,
    });
    const result = await caller().resume({ bookId: "b1" });
    expect(result).toEqual({ resumed: 1, finalize: true });
    expect(publishMessage).toHaveBeenCalledWith({
      type: "finalize_exam_focus",
      deckId: "d1",
    });
  });
});

describe("examFocus.cards — search/filter/pagination on the persisted deck", () => {
  it("passes filters to the server query and pages with a cursor", async () => {
    m(listExamFocusCardsForUser).mockResolvedValue({
      items: Array.from({ length: 40 }, (_, i) => ({ id: `c${i}` })),
      total: 247,
    });
    const page = await caller().cards({
      bookId: "b1",
      category: "treatment",
      search: "15–30 minutes",
      cursor: 40,
      limit: 40,
    });
    expect(listExamFocusCardsForUser).toHaveBeenCalledWith({
      userId: "u1",
      bookId: "b1",
      category: "treatment",
      bookmarkedOnly: undefined,
      search: "15–30 minutes",
      offset: 40,
      limit: 40,
    });
    expect(page.nextCursor).toBe(80);
    expect(page.total).toBe(247);
  });

  it("has no next cursor on the last page", async () => {
    m(listExamFocusCardsForUser).mockResolvedValue({
      items: [{ id: "c246" }],
      total: 247,
    });
    const page = await caller().cards({ bookId: "b1", cursor: 246 });
    expect(page.nextCursor).toBeNull();
  });

  it("rejects an unknown category filter", async () => {
    await expect(
      caller().cards({ bookId: "b1", category: "bogus" as never })
    ).rejects.toBeTruthy();
  });

  it("bookmark is NOT_FOUND for a card that isn't the caller's", async () => {
    m(setExamFocusCardBookmark).mockResolvedValue(false);
    await expect(
      caller().setBookmark({ cardId: "c1", bookmarked: true })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
