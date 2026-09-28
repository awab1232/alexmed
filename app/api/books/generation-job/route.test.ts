import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queue/verify", () => ({ verifyQStashRequest: vi.fn() }));
vi.mock("@/lib/queue/claim", () => ({ claimGenerationJob: vi.fn() }));
vi.mock("@/lib/queue/client", () => ({ publishMessage: vi.fn() }));
vi.mock("@/lib/queue/concurrency", () => ({
  isUserGenerationConcurrencyExceeded: vi.fn(),
}));
vi.mock("@/lib/generation-jobs", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/generation-jobs")>();
  return {
    isGenerationKind: actual.isGenerationKind,
    getGenerationJob: vi.fn(),
    runChapterGeneration: vi.fn(),
    completeGenerationJob: vi.fn(),
    failGenerationJob: vi.fn(),
    requeueGenerationJob: vi.fn(),
  };
});

import { AiAuthError, AiRateLimitError } from "@/lib/ai/types";
import { verifyQStashRequest } from "@/lib/queue/verify";
import { claimGenerationJob } from "@/lib/queue/claim";
import { publishMessage } from "@/lib/queue/client";
import { isUserGenerationConcurrencyExceeded } from "@/lib/queue/concurrency";
import {
  completeGenerationJob,
  failGenerationJob,
  getGenerationJob,
  requeueGenerationJob,
  runChapterGeneration,
} from "@/lib/generation-jobs";
import { POST } from "./route";

const fn = (f: unknown) => f as ReturnType<typeof vi.fn>;
const mockVerify = fn(verifyQStashRequest);
const mockClaim = fn(claimGenerationJob);
const mockPublish = fn(publishMessage);
const mockThrottled = fn(isUserGenerationConcurrencyExceeded);
const mockGetJob = fn(getGenerationJob);
const mockRun = fn(runChapterGeneration);
const mockComplete = fn(completeGenerationJob);
const mockFail = fn(failGenerationJob);
const mockRequeue = fn(requeueGenerationJob);

const claimed = {
  id: "job-1",
  chapterId: "c1",
  bookId: "b1",
  userId: "u1",
  kind: "flashcards",
  rebuild: false,
  attemptCount: 1,
};

function request(body: unknown) {
  return new Request("https://app.example.com/api/books/generation-job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/books/generation-job", () => {
  beforeEach(() => {
    process.env.QUEUE_MAX_ATTEMPTS = "4";
    for (const mock of [
      mockVerify,
      mockClaim,
      mockPublish,
      mockThrottled,
      mockGetJob,
      mockRun,
      mockComplete,
      mockFail,
      mockRequeue,
    ])
      mock.mockReset();
    mockVerify.mockResolvedValue(true);
    mockThrottled.mockResolvedValue(false);
    mockGetJob.mockResolvedValue({
      id: "job-1",
      status: "queued",
      userId: "u1",
    });
    mockClaim.mockResolvedValue(claimed);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it("rejects an unsigned request without touching the job", async () => {
    mockVerify.mockResolvedValue(false);
    const response = await POST(request({ jobId: "job-1" }));
    expect(response.status).toBe(401);
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("claims, generates and completes the job", async () => {
    const response = await POST(request({ jobId: "job-1" }));
    expect(await response.json()).toMatchObject({ status: "completed" });
    expect(mockRun).toHaveBeenCalledWith("flashcards", "c1", {
      rebuild: false,
    });
    expect(mockComplete).toHaveBeenCalledWith("job-1");
  });

  it("a duplicate delivery that loses the claim does no AI work", async () => {
    mockClaim.mockResolvedValue(null);
    const response = await POST(request({ jobId: "job-1" }));
    expect(await response.json()).toMatchObject({
      status: "already_processing",
    });
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("a finished job is skipped", async () => {
    mockGetJob.mockResolvedValue({ id: "job-1", status: "completed" });
    await POST(request({ jobId: "job-1" }));
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("waits (without claiming) while the student's slots are all busy", async () => {
    mockThrottled.mockResolvedValue(true);
    const response = await POST(request({ jobId: "job-1" }));
    expect(await response.json()).toMatchObject({ status: "throttled" });
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockPublish).toHaveBeenCalledWith(
      { type: "run_chapter_generation", jobId: "job-1" },
      { delay: 20 }
    );
  });

  it("a transient AI failure re-queues with backoff, honouring Retry-After", async () => {
    mockRun.mockRejectedValue(new AiRateLimitError("slow", 45_000));
    const response = await POST(request({ jobId: "job-1" }));
    expect(await response.json()).toMatchObject({
      status: "retry_scheduled",
      errorType: "rate_limit",
    });
    expect(mockRequeue).toHaveBeenCalled();
    expect(mockPublish).toHaveBeenCalledWith(
      { type: "run_chapter_generation", jobId: "job-1" },
      { delay: 45 }
    );
    expect(mockFail).not.toHaveBeenCalled();
  });

  it("a permanent AI failure fails the job at once — no retry", async () => {
    mockRun.mockRejectedValue(new AiAuthError("bad key"));
    const response = await POST(request({ jobId: "job-1" }));
    expect(await response.json()).toMatchObject({
      status: "failed",
      errorType: "auth",
    });
    expect(mockFail).toHaveBeenCalledWith("job-1", "auth", expect.any(String));
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("stops retrying once the attempt budget is spent", async () => {
    mockClaim.mockResolvedValue({ ...claimed, attemptCount: 4 });
    mockRun.mockRejectedValue(new Error("provider down"));
    const response = await POST(request({ jobId: "job-1" }));
    expect(await response.json()).toMatchObject({ status: "failed" });
    expect(mockPublish).not.toHaveBeenCalled();
  });
});
