import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queue/verify", () => ({ verifyQStashRequest: vi.fn() }));
vi.mock("@/lib/queue/concurrency", () => ({
  isUserConcurrencyExceeded: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/queue/claim", () => ({ claimBookChapter: vi.fn() }));
vi.mock("@/lib/queue/client", () => ({
  publishMessage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/db-books", () => ({
  getChapterById: vi.fn(),
  completeChapterAnalysis: vi.fn(),
  finalizeBookIfDone: vi.fn(),
  markBookChapterFailedTerminal: vi.fn(),
  markBookChapterRetrying: vi.fn(),
  saveChapterSubChunkProgress: vi.fn(),
  hasPendingChapterVisualAnalysis: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/llm", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/llm")>();
  return { ...actual, invokeLLM: vi.fn() };
});

import { verifyQStashRequest } from "@/lib/queue/verify";
import { claimBookChapter } from "@/lib/queue/claim";
import { publishMessage } from "@/lib/queue/client";
import { isUserConcurrencyExceeded } from "@/lib/queue/concurrency";
import {
  markBookChapterRetrying,
  completeChapterAnalysis,
  getChapterById,
  hasPendingChapterVisualAnalysis,
  saveChapterSubChunkProgress,
} from "@/lib/db-books";
import { invokeLLM } from "@/lib/llm";
import { POST } from "./route";

const mockVerify = verifyQStashRequest as unknown as ReturnType<typeof vi.fn>;
const mockGetChapter = getChapterById as unknown as ReturnType<typeof vi.fn>;
const mockClaim = claimBookChapter as unknown as ReturnType<typeof vi.fn>;
const mockComplete = completeChapterAnalysis as unknown as ReturnType<
  typeof vi.fn
>;
const mockInvoke = invokeLLM as unknown as ReturnType<typeof vi.fn>;
const mockSaveProgress = saveChapterSubChunkProgress as unknown as ReturnType<
  typeof vi.fn
>;
const mockPublish = publishMessage as unknown as ReturnType<typeof vi.fn>;
const mockThrottled = isUserConcurrencyExceeded as unknown as ReturnType<
  typeof vi.fn
>;
const mockRetrying = markBookChapterRetrying as unknown as ReturnType<
  typeof vi.fn
>;
const mockHasPendingVisuals =
  hasPendingChapterVisualAnalysis as unknown as ReturnType<typeof vi.fn>;

function request(body: unknown) {
  return new Request("https://app.example.com/api/books/analyze-chapter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function chapterAnalysisContent(overrides?: {
  flashcards?: unknown[];
  mcqs?: unknown[];
}) {
  return JSON.stringify({
    explanationAr: "شرح",
    explanationEn: "explanation",
    keyPoints: [],
    medicalTerms: [],
    flashcards: overrides?.flashcards ?? [],
    mcqs: overrides?.mcqs ?? [],
    chapterSummary: "summary",
  });
}

describe("POST /api/books/analyze-chapter", () => {
  beforeEach(() => {
    mockVerify.mockReset();
    mockGetChapter.mockReset();
    mockClaim.mockReset();
    mockComplete.mockReset();
    mockInvoke.mockReset();
    mockSaveProgress.mockReset();
    mockPublish.mockReset().mockResolvedValue(undefined);
    mockHasPendingVisuals.mockReset().mockResolvedValue(false);
    mockThrottled.mockReset().mockResolvedValue(false);
    mockRetrying.mockReset();
  });

  const oneChapter = {
    id: "c1",
    bookId: "b1",
    userId: "u1",
    title: "Chapter 1",
    startPage: 1,
    endPage: 1,
    pageTexts: [{ page: 1, text: "some chapter text" }],
  };

  // Real bug: a 3-part book — parts 2-3 hit the per-user slot limit while
  // part 1 ran, QStash's ~2-minute redelivery budget ran out on 429s, and
  // they sat "جارٍ التحليل" forever with no message left.
  it("waits for a free slot with its own delayed message instead of a 429", async () => {
    mockVerify.mockResolvedValue(true);
    mockGetChapter.mockResolvedValue(oneChapter);
    mockThrottled.mockResolvedValue(true);

    const response = await POST(request({ chapterId: "c1" }));

    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("throttled");
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockPublish).toHaveBeenCalledWith(
      { type: "analyze_book_chapter", chapterId: "c1", bookId: "b1" },
      { delay: 20 }
    );
  });

  it("schedules its own backed-off retry after a failed attempt", async () => {
    mockVerify.mockResolvedValue(true);
    mockGetChapter.mockResolvedValue(oneChapter);
    mockClaim.mockResolvedValue({ id: "c1", bookId: "b1", attemptCount: 2 });
    mockInvoke.mockRejectedValue(new Error("provider down"));

    const response = await POST(request({ chapterId: "c1" }));

    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("retry_scheduled");
    expect(mockRetrying).toHaveBeenCalledTimes(1);
    expect(mockPublish).toHaveBeenCalledWith(
      { type: "analyze_book_chapter", chapterId: "c1", bookId: "b1" },
      { delay: 30 }
    );
  });

  it("falls back to QStash's retry when scheduling its own fails", async () => {
    mockVerify.mockResolvedValue(true);
    mockGetChapter.mockResolvedValue(oneChapter);
    mockClaim.mockResolvedValue({ id: "c1", bookId: "b1", attemptCount: 1 });
    mockInvoke.mockRejectedValue(new Error("provider down"));
    mockPublish.mockRejectedValue(new Error("qstash down"));

    const response = await POST(request({ chapterId: "c1" }));
    expect(response.status).toBe(502);
  });

  // The actual bug a real book hit: page-visual analysis can legitimately
  // take far longer than QStash's own retry budget (~2 minutes). The old
  // code returned 429 and let QStash's limited retries do the re-checking,
  // so once QStash gave up, the chapter was stuck in "retrying" forever even
  // after visuals finished. The fix self-publishes its own delayed retry
  // and returns 200 — never touching claimBookChapter/attemptCount at all.
  it("self-publishes a delayed retry (not a claim/attempt) while visuals are still pending", async () => {
    mockVerify.mockResolvedValue(true);
    mockGetChapter.mockResolvedValue({
      id: "c1",
      bookId: "b1",
      userId: "u1",
      title: "Chapter 1",
      startPage: 1,
      endPage: 1,
      pageTexts: [{ page: 1, text: "some chapter text" }],
    });
    mockHasPendingVisuals.mockResolvedValue(true);

    const response = await POST(request({ chapterId: "c1" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("waiting_for_visuals");
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockPublish).toHaveBeenCalledWith(
      { type: "analyze_book_chapter", chapterId: "c1", bookId: "b1" },
      { delay: 30 }
    );
  });

  it("rejects a request with an invalid QStash signature", async () => {
    mockVerify.mockResolvedValue(false);
    const response = await POST(request({ chapterId: "c1" }));
    expect(response.status).toBe(401);
    // No DB work should ever happen for an unsigned/invalid request.
    expect(mockGetChapter).not.toHaveBeenCalled();
  });

  // Same data-integrity guard مِرآة (generate-batch) and مكتبة الأدمن already
  // have, now added to كتبي too: a card/MCQ whose sourcePage the model
  // hallucinated outside this chapter's own page range must be dropped, not
  // silently kept.
  it("rejects (does not coerce) a card/MCQ whose sourcePage is outside the chapter's page range", async () => {
    mockVerify.mockResolvedValue(true);
    mockGetChapter.mockResolvedValue({
      id: "c1",
      bookId: "b1",
      userId: "u1",
      title: "Chapter 1",
      startPage: 1,
      endPage: 1,
      pageTexts: [{ page: 1, text: "some chapter text" }],
    });
    mockClaim.mockResolvedValue({ id: "c1", bookId: "b1", attemptCount: 0 });
    mockInvoke.mockResolvedValue({
      choices: [
        {
          message: {
            content: chapterAnalysisContent({
              flashcards: [
                {
                  questionAr: "س1",
                  questionEn: "Q1",
                  answerAr: "ج1",
                  answerEn: "A1",
                  relatedTermEn: "term",
                  sourcePage: 1, // in range
                },
                {
                  questionAr: "س2",
                  questionEn: "Q2",
                  answerAr: "ج2",
                  answerEn: "A2",
                  relatedTermEn: "term",
                  sourcePage: 99, // out of range — must be dropped
                },
              ],
              mcqs: [
                {
                  questionEn: "MCQ in range",
                  choices: ["a", "b", "c", "d"],
                  correctIndex: 0,
                  explanationEn: "why",
                  sourcePage: 1,
                },
                {
                  questionEn: "MCQ out of range",
                  choices: ["a", "b", "c", "d"],
                  correctIndex: 0,
                  explanationEn: "why",
                  sourcePage: 42,
                },
              ],
            }),
          },
        },
      ],
    });

    const response = await POST(request({ chapterId: "c1" }));
    expect(response.status).toBe(200);
    expect(mockComplete).toHaveBeenCalledTimes(1);
    const [, , result] = mockComplete.mock.calls[0];
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].sourcePage).toBe(1);
    expect(result.mcqs).toHaveLength(1);
    expect(result.mcqs[0].sourcePage).toBe(1);
  });

  // P0 audit fix: a chapter split into multiple sub-chunks (>8 pages) must
  // resume from chapter.subChunkResults instead of re-invoking the LLM for
  // sub-chunks that already completed on a prior (timed-out/retried) run.
  it("resumes from a previously-saved sub-chunk instead of redoing it", async () => {
    mockVerify.mockResolvedValue(true);
    // 9 pages -> chunkChapterPages (default 8 pages/chunk) splits this into
    // exactly two sub-chunks: pages 1-8, then page 9.
    const pageTexts = Array.from({ length: 9 }, (_, i) => ({
      page: i + 1,
      text: `page ${i + 1} content`,
    }));
    const alreadySavedSubChunk = {
      explanationAr: "شرح محفوظ مسبقاً",
      explanationEn: "already saved",
      keyPoints: ["old point"],
      medicalTerms: [],
      flashcards: [
        {
          questionAr: "س",
          questionEn: "old Q",
          answerAr: "ج",
          answerEn: "old A",
          relatedTermEn: "",
          sourcePage: 1,
        },
      ],
      mcqs: [],
      chapterSummary: "old summary",
    };
    mockGetChapter.mockResolvedValue({
      id: "c1",
      bookId: "b1",
      userId: "u1",
      title: "Chapter 1",
      startPage: 1,
      endPage: 9,
      pageTexts,
      subChunkResults: [alreadySavedSubChunk],
    });
    mockClaim.mockResolvedValue({ id: "c1", bookId: "b1", attemptCount: 0 });
    // First call = the remaining sub-chunk's own analysis. Second call =
    // merging its summary with the already-saved sub-chunk's summary (there
    // are now 2 summaries total, which is what triggers the merge call).
    mockInvoke
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: chapterAnalysisContent({
                flashcards: [
                  {
                    questionAr: "س2",
                    questionEn: "new Q",
                    answerAr: "ج2",
                    answerEn: "new A",
                    relatedTermEn: "",
                    sourcePage: 9,
                  },
                ],
              }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: { content: JSON.stringify({ chapterSummary: "merged" }) },
          },
        ],
      });

    const response = await POST(request({ chapterId: "c1" }));
    expect(response.status).toBe(200);

    // Exactly TWO LLM calls: one for the remaining (second) sub-chunk, one
    // for the summary merge. The already-saved first sub-chunk must NOT
    // trigger its own LLM call — only 2, not 3.
    expect(mockInvoke).toHaveBeenCalledTimes(2);

    // Audit Phase 6 — the automatic mind-map-section trigger fires once the
    // chapter is durably complete.
    expect(mockPublish).toHaveBeenCalledWith({
      type: "generate_chapter_mindmap_sections",
      chapterId: "c1",
    });

    // Progress is persisted with BOTH results (old + newly generated).
    expect(mockSaveProgress).toHaveBeenCalledTimes(1);
    expect(mockSaveProgress).toHaveBeenCalledWith("c1", [
      alreadySavedSubChunk,
      expect.objectContaining({ chapterSummary: "summary" }),
    ]);

    // The final merged result includes cards from both sub-chunks.
    expect(mockComplete).toHaveBeenCalledTimes(1);
    const [, , result] = mockComplete.mock.calls[0];
    expect(
      result.cards.map((card: { sourcePage: number }) => card.sourcePage)
    ).toEqual([1, 9]);
  });
});
