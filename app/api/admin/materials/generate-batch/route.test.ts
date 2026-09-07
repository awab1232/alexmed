import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queue/verify", () => ({ verifyQStashRequest: vi.fn() }));
vi.mock("@/lib/queue/concurrency", () => ({
  isUserConcurrencyExceeded: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/queue/claim", () => ({ claimAdminMaterialBatch: vi.fn() }));
vi.mock("@/lib/db-admin-materials", () => ({
  getAdminMaterialBatchById: vi.fn(),
  completeAdminMaterialBatchGeneration: vi.fn(),
  finalizeAdminMaterialIfDone: vi.fn(),
  markAdminMaterialBatchFailedTerminal: vi.fn(),
  markAdminMaterialBatchRetrying: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn().mockReturnValue(null) }));
vi.mock("@/lib/llm", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/llm")>();
  return { ...actual, invokeLLM: vi.fn() };
});

import { verifyQStashRequest } from "@/lib/queue/verify";
import { claimAdminMaterialBatch } from "@/lib/queue/claim";
import {
  completeAdminMaterialBatchGeneration,
  getAdminMaterialBatchById,
  markAdminMaterialBatchRetrying,
} from "@/lib/db-admin-materials";
import { invokeLLM } from "@/lib/llm";
import { POST } from "./route";

const mockVerify = verifyQStashRequest as unknown as ReturnType<typeof vi.fn>;
const mockClaim = claimAdminMaterialBatch as unknown as ReturnType<typeof vi.fn>;
const mockGetBatch = getAdminMaterialBatchById as unknown as ReturnType<typeof vi.fn>;
const mockComplete = completeAdminMaterialBatchGeneration as unknown as ReturnType<
  typeof vi.fn
>;
const mockRetrying = markAdminMaterialBatchRetrying as unknown as ReturnType<
  typeof vi.fn
>;
const mockInvoke = invokeLLM as unknown as ReturnType<typeof vi.fn>;

function request(body: unknown) {
  return new Request("https://app.example.com/api/admin/materials/generate-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/materials/generate-batch", () => {
  beforeEach(() => {
    mockVerify.mockReset();
    mockClaim.mockReset();
    mockGetBatch.mockReset();
    mockComplete.mockReset();
    mockRetrying.mockReset();
    mockInvoke.mockReset();
  });

  it("rejects a request with an invalid QStash signature", async () => {
    mockVerify.mockResolvedValue(false);
    const response = await POST(request({ batchId: "b1" }));
    expect(response.status).toBe(401);
    expect(mockGetBatch).not.toHaveBeenCalled();
  });

  // Proves no duplicate generation/cards on a retried QStash delivery: the
  // atomic claim (WHERE status IN pending/failed/retrying) is what actually
  // enforces this in Postgres — this test verifies the route respects a
  // failed claim (already-processing row) by acking without any AI call or
  // card insert, rather than retrying the claim or proceeding anyway.
  it("acks without generating when the batch is already claimed by another delivery", async () => {
    mockVerify.mockResolvedValue(true);
    mockGetBatch.mockResolvedValue({
      id: "b1",
      materialId: "m1",
      pageTexts: [{ page: 1, text: "some text", hasText: true }],
    });
    mockClaim.mockResolvedValue(null); // simulates a concurrent/duplicate delivery losing the race

    const response = await POST(request({ batchId: "b1" }));
    const body = await response.json();

    expect(body.status).toBe("already_processing");
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it("rejects (does not coerce) a card whose sourcePage is outside the batch's pages", async () => {
    mockVerify.mockResolvedValue(true);
    mockGetBatch.mockResolvedValue({
      id: "b1",
      materialId: "m1",
      pageTexts: [{ page: 1, text: "some question text", hasText: true }],
    });
    mockClaim.mockResolvedValue({ id: "b1", materialId: "m1", attemptCount: 0 });
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

    expect(response.status).toBe(422);
    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockRetrying).toHaveBeenCalledWith("b1", expect.any(String));
  });
});
