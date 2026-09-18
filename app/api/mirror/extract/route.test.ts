import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queue/verify", () => ({ verifyQStashRequest: vi.fn() }));
vi.mock("@/lib/queue/client", () => ({ publishMessage: vi.fn() }));
vi.mock("@/lib/db-mirror", () => ({
  getMirrorJobById: vi.fn(),
  markMirrorJobExtractionFailed: vi.fn(),
  updateMirrorJobExtractionProgress: vi.fn(),
  finalizeMirrorJobExtraction: vi.fn(),
}));
vi.mock("@/lib/storage", () => ({
  storageGetSignedUrl: vi.fn().mockResolvedValue("https://signed.example/pdf"),
}));
vi.mock("@/lib/pdf-ocr", () => ({ ocrPages: vi.fn() }));
vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn().mockImplementation(() => ({
    getText: vi.fn(),
    destroy: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock("pdf-parse/worker", () => ({ CanvasFactory: {} }));

import { verifyQStashRequest } from "@/lib/queue/verify";
import { publishMessage } from "@/lib/queue/client";
import {
  getMirrorJobById,
  markMirrorJobExtractionFailed,
  updateMirrorJobExtractionProgress,
  finalizeMirrorJobExtraction,
} from "@/lib/db-mirror";
import { ocrPages } from "@/lib/pdf-ocr";
import { PDFParse } from "pdf-parse";
import { POST } from "./route";

const mockVerify = verifyQStashRequest as unknown as ReturnType<typeof vi.fn>;
const mockPublish = publishMessage as unknown as ReturnType<typeof vi.fn>;
const mockGetJob = getMirrorJobById as unknown as ReturnType<typeof vi.fn>;
const mockMarkFailed = markMirrorJobExtractionFailed as unknown as ReturnType<
  typeof vi.fn
>;
const mockUpdateProgress =
  updateMirrorJobExtractionProgress as unknown as ReturnType<typeof vi.fn>;
const mockFinalize = finalizeMirrorJobExtraction as unknown as ReturnType<
  typeof vi.fn
>;
const mockOcrPages = ocrPages as unknown as ReturnType<typeof vi.fn>;

function request(body: unknown) {
  return new Request("https://app.example.com/api/mirror/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mirror/extract", () => {
  beforeEach(() => {
    mockVerify.mockReset().mockResolvedValue(true);
    mockPublish.mockReset().mockResolvedValue(undefined);
    mockGetJob.mockReset();
    mockMarkFailed.mockReset();
    mockUpdateProgress.mockReset();
    mockFinalize.mockReset();
    mockOcrPages.mockReset();
  });

  // Real bug fixed alongside the retry feature: a page number pdf-parse
  // never returns at all (parser gap) used to only surface at the very END
  // of extraction as an unconditional whole-job failure, with zero OCR
  // attempt ever made on it — mirrors app/api/books/extract/route.ts's
  // existing fix. Page 2 here is missing from getText()'s own page array
  // (only 1 and 3 returned) even though the job has 3 total pages.
  it("folds a page missing from getText() entirely into the OCR queue instead of failing immediately", async () => {
    mockGetJob.mockResolvedValue({
      id: "j1",
      fileKey: "mirror/j1.pdf",
      status: "extracting",
      pageTexts: null,
    });
    (PDFParse as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => ({
        getText: vi.fn().mockResolvedValue({
          total: 3,
          pages: [
            { num: 1, text: "page one text" },
            { num: 3, text: "" }, // needs OCR anyway
            // page 2 never appears at all
          ],
        }),
        destroy: vi.fn().mockResolvedValue(undefined),
      })
    );
    mockOcrPages.mockResolvedValue({
      pages: [
        { page: 2, text: "ocr'd page two", hasText: true, ocr: true },
        { page: 3, text: "ocr'd page three", hasText: true, ocr: true },
      ],
      failedPages: [],
    });
    mockFinalize.mockResolvedValue({ batches: [] });

    const response = await POST(request({ jobId: "j1" }));
    expect(response.status).toBe(200);

    expect(mockMarkFailed).not.toHaveBeenCalled();
    // ocrPages must have been asked to process page 2 (the missing one)
    // alongside page 3 (empty text) — not silently skipped.
    const [, batchArg] = mockOcrPages.mock.calls[0];
    expect(batchArg.sort()).toEqual([2, 3]);
  });

  it("still fails the whole job when getText() returns nothing at all", async () => {
    mockGetJob.mockResolvedValue({
      id: "j1",
      fileKey: "mirror/j1.pdf",
      status: "extracting",
      pageTexts: null,
    });
    (PDFParse as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => ({
        getText: vi.fn().mockResolvedValue({ total: 0, pages: [] }),
        destroy: vi.fn().mockResolvedValue(undefined),
      })
    );

    const response = await POST(request({ jobId: "j1" }));
    const body = await response.json();

    expect(body.status).toBe("failed");
    expect(mockMarkFailed).toHaveBeenCalledWith(
      "j1",
      "تعذر قراءة أي صفحة من هذا الملف."
    );
  });
});
