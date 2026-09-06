import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queue/verify", () => ({ verifyQStashRequest: vi.fn() }));
vi.mock("@/lib/queue/concurrency", () => ({
  isUserConcurrencyExceeded: vi.fn(),
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
import { getChapterById } from "@/lib/db-books";
import { POST } from "./route";

const mockVerify = verifyQStashRequest as unknown as ReturnType<typeof vi.fn>;
const mockGetChapter = getChapterById as unknown as ReturnType<typeof vi.fn>;

function request(body: unknown) {
  return new Request("https://app.example.com/api/books/analyze-chapter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/books/analyze-chapter", () => {
  beforeEach(() => {
    mockVerify.mockReset();
    mockGetChapter.mockReset();
  });

  it("rejects a request with an invalid QStash signature", async () => {
    mockVerify.mockResolvedValue(false);
    const response = await POST(request({ chapterId: "c1" }));
    expect(response.status).toBe(401);
    // No DB work should ever happen for an unsigned/invalid request.
    expect(mockGetChapter).not.toHaveBeenCalled();
  });
});
