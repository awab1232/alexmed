import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queue/verify", () => ({ verifyQStashRequest: vi.fn() }));
vi.mock("@/lib/queue/concurrency", () => ({
  isUserConcurrencyExceeded: vi.fn(),
}));
vi.mock("@/lib/queue/claim", () => ({ claimMirrorBatch: vi.fn() }));
vi.mock("@/lib/db-mirror", () => ({
  getMirrorBatchById: vi.fn(),
  completeBatchGeneration: vi.fn(),
  finalizeMirrorJobIfDone: vi.fn(),
  markMirrorBatchFailedTerminal: vi.fn(),
  markMirrorBatchRetrying: vi.fn(),
  getNextPendingMirrorBatches: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/queue/client", () => ({ publishMessage: vi.fn() }));
vi.mock("@/lib/llm", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/llm")>();
  return { ...actual, invokeLLM: vi.fn() };
});

import { verifyQStashRequest } from "@/lib/queue/verify";
import { isUserConcurrencyExceeded } from "@/lib/queue/concurrency";
import { claimMirrorBatch } from "@/lib/queue/claim";
import {
  completeBatchGeneration,
  getMirrorBatchById,
  markMirrorBatchFailedTerminal,
  markMirrorBatchRetrying,
} from "@/lib/db-mirror";
import { publishMessage } from "@/lib/queue/client";
import { invokeLLM } from "@/lib/llm";
import { POST } from "./route";

const mockVerify = verifyQStashRequest as unknown as ReturnType<typeof vi.fn>;
const mockConcurrency = isUserConcurrencyExceeded as unknown as ReturnType<
  typeof vi.fn
>;
const mockClaim = claimMirrorBatch as unknown as ReturnType<typeof vi.fn>;
const mockGetBatch = getMirrorBatchById as unknown as ReturnType<typeof vi.fn>;
const mockComplete = completeBatchGeneration as unknown as ReturnType<
  typeof vi.fn
>;
const mockRetrying = markMirrorBatchRetrying as unknown as ReturnType<
  typeof vi.fn
>;
const mockFailedTerminal =
  markMirrorBatchFailedTerminal as unknown as ReturnType<typeof vi.fn>;
const mockPublish = publishMessage as unknown as ReturnType<typeof vi.fn>;
const mockInvoke = invokeLLM as unknown as ReturnType<typeof vi.fn>;

function request(body: unknown) {
  return new Request("https://app.example.com/api/mirror/generate-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mirror/generate-batch", () => {
  beforeEach(() => {
    mockVerify.mockReset();
    mockConcurrency.mockReset().mockResolvedValue(false);
    mockClaim.mockReset();
    mockGetBatch.mockReset();
    mockComplete.mockReset();
    mockRetrying.mockReset();
    mockFailedTerminal.mockReset();
    mockPublish.mockReset().mockResolvedValue(undefined);
    mockInvoke.mockReset();
  });

  it("rejects a request with an invalid QStash signature", async () => {
    mockVerify.mockResolvedValue(false);
    const response = await POST(request({ batchId: "b1" }));
    expect(response.status).toBe(401);
    // No DB work should ever happen for an unsigned/invalid request.
    expect(mockGetBatch).not.toHaveBeenCalled();
  });

  it("rejects (does not coerce) a card whose sourcePage is outside the batch's pages", async () => {
    mockVerify.mockResolvedValue(true);
    mockGetBatch.mockResolvedValue({
      id: "b1",
      jobId: "j1",
      userId: "u1",
      deckId: "d1",
      depth: "balanced",
      pageTexts: [{ page: 1, text: "some question text", hasText: true }],
    });
    mockClaim.mockResolvedValue({ id: "b1", jobId: "j1", attemptCount: 0 });
    mockInvoke.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              cards: [
                {
                  question: "Q",
                  questionArabic: "س",
                  answer: "A",
                  answerArabic: "ج",
                  explanation: "E",
                  explanationArabic: "ش",
                  keyIdea: "K",
                  keyIdeaArabic: "ف",
                  keyword: "kw",
                  keywordArabic: "كف",
                  // Out of range for this batch (only page 1 exists).
                  sourcePage: 99,
                  status: "complete",
                  confidence: "high",
                },
              ],
            }),
          },
        },
      ],
    });

    const response = await POST(request({ batchId: "b1" }));

    // Filtered out entirely -> zero valid cards -> retryable failure, not a
    // silently-coerced/mislabeled card. Real production incident: this used
    // to return a non-2xx and rely on QStash's own (too-small) retry budget,
    // which left batches permanently stuck once QStash gave up. Now it self-
    // publishes its own delayed retry and acks with 200.
    expect(response.status).toBe(200);
    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockRetrying).toHaveBeenCalledWith("b1", expect.any(String));
    expect(mockPublish).toHaveBeenCalledWith(
      { type: "generate_mirror_batch", batchId: "b1", jobId: "j1" },
      { delay: expect.any(Number) }
    );
  });

  it("marks a batch permanently failed (no further retry) once attempts are exhausted", async () => {
    mockVerify.mockResolvedValue(true);
    mockGetBatch.mockResolvedValue({
      id: "b1",
      jobId: "j1",
      userId: "u1",
      deckId: "d1",
      depth: "balanced",
      pageTexts: [{ page: 1, text: "some question text", hasText: true }],
    });
    // Already at the max-attempts ceiling (QUEUE_MAX_ATTEMPTS defaults to 4).
    mockClaim.mockResolvedValue({ id: "b1", jobId: "j1", attemptCount: 4 });
    mockInvoke.mockRejectedValue(new Error("LLM exploded"));

    const response = await POST(request({ batchId: "b1" }));
    const body = await response.json();

    expect(body.status).toBe("failed");
    expect(mockFailedTerminal).toHaveBeenCalledWith("b1", expect.any(String));
    expect(mockRetrying).not.toHaveBeenCalled();
    // Terminal failure still advances the generation window so the
    // remaining pending batches aren't stuck behind this dead one.
    expect(mockPublish).not.toHaveBeenCalledWith(
      expect.objectContaining({ batchId: "b1" }),
      expect.anything()
    );
  });
});
