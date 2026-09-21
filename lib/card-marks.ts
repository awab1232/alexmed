// Pure data model + helpers for مِرآة's card highlighting / pen / eraser
// (components/CardMarks.tsx renders and edits it, lib/db-card-marks.ts
// persists it). Kept free of React/DOM so the merge/erase/hit-test logic is
// unit-testable in the node vitest environment — same split as
// BookPageViewer's renderTextWithHighlights for كتبي.
//
// Positions are deliberately screen-independent (same rule the annotations
// table documents for كتبي): a highlight is a character range inside one of
// the card's own text fields, and a pen stroke is stored in coordinates
// normalised by the card's width, so both survive resizing, zoom and font
// changes.

// Every card text field a student can highlight. Order is irrelevant; this
// is only the allow-list the server validates `field` against.
export const MARK_FIELDS = [
  "question",
  "questionArabic",
  "answer",
  "answerArabic",
  "explanation",
  "explanationArabic",
  "keyIdea",
  "keyIdeaArabic",
  "keyword",
  "keywordArabic",
] as const;
export type MarkField = (typeof MARK_FIELDS)[number];

export type Highlight = {
  id: string;
  field: MarkField;
  start: number;
  end: number;
  color: string;
};

// Points are [x, y] in units of the card's width (so y can exceed 1 for a
// tall card).
export type StrokePoint = [number, number];

export type Stroke = {
  id: string;
  color: string;
  // Stroke thickness in units of the card's width.
  width: number;
  points: StrokePoint[];
};

export type CardMarks = {
  highlights: Highlight[];
  strokes: Stroke[];
};

export const HIGHLIGHT_COLORS = [
  { value: "#fde68a", label: "أصفر" },
  { value: "#bbf7d0", label: "أخضر" },
  { value: "#bfdbfe", label: "أزرق" },
  { value: "#fbcfe8", label: "وردي" },
  { value: "#fed7aa", label: "برتقالي" },
] as const;

export const PEN_COLORS = [
  { value: "#e11d48", label: "أحمر" },
  { value: "#2563eb", label: "أزرق" },
  { value: "#16a34a", label: "أخضر" },
  { value: "#7c3aed", label: "بنفسجي" },
  { value: "#1f2937", label: "أسود" },
] as const;

export const PEN_WIDTH = 0.006;
// Eraser radius in units of card width.
export const ERASER_RADIUS = 0.025;
// Minimum spacing between recorded pen points (units of card width) — keeps
// a long slow stroke from storing thousands of near-duplicate points.
const MIN_POINT_DISTANCE = 0.003;

// Server-side size caps (see lib/trpc/cardMarksRouter.ts) — a card's marks
// are one jsonb row, so they need a hard ceiling.
export const MAX_HIGHLIGHTS = 400;
export const MAX_STROKES = 200;
export const MAX_POINTS_PER_STROKE = 1500;

export function emptyMarks(): CardMarks {
  return { highlights: [], strokes: [] };
}

export function isEmptyMarks(marks: CardMarks): boolean {
  return marks.highlights.length === 0 && marks.strokes.length === 0;
}

export function newMarkId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Adds `next`, letting it win over anything it overlaps in the same field:
// older highlights are trimmed (or split in two when `next` lands in their
// middle) so every character ends up under at most one highlight — this is
// what makes recolouring an already-highlighted phrase just work.
export function addHighlight(
  highlights: Highlight[],
  next: Highlight
): Highlight[] {
  if (next.end <= next.start) return highlights;
  return [...subtractRange(highlights, next.field, next.start, next.end), next]
    .filter(h => h.end > h.start)
    .sort(compareHighlights);
}

export function removeHighlight(
  highlights: Highlight[],
  id: string
): Highlight[] {
  return highlights.filter(h => h.id !== id);
}

function subtractRange(
  highlights: Highlight[],
  field: MarkField,
  start: number,
  end: number
): Highlight[] {
  const result: Highlight[] = [];
  for (const h of highlights) {
    if (h.field !== field || h.end <= start || h.start >= end) {
      result.push(h);
      continue;
    }
    if (h.start < start) result.push({ ...h, end: start });
    if (h.end > end) {
      // A split leaves two pieces that must not share an id.
      result.push({ ...h, id: h.start < start ? newMarkId() : h.id, start: end });
    }
  }
  return result;
}

function compareHighlights(a: Highlight, b: Highlight): number {
  if (a.field !== b.field) return a.field < b.field ? -1 : 1;
  return a.start - b.start;
}

export type TextSegment = { text: string; highlight: Highlight | null };

// Splits `text` into consecutive segments, each either plain or covered by
// one highlight. Ranges are clamped defensively (they come from stored rows,
// and the card text could in principle have been regenerated since).
export function segmentText(
  text: string,
  highlights: Highlight[]
): TextSegment[] {
  const ranges = [...highlights].sort((a, b) => a.start - b.start);
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const h of ranges) {
    const start = Math.max(cursor, Math.min(h.start, text.length));
    const end = Math.max(start, Math.min(h.end, text.length));
    if (end === start) continue;
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), highlight: null });
    }
    segments.push({ text: text.slice(start, end), highlight: h });
    cursor = end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlight: null });
  }
  return segments;
}

// Appends `point` unless it is closer than the minimum spacing to the last
// one, so callers can feed every pointermove straight in.
export function appendPoint(
  points: StrokePoint[],
  point: StrokePoint
): StrokePoint[] {
  const last = points[points.length - 1];
  if (last && distance(last, point) < MIN_POINT_DISTANCE) return points;
  return [...points, point];
}

function distance(a: StrokePoint, b: StrokePoint): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function distanceToSegment(
  p: StrokePoint,
  a: StrokePoint,
  b: StrokePoint
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(p, a);
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared)
  );
  return distance(p, [a[0] + t * dx, a[1] + t * dy]);
}

// True when an eraser of `radius` centred on `point` touches any part of the
// stroke (including its own thickness).
export function strokeTouches(
  stroke: Stroke,
  point: StrokePoint,
  radius: number
): boolean {
  const reach = radius + stroke.width / 2;
  const { points } = stroke;
  if (points.length === 1) return distance(point, points[0]) <= reach;
  for (let i = 1; i < points.length; i++) {
    if (distanceToSegment(point, points[i - 1], points[i]) <= reach) {
      return true;
    }
  }
  return false;
}

export function eraseStrokesAt(
  strokes: Stroke[],
  point: StrokePoint,
  radius: number = ERASER_RADIUS
): Stroke[] {
  const kept = strokes.filter(stroke => !strokeTouches(stroke, point, radius));
  return kept.length === strokes.length ? strokes : kept;
}

// SVG path for a stroke, scaled from card-width units to pixels. Consecutive
// points are joined with quadratic curves through their midpoints, which
// rounds off the pointer's jitter into the smooth, hand-drawn look.
export function strokePath(points: StrokePoint[], scale: number): string {
  if (points.length === 0) return "";
  const p = points.map(([x, y]) => [x * scale, y * scale] as const);
  const fmt = (n: number) => Math.round(n * 100) / 100;
  if (p.length === 1) {
    // A single tap: draw a dot (zero-length line with round caps).
    return `M ${fmt(p[0][0])} ${fmt(p[0][1])} l 0.01 0`;
  }
  let d = `M ${fmt(p[0][0])} ${fmt(p[0][1])}`;
  for (let i = 1; i < p.length - 1; i++) {
    const midX = (p[i][0] + p[i + 1][0]) / 2;
    const midY = (p[i][1] + p[i + 1][1]) / 2;
    d += ` Q ${fmt(p[i][0])} ${fmt(p[i][1])} ${fmt(midX)} ${fmt(midY)}`;
  }
  const last = p[p.length - 1];
  d += ` L ${fmt(last[0])} ${fmt(last[1])}`;
  return d;
}
