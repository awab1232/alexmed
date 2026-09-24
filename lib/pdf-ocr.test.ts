import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pdf-screenshot", () => ({
  getScreenshotUnderLimit: vi.fn(),
}));
vi.mock("./llm", () => ({
  invokeLLM: vi.fn(),
  DEFAULT_VISION_MODEL: "test-vision-model",
}));
vi.mock("./nemotron-ocr", () => ({
  isNemotronOcrConfigured: vi.fn(),
  nemotronOcrPage: vi.fn(),
}));

import { getScreenshotUnderLimit } from "./pdf-screenshot";
import { invokeLLM } from "./llm";
import { isNemotronOcrConfigured, nemotronOcrPage } from "./nemotron-ocr";
import { ocrPages, splitOcrBatch } from "./pdf-ocr";

const mockScreenshot = getScreenshotUnderLimit as unknown as ReturnType<
  typeof vi.fn
>;
const mockInvoke = invokeLLM as unknown as ReturnType<typeof vi.fn>;
const mockNemotronConfigured = isNemotronOcrConfigured as unknown as ReturnType<
  typeof vi.fn
>;
const mockNemotronPage = nemotronOcrPage as unknown as ReturnType<typeof vi.fn>;

function chatResponse(hasText: boolean, text: string) {
  return {
    choices: [{ message: { content: JSON.stringify({ hasText, text }) } }],
  };
}

describe("ocrPages", () => {
  beforeEach(() => {
    mockScreenshot.mockReset().mockResolvedValue({
      dataUrl: "data:image/png;base64,AAAA",
      width: 1800,
      height: 2400,
    });
    mockInvoke.mockReset();
    mockNemotronConfigured.mockReset().mockReturnValue(false);
    mockNemotronPage.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses only the chat-vision model when nemotron isn't configured", async () => {
    mockNemotronConfigured.mockReturnValue(false);
    mockInvoke.mockResolvedValue(chatResponse(true, "hello"));

    const result = await ocrPages({} as never, [1]);

    expect(mockNemotronPage).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.pages).toEqual([
      { page: 1, text: "hello", hasText: true, ocr: true },
    ]);
    expect(result.failedPages).toEqual([]);
  });

  it("uses nemotron's result and never calls the chat model when nemotron succeeds", async () => {
    mockNemotronConfigured.mockReturnValue(true);
    mockNemotronPage.mockResolvedValue({ text: "Test PDF", hasText: true });

    const result = await ocrPages({} as never, [1]);

    expect(mockNemotronPage).toHaveBeenCalledWith("data:image/png;base64,AAAA");
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(result.pages).toEqual([
      { page: 1, text: "Test PDF", hasText: true, ocr: true },
    ]);
    expect(result.failedPages).toEqual([]);
  });

  it("falls back to the chat-vision model when nemotron throws", async () => {
    mockNemotronConfigured.mockReturnValue(true);
    mockNemotronPage.mockRejectedValue(new Error("nemotron down"));
    mockInvoke.mockResolvedValue(chatResponse(true, "recovered via fallback"));

    const result = await ocrPages({} as never, [1]);

    expect(mockNemotronPage).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.pages).toEqual([
      {
        page: 1,
        text: "recovered via fallback",
        hasText: true,
        ocr: true,
      },
    ]);
    expect(result.failedPages).toEqual([]);
  });

  it("marks a page failed only when both nemotron and the chat model fail", async () => {
    mockNemotronConfigured.mockReturnValue(true);
    mockNemotronPage.mockRejectedValue(new Error("nemotron down"));
    mockInvoke.mockRejectedValue(new Error("chat model also down"));

    const result = await ocrPages({} as never, [1]);

    expect(result.failedPages).toEqual([1]);
    expect(result.pages).toEqual([
      { page: 1, text: "", hasText: false, ocr: true },
    ]);
  });

  it("trusts a legitimate hasText:false from nemotron without falling back", async () => {
    mockNemotronConfigured.mockReturnValue(true);
    mockNemotronPage.mockResolvedValue({ text: "", hasText: false });

    const result = await ocrPages({} as never, [1]);

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(result.pages).toEqual([
      { page: 1, text: "", hasText: false, ocr: true },
    ]);
    expect(result.failedPages).toEqual([]);
  });
});

// Full-document coverage: OCR used to silently keep only the first 12 pages
// passed in (and /api/pdf/ocr only the first 4) — every page must now be
// either processed or explicitly handed back as remaining.
describe("OCR never silently drops pages", () => {
  beforeEach(() => {
    mockScreenshot.mockReset().mockResolvedValue({
      dataUrl: "data:image/png;base64,AAAA",
      width: 1800,
      height: 2400,
    });
    mockInvoke.mockReset().mockResolvedValue(chatResponse(true, "text"));
    mockNemotronConfigured.mockReset().mockReturnValue(false);
  });

  it("OCRs all 40 pages it is given, not just the first 12", async () => {
    const pages = Array.from({ length: 40 }, (_, i) => i + 1);
    const result = await ocrPages({} as never, pages);
    expect(result.pages.map(page => page.page)).toEqual(pages);
    expect(mockInvoke).toHaveBeenCalledTimes(40);
  });

  it("splitOcrBatch puts every page in exactly one of batch/remaining", () => {
    const pages = Array.from({ length: 40 }, (_, i) => i + 1);
    const { batch, remaining } = splitOcrBatch(pages, 12);
    expect(batch).toEqual(pages.slice(0, 12));
    expect([...batch, ...remaining]).toEqual(pages);
    expect(splitOcrBatch([3, 7], 12)).toEqual({ batch: [3, 7], remaining: [] });
  });
});
