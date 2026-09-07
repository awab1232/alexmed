// Shared page-screenshot rendering with a hard size ceiling — used by both
// OCR (lib/pdf-ocr.ts) and كتبي's page-visual pipeline
// (app/api/books/analyze-page-visuals/route.ts). AWS Bedrock (which several
// OmniRoute vision models proxy through) hard-rejects any image over 5 MiB
// (5,242,880 bytes) with no way to request compression from pdf-parse's
// getScreenshot — only desiredWidth is adjustable — so a dense/colorful PNG
// screenshot at a fixed width can silently exceed that ceiling depending on
// page content. This renders progressively smaller until the encoded image
// fits comfortably under the limit.
import type { PDFParse } from "pdf-parse";

// Leaves headroom below Bedrock's exact 5,242,880-byte ceiling since our
// estimate from the base64 data URL length is approximate (ignores the
// data: URL's own byte overhead, which is small enough not to matter here).
const MAX_IMAGE_BYTES = 4_800_000;
const WIDTH_STEPS = [1800, 1400, 1100, 850, 650];

function estimateDecodedBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((base64.length * 3) / 4);
}

export type SizedScreenshot = {
  dataUrl: string;
  data?: Uint8Array;
  width: number;
  height: number;
};

export async function getScreenshotUnderLimit(
  parser: PDFParse,
  pageNumber: number,
  options: { imageBuffer?: boolean } = {}
): Promise<SizedScreenshot | null> {
  let last: SizedScreenshot | null = null;

  for (const width of WIDTH_STEPS) {
    const screenshot = await parser.getScreenshot({
      partial: [pageNumber],
      desiredWidth: width,
      imageDataUrl: true,
      imageBuffer: options.imageBuffer ?? false,
    });
    const shot = screenshot.pages[0];
    if (!shot?.dataUrl) continue;

    last = {
      dataUrl: shot.dataUrl,
      data: shot.data,
      width: shot.width,
      height: shot.height,
    };
    if (estimateDecodedBytes(shot.dataUrl) <= MAX_IMAGE_BYTES) return last;
  }

  // Smallest attempted width still came out over the limit (rare, very
  // dense page) — return it anyway so the caller can decide, rather than
  // this helper silently returning nothing for a renderable page.
  return last;
}
