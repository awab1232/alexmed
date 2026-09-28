import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queue/verify", () => ({ verifyQStashRequest: vi.fn() }));
vi.mock("@/lib/db-books", () => ({ getChapterById: vi.fn() }));
vi.mock("@/lib/generation-jobs", () => ({
  enqueueChapterGeneration: vi.fn(),
}));

import { verifyQStashRequest } from "@/lib/queue/verify";
import { getChapterById } from "@/lib/db-books";
import { enqueueChapterGeneration } from "@/lib/generation-jobs";
import { POST } from "./route";

const mockVerify = verifyQStashRequest as unknown as ReturnType<typeof vi.fn>;
const mockGetChapter = getChapterById as unknown as ReturnType<typeof vi.fn>;
const mockEnqueue = enqueueChapterGeneration as unknown as ReturnType<
  typeof vi.fn
>;

function request(body: unknown) {
  return new Request(
    "https://app.example.com/api/books/generate-mindmap-sections",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

describe("POST /api/books/generate-mindmap-sections (legacy messages)", () => {
  beforeEach(() => {
    mockVerify.mockReset().mockResolvedValue(true);
    mockGetChapter.mockReset();
    mockEnqueue.mockReset().mockResolvedValue({ id: "job-1" });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rejects a request without a valid QStash signature", async () => {
    mockVerify.mockResolvedValue(false);
    const response = await POST(request({ chapterId: "c1" }));
    expect(response.status).toBe(401);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("turns an old message into the chapter's mind-map job — no AI call here", async () => {
    mockGetChapter.mockResolvedValue({
      id: "c1",
      bookId: "b1",
      userId: "u1",
      status: "complete",
    });
    const response = await POST(request({ chapterId: "c1" }));
    expect(response.status).toBe(200);
    expect(mockEnqueue).toHaveBeenCalledWith({
      chapterId: "c1",
      bookId: "b1",
      userId: "u1",
      kind: "mindmap",
    });
    expect(await response.json()).toMatchObject({
      status: "queued",
      jobId: "job-1",
    });
  });

  it("skips a chapter that isn't analysed (or is gone)", async () => {
    mockGetChapter.mockResolvedValue({ id: "c1", status: "processing" });
    const response = await POST(request({ chapterId: "c1" }));
    expect(await response.json()).toMatchObject({ status: "skipped" });
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("asks QStash to retry when the job can't be enqueued", async () => {
    mockGetChapter.mockResolvedValue({
      id: "c1",
      bookId: "b1",
      userId: "u1",
      status: "complete",
    });
    mockEnqueue.mockRejectedValue(new Error("qstash down"));
    const response = await POST(request({ chapterId: "c1" }));
    expect(response.status).toBe(502);
  });
});
