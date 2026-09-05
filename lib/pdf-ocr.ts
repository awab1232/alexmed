// Shared per-page OCR loop, used by both مِرآة (app/api/pdf/ocr/route.ts) and
// كتبي (app/api/books/extract-and-plan/route.ts) so scanned/image-only PDFs
// are handled identically in both pipelines instead of drifting apart.
import { invokeLLM } from "./llm";
import {
  buildOcrMessages,
  normalizePageText,
  ocrResponseSchema,
  OCR_MAX_TOKENS,
  OCR_MODEL,
  parseJsonResponse,
} from "./pdf-cards";
import type { PDFParse } from "pdf-parse";

export type OcrPage = {
  page: number;
  text: string;
  hasText: boolean;
  ocr: boolean;
};

export type OcrResult = {
  pages: OcrPage[];
  failedPages: number[];
};

// Caps each call at 4 pages regardless of what the caller passes — matches
// the screenshot+vision-model cost per page, kept identical to the limit
// مِرآة's OCR route has always enforced.
const MAX_PAGES_PER_CALL = 4;

export async function ocrPages(
  parser: PDFParse,
  pageNumbers: number[]
): Promise<OcrResult> {
  const capped = pageNumbers.slice(0, MAX_PAGES_PER_CALL);
  const pages: OcrPage[] = [];
  const failedPages: number[] = [];

  for (const pageNumber of capped) {
    try {
      const screenshot = await parser.getScreenshot({
        partial: [pageNumber],
        desiredWidth: 1800,
        imageDataUrl: true,
        imageBuffer: false,
      });
      const imageUrl = screenshot.pages[0]?.dataUrl;
      if (!imageUrl) throw new Error("OCR image was not produced");

      const response = await invokeLLM({
        model: OCR_MODEL,
        max_tokens: OCR_MAX_TOKENS,
        messages: buildOcrMessages(imageUrl),
        response_format: ocrResponseSchema,
      });
      const parsed = parseJsonResponse(
        response.choices[0]?.message.content
      ) as unknown as { text?: string };
      const text =
        typeof parsed.text === "string" ? normalizePageText(parsed.text) : "";
      if (!text) throw new Error("OCR returned empty text");
      pages.push({ page: pageNumber, text, hasText: true, ocr: true });
    } catch (error) {
      console.error(`[PDF OCR] Page ${pageNumber} failed`, error);
      failedPages.push(pageNumber);
      pages.push({ page: pageNumber, text: "", hasText: false, ocr: true });
    }
  }

  return { pages, failedPages };
}
