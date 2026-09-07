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
import { getScreenshotUnderLimit } from "./pdf-screenshot";
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

// Caps each call regardless of what the caller passes — matches the
// screenshot+vision-model cost per page, kept identical to the limit each
// extract route enforces (OCR_BATCH_SIZE).
const MAX_PAGES_PER_CALL = 12;

export async function ocrPages(
  parser: PDFParse,
  pageNumbers: number[]
): Promise<OcrResult> {
  const capped = pageNumbers.slice(0, MAX_PAGES_PER_CALL);
  const pages: OcrPage[] = [];
  const failedPages: number[] = [];

  for (const pageNumber of capped) {
    try {
      const screenshot = await getScreenshotUnderLimit(parser, pageNumber);
      const imageUrl = screenshot?.dataUrl;
      if (!imageUrl) throw new Error("OCR image was not produced");

      const response = await invokeLLM({
        model: OCR_MODEL,
        max_tokens: OCR_MAX_TOKENS,
        messages: buildOcrMessages(imageUrl),
        response_format: ocrResponseSchema,
      });
      const parsed = parseJsonResponse(
        response.choices[0]?.message.content
      ) as unknown as { hasText?: boolean; text?: string };
      const text =
        typeof parsed.text === "string" ? normalizePageText(parsed.text) : "";
      // Trust actual transcribed text over the flag if they disagree in
      // that direction — never discard real content just because the model
      // second-guessed its own hasText call.
      const hasText = parsed.hasText === true || text.length > 0;
      // The model's own explicit hasText call decides whether this page is
      // genuinely image-only (a diagram/photo with nothing to transcribe —
      // not a failure) versus one it should have transcribed. Claiming text
      // exists but transcribing nothing is a contradiction, not a legitimate
      // empty page — treat it as a failure worth retrying like any other.
      if (hasText && !text) {
        throw new Error(
          "OCR reported text but returned an empty transcription"
        );
      }
      pages.push({ page: pageNumber, text, hasText, ocr: true });
    } catch (error) {
      console.error(`[PDF OCR] Page ${pageNumber} failed`, error);
      failedPages.push(pageNumber);
      pages.push({ page: pageNumber, text: "", hasText: false, ocr: true });
    }
  }

  return { pages, failedPages };
}
