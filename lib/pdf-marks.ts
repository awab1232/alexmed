// PDF-page counterpart of lib/card-marks.ts's تضليل/قلم feature — reuses its
// geometry (pen strokes are page-content-agnostic: points normalised to the
// rendered width, same as a card's) but replaces character-offset highlights
// with rect-based ones, since a PDF page's text lives in pdf.js's own
// positioned text-layer spans rather than one known string per field. A rect
// is exactly what `Range.getClientRects()` gives for a browser selection,
// normalised to the page's own width/height — this is also just how real PDF
// highlight annotations are stored.
import {
  appendPoint,
  eraseStrokesAt,
  newMarkId,
  strokePath,
  ERASER_RADIUS,
  HIGHLIGHT_COLORS,
  MAX_POINTS_PER_STROKE,
  MAX_STROKES,
  PEN_COLORS,
  PEN_WIDTH,
  type Stroke,
  type StrokePoint,
} from "./card-marks";

export {
  appendPoint,
  eraseStrokesAt,
  newMarkId,
  strokePath,
  ERASER_RADIUS,
  HIGHLIGHT_COLORS,
  MAX_POINTS_PER_STROKE,
  MAX_STROKES,
  PEN_COLORS,
  PEN_WIDTH,
  type Stroke,
  type StrokePoint,
};

export type Rect = { x: number; y: number; width: number; height: number };

export type PdfHighlight = {
  id: string;
  color: string;
  rects: Rect[];
};

export type PdfPageMarks = {
  highlights: PdfHighlight[];
  strokes: Stroke[];
};

// Server-side size caps (see lib/trpc/bookPageMarksRouter.ts) — one page's
// marks are one jsonb row, same reasoning as card-marks.ts's own caps.
export const MAX_PDF_HIGHLIGHTS = 200;
export const MAX_RECTS_PER_HIGHLIGHT = 40;

export function emptyPageMarks(): PdfPageMarks {
  return { highlights: [], strokes: [] };
}

export function isEmptyPageMarks(marks: PdfPageMarks): boolean {
  return marks.highlights.length === 0 && marks.strokes.length === 0;
}

// Unlike a card's addHighlight, a PDF highlight never needs to trim/split an
// older one it overlaps — text can legitimately be highlighted twice in two
// colours (a PDF has no single "owning" highlight per character the way a
// card's rendered text does), so this is a plain append under the cap.
export function addPdfHighlight(
  highlights: PdfHighlight[],
  next: PdfHighlight
): PdfHighlight[] {
  if (!next.rects.length) return highlights;
  if (highlights.length >= MAX_PDF_HIGHLIGHTS) return highlights;
  return [...highlights, next];
}

export function removePdfHighlight(
  highlights: PdfHighlight[],
  id: string
): PdfHighlight[] {
  return highlights.filter(h => h.id !== id);
}
