import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queue/verify", () => ({ verifyQStashRequest: vi.fn() }));
vi.mock("@/lib/queue/claim", () => ({ claimMirrorImagePage: vi.fn() }));
vi.mock("@/lib/queue/client", () => ({ publishMessage: vi.fn() }));
vi.mock("@/lib/db-mirror", () => ({
  getMirrorJobById: vi.fn(),
  ensureMirrorImagePages: vi.fn(),
  getNextPendingMirrorImagePage: vi.fn(),
  insertMirrorPageImage: vi.fn(),
  markMirrorImagePageComplete: vi.fn(),
  markMirrorImagePageFailed: vi.fn(),
}));
vi.mock("@/lib/storage", () => ({
  storageGetSignedUrl: vi.fn().mockResolvedValue("https://signed.example/pdf"),
  storagePut: vi.fn().mockResolvedValue({ key: "mirror-pages/j1/1.png" }),
}));
vi.mock("@/lib/llm", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/llm")>();
  return { ...actual, invokeLLM: vi.fn() };
});
vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn().mockImplementation(() => ({
    getScreenshot: vi.fn().mockResolvedValue({
      pages: [
        {
          dataUrl: "data:image/png;base64,AAAA",
          data: new Uint8Array([1, 2, 3]),
          width: 1800,
          height: 2400,
        },
      ],
    }),
    destroy: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock("pdf-parse/worker", () => ({ CanvasFactory: {} }));

import { verifyQStashRequest } from "@/lib/queue/verify";
import { claimMirrorImagePage } from "@/lib/queue/claim";
import { publishMessage } from "@/lib/queue/client";
import {
  getMirrorJobById,
  ensureMirrorImagePages,
  getNextPendingMirrorImagePage,
  insertMirrorPageImage,
  markMirrorImagePageComplete,
  markMirrorImagePageFailed,
} from "@/lib/db-mirror";
import { invokeLLM } from "@/lib/llm";
import { POST } from "./route";

const mockVerify = verifyQStashRequest as unknown as ReturnType<typeof vi.fn>;
const mockClaim = claimMirrorImagePage as unknown as ReturnType<typeof vi.fn>;
const mockPublish = publishMessage as unknown as ReturnType<typeof vi.fn>;
const mockGetJob = getMirrorJobById as unknown as ReturnType<typeof vi.fn>;
const mockEnsurePages = ensureMirrorImagePages as unknown as ReturnType<
  typeof vi.fn
>;
const mockNextPage = getNextPendingMirrorImagePage as unknown as ReturnType<
  typeof vi.fn
>;
const mockInsertImage = insertMirrorPageImage as unknown as ReturnType<
  typeof vi.fn
>;
const mockMarkComplete = markMirrorImagePageComplete as unknown as ReturnType<
  typeof vi.fn
>;
const mockMarkFailed = markMirrorImagePageFailed as unknown as ReturnType<
  typeof vi.fn
>;
const mockInvoke = invokeLLM as unknown as ReturnType<typeof vi.fn>;

function request(body: unknown) {
  return new Request("https://app.example.com/api/mirror/extract-images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function classificationResponse(hasImage: boolean) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            hasImage,
            captionEn: hasImage ? "a figure" : "",
          }),
        },
      },
    ],
  };
}

describe("POST /api/mirror/extract-images", () => {
  beforeEach(() => {
    mockVerify.mockReset().mockResolvedValue(true);
    mockClaim.mockReset();
    mockPublish.mockReset().mockResolvedValue(undefined);
    mockGetJob
      .mockReset()
      .mockResolvedValue({ id: "j1", fileKey: "mirror/j1.pdf", pageCount: 20 });
    mockEnsurePages.mockReset();
    mockNextPage.mockReset();
    mockInsertImage.mockReset();
    mockMarkComplete.mockReset();
    mockMarkFailed.mockReset();
    mockInvoke.mockReset();
  });

  it("rejects a request with an invalid QStash signature", async () => {
    mockVerify.mockResolvedValue(false);
    const response = await POST(request({ jobId: "j1" }));
    expect(response.status).toBe(401);
    expect(mockGetJob).not.toHaveBeenCalled();
  });

  it("stores an image and marks the page complete when classified as having one", async () => {
    mockNextPage
      .mockResolvedValueOnce({ id: "p1", jobId: "j1", pageNumber: 1 })
      .mockResolvedValueOnce(null);
    mockClaim.mockResolvedValueOnce({
      id: "p1",
      jobId: "j1",
      pageNumber: 1,
      attemptCount: 1,
    });
    mockInvoke.mockResolvedValue(classificationResponse(true));

    const response = await POST(request({ jobId: "j1" }));
    expect(response.status).toBe(200);

    expect(mockInsertImage).toHaveBeenCalledWith(
      "j1",
      1,
      "mirror-pages/j1/1.png"
    );
    expect(mockMarkComplete).toHaveBeenCalledWith("p1");
  });

  it("self-chains when pages remain pending after the batch", async () => {
    mockNextPage.mockResolvedValue({ id: "p1", jobId: "j1", pageNumber: 1 });
    mockClaim.mockResolvedValue({
      id: "p1",
      jobId: "j1",
      pageNumber: 1,
      attemptCount: 1,
    });
    mockInvoke.mockResolvedValue(classificationResponse(false));

    const response = await POST(request({ jobId: "j1" }));
    const body = await response.json();

    expect(body.status).toBe("processing");
    expect(mockPublish).toHaveBeenCalledWith(
      { type: "extract_mirror_images", jobId: "j1" },
      { flowControl: { key: "mirror-images-j1", parallelism: 1 } }
    );
    expect(mockClaim).toHaveBeenCalledTimes(12);
  });

  it("returns images_done once no pages remain pending", async () => {
    mockNextPage.mockResolvedValue(null);

    const response = await POST(request({ jobId: "j1" }));
    const body = await response.json();

    expect(body.status).toBe("images_done");
    expect(mockPublish).not.toHaveBeenCalled();
  });
});
