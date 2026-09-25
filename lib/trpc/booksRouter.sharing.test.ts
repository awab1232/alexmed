import { beforeEach, describe, expect, it, vi } from "vitest";

// 📤 booksRouter under Study Pack sharing: the authorization matrix
// (owner / accepted recipient / stranger), per-viewer progress, and — the
// cost rule — a recipient never triggers AI generation or queue work.
vi.mock("../db-books", () => ({
  deleteBook: vi.fn(),
  getBookCoverageDetail: vi.fn(),
  getBookCoverageReport: vi.fn(),
  getBookCardForUser: vi.fn(),
  getBookForUser: vi.fn(),
  getBookMindMapForUser: vi.fn(),
  getBookStudyContentForUser: vi.fn(),
  getBookPageOwnedByUser: vi.fn(),
  getBookStatsForUser: vi.fn(),
  getChapterContentForUser: vi.fn(),
  getChapterForUser: vi.fn(),
  getChapterMcqsForValidation: vi.fn(),
  getDueCardsForUser: vi.fn(),
  getUpcomingReviewForecastForUser: vi.fn(),
  getWeakPointsForUser: vi.fn(),
  listBooksForUser: vi.fn(),
  listBookPagesForUser: vi.fn(),
  listMcqsForUser: vi.fn(),
  listStalledBookChaptersForUser: vi.fn(),
  rateBookCard: vi.fn(),
  rateSharedBookCard: vi.fn(),
  recordMcqAttempt: vi.fn(),
  resetBookChapterForRetry: vi.fn(),
  resetBookExtractionForRetry: vi.fn(),
  resetBookPageTextForRetry: vi.fn(),
  resetBookPageVisualForRetry: vi.fn(),
  saveMcqValidationResults: vi.fn(),
  insertBookMcqs: vi.fn(),
}));
vi.mock("../book-access", async () => {
  const actual =
    await vi.importActual<typeof import("../book-access")>("../book-access");
  return {
    ...actual,
    getBookAccess: vi.fn(),
    getBookCardAccess: vi.fn(),
    getChapterAccess: vi.fn(),
    getMcqAccess: vi.fn(),
    personalizeCards: vi.fn(),
  };
});
vi.mock("../book-enrichment", () => ({
  generateAndSaveChapterFlashcards: vi.fn(),
  generateAndSaveChapterMcqs: vi.fn(),
  generateAndSaveMindMapSections: vi.fn(),
  generateAndSaveMedicalNotePages: vi.fn(),
  generateAndSaveVisualInsights: vi.fn(),
}));
vi.mock("../llm", async importOriginal => ({
  ...(await importOriginal<typeof import("../llm")>()),
  invokeLLM: vi.fn(),
}));
vi.mock("../queue/client", () => ({ publishMessage: vi.fn() }));
vi.mock("../db-subjects", () => ({ assignBookToSubject: vi.fn() }));

import * as enrichment from "../book-enrichment";
import {
  getBookAccess,
  getBookCardAccess,
  getChapterAccess,
  getMcqAccess,
  personalizeCards,
} from "../book-access";
import {
  getBookForUser,
  getBookStudyContentForUser,
  getChapterContentForUser,
  getChapterForUser,
  rateBookCard,
  rateSharedBookCard,
  recordMcqAttempt,
} from "../db-books";
import { invokeLLM } from "../llm";
import { publishMessage } from "../queue/client";
import { booksRouter } from "./booksRouter";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const VIEWER = "11111111-1111-4111-8111-111111111111";
const OWNER = "22222222-2222-4222-8222-222222222222";

function caller() {
  return booksRouter.createCaller({
    user: { id: VIEWER, email: "v@example.invalid", role: "user" },
  } as never);
}

const shared = {
  bookId: "b1",
  ownerId: OWNER,
  role: "shared" as const,
  ownerName: "Owner",
  ownerUsername: "owner",
};
const owner = { ...shared, ownerId: VIEWER, role: "owner" as const };

beforeEach(() => {
  vi.clearAllMocks();
  m(personalizeCards).mockImplementation(async (cards: unknown[]) =>
    cards.map(card => ({ ...(card as object), personalized: true }))
  );
});

describe("reads — Owner OR Accepted Share", () => {
  it("a recipient reads the OWNER's book, with the owner's folder hidden", async () => {
    m(getBookAccess).mockResolvedValue(shared);
    m(getBookForUser).mockResolvedValue({
      book: { id: "b1", subjectId: "owners-folder" },
      chapters: [],
      totalCards: 3,
      totalMcqs: 2,
    });
    const result = await caller().get({ id: "b1" });
    expect(getBookForUser).toHaveBeenCalledWith(OWNER, "b1");
    expect(result.book.subjectId).toBeNull();
    expect(result.access).toEqual({
      role: "shared",
      ownerName: "Owner",
      ownerUsername: "owner",
    });
  });

  it("study content comes from the owner, cards carry the viewer's progress", async () => {
    m(getBookAccess).mockResolvedValue(shared);
    m(getBookStudyContentForUser).mockResolvedValue({
      book: { id: "b1" },
      chapters: [],
      cards: [{ id: "c1" }],
      mcqs: [],
      terms: [],
      manifest: {},
    });
    const result = await caller().getStudyContent({ bookId: "b1" });
    expect(getBookStudyContentForUser).toHaveBeenCalledWith(OWNER, "b1");
    expect(personalizeCards).toHaveBeenCalledWith(
      [{ id: "c1" }],
      shared,
      VIEWER
    );
    expect(result.cards[0]).toMatchObject({ id: "c1", personalized: true });
  });

  it("chapter content resolves through chapter access", async () => {
    m(getChapterAccess).mockResolvedValue({ ...shared, chapterId: "ch1" });
    m(getChapterContentForUser).mockResolvedValue({
      chapter: { id: "ch1" },
      terms: [],
      cards: [],
      mcqs: [],
      pages: [],
    });
    await caller().getChapter({ id: "ch1" });
    expect(getChapterContentForUser).toHaveBeenCalledWith(OWNER, "ch1");
  });

  it("a stranger (none / pending / revoked share) gets NOT_FOUND everywhere", async () => {
    m(getBookAccess).mockResolvedValue(null);
    m(getChapterAccess).mockResolvedValue(null);
    for (const run of [
      () => caller().get({ id: "b1" }),
      () => caller().getStudyContent({ bookId: "b1" }),
      () => caller().getMindMap({ id: "b1" }),
      () => caller().getChapter({ id: "ch1" }),
      () => caller().listPages({ bookId: "b1" }),
      () => caller().getCoverageReport({ bookId: "b1" }),
    ]) {
      await expect(run()).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    expect(getBookForUser).not.toHaveBeenCalled();
    expect(getBookStudyContentForUser).not.toHaveBeenCalled();
  });
});

describe("personal progress", () => {
  it("a recipient's rating goes to their own progress, never the owner's card", async () => {
    m(getBookCardAccess).mockResolvedValue(shared);
    m(rateSharedBookCard).mockResolvedValue({ intervalDays: 1 });
    await caller().rateCard({ cardId: "c1", rating: "good" });
    expect(rateSharedBookCard).toHaveBeenCalledWith(VIEWER, "c1", "good");
    expect(rateBookCard).not.toHaveBeenCalled();
  });

  it("the owner's rating keeps using the card's own schedule", async () => {
    m(getBookCardAccess).mockResolvedValue(owner);
    m(rateBookCard).mockResolvedValue({ intervalDays: 1 });
    await caller().rateCard({ cardId: "c1", rating: "good" });
    expect(rateBookCard).toHaveBeenCalledWith(VIEWER, "c1", "good");
    expect(rateSharedBookCard).not.toHaveBeenCalled();
  });

  it("a recipient's MCQ answer is recorded as their own attempt", async () => {
    m(getMcqAccess).mockResolvedValue(shared);
    m(recordMcqAttempt).mockResolvedValue({ isCorrect: true });
    await caller().submitMcqAttempt({ mcqId: "q1", selectedIndex: 2 });
    expect(recordMcqAttempt).toHaveBeenCalledWith(VIEWER, "q1", 2);
  });

  it("no access → no attempt recorded", async () => {
    m(getMcqAccess).mockResolvedValue(null);
    await expect(
      caller().submitMcqAttempt({ mcqId: "q1", selectedIndex: 2 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(recordMcqAttempt).not.toHaveBeenCalled();
  });
});

describe("AI cost — a recipient never triggers generation", () => {
  beforeEach(() => {
    // Owner-scoped lookups find nothing for the recipient...
    m(getChapterForUser).mockResolvedValue(null);
    m(getBookForUser).mockResolvedValue(null);
    // ...but they do hold an accepted share, so they get a clear FORBIDDEN.
    m(getChapterAccess).mockResolvedValue({ ...shared, chapterId: "ch1" });
    m(getBookAccess).mockResolvedValue(shared);
  });

  it.each([
    "generateChapterFlashcards",
    "generateChapterMcqs",
    "generateMindMapSections",
    "generateVisualInsights",
    "generateMedicalNotePages",
    "validateChapterMcqs",
    "retryChapter",
  ] as const)("%s → FORBIDDEN, 0 AI calls", async procedure => {
    await expect(
      caller()[procedure]({ chapterId: "ch1" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(invokeLLM).not.toHaveBeenCalled();
    expect(publishMessage).not.toHaveBeenCalled();
    for (const fn of Object.values(enrichment)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it.each(["startChapterAnalysis", "retryExtraction"] as const)(
    "%s → FORBIDDEN, nothing queued",
    async procedure => {
      await expect(caller()[procedure]({ bookId: "b1" })).rejects.toMatchObject(
        { code: "FORBIDDEN" }
      );
      expect(publishMessage).not.toHaveBeenCalled();
    }
  );

  it("a stranger gets NOT_FOUND (no existence leak), not FORBIDDEN", async () => {
    m(getChapterAccess).mockResolvedValue(null);
    await expect(
      caller().generateChapterFlashcards({ chapterId: "ch1" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
