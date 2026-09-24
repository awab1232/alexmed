// Shared per-page OCR loop, used by both مِرآة (app/api/pdf/ocr/route.ts) and
// كتبي (app/api/books/extract-and-plan/route.ts) so scanned/image-only PDFs
// are handled identically in both pipelines instead of drifting apart.
import { invokeLLM } from "./llm";
import { isNemotronOcrConfigured, nemotronOcrPage } from "./nemotron-ocr";
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

// Pages per OCR request for callers that batch (the extract workers use the
// same size as their OCR_BATCH_SIZE and self-chain for the rest).
export const OCR_PAGES_PER_BATCH = 12;

// Splits requested pages into the batch to OCR now and the explicit rest —
// every requested page lands in exactly one of the two, in order.
export function splitOcrBatch(
  pageNumbers: number[],
  batchSize: number
): { batch: number[]; remaining: number[] } {
  if (batchSize <= 0) throw new Error("batchSize must be positive");
  return {
    batch: pageNumbers.slice(0, batchSize),
    remaining: pageNumbers.slice(batchSize),
  };
}

// OCRs EVERY page it is given — batching is the caller's job. This used to
// silently keep only the first 12 pages passed in, which meant any caller
// passing more lost the rest of the document with no failure recorded;
// full-document coverage requires a page to be either processed or
// reported failed, never dropped.
export async function ocrPages(
  parser: PDFParse,
  pageNumbers: number[]
): Promise<OcrResult> {
  const pages: OcrPage[] = [];
  const failedPages: number[] = [];

  for (const pageNumber of pageNumbers) {
    try {
      const screenshot = await getScreenshotUnderLimit(parser, pageNumber);
      const imageUrl = screenshot?.dataUrl;
      if (!imageUrl) throw new Error("OCR image was not produced");

      // Try the dedicated text-detection model first, when configured — see
      // lib/nemotron-ocr.ts's header comment for why this exists as a
      // separate first attempt rather than just another chat-model fallback:
      // it can't confidently hallucinate "no text" the way a general vision
      // chat model landed on by the fallback chain did in a real incident.
      // Any failure here (not configured, network error, unexpected shape)
      // falls straight through to the existing chat-vision call below,
      // exactly like today's behavior when only that path existed.
      if (isNemotronOcrConfigured()) {
        try {
          const result = await nemotronOcrPage(imageUrl);
          pages.push({ page: pageNumber, ...result, ocr: true });
          continue;
        } catch (nemotronError) {
          console.error(
            `[PDF OCR] nemotron-ocr-v1 failed for page ${pageNumber}, falling back to chat-vision model`,
            nemotronError
          );
        }
      }

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
