import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queue/verify", () => ({ verifyQStashRequest: vi.fn() }));
vi.mock("@/lib/queue/concurrency", () => ({
  isUserConcurrencyExceeded: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/queue/claim", () => ({ claimBookChapter: vi.fn() }));
vi.mock("@/lib/db-books", () => ({
  getChapterById: vi.fn(),
  completeChapterAnalysis: vi.fn(),
  finalizeBookIfDone: vi.fn(),
  markBookChapterFailedTerminal: vi.fn(),
  markBookChapterRetrying: vi.fn(),
}));
vi.mock("@/lib/llm", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/llm")>();
  return { ...actual, invokeLLM: vi.fn() };
});

import { verifyQStashRequest } from "@/lib/queue/verify";
import { claimBookChapter } from "@/lib/queue/claim";
import { completeChapterAnalysis, getChapterById } from "@/lib/db-books";
import { invokeLLM } from "@/lib/llm";
import { POST } from "./route";

const mockVerify = verifyQStashRequest as unknown as ReturnType<typeof vi.fn>;
const mockGetChapter = getChapterById as unknown as ReturnType<typeof vi.fn>;
const mockClaim = claimBookChapter as unknown as ReturnType<typeof vi.fn>;
const mockComplete = completeChapterAnalysis as unknown as ReturnType<
  typeof vi.fn
>;
const mockInvoke = invokeLLM as unknown as ReturnType<typeof vi.fn>;

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
});
