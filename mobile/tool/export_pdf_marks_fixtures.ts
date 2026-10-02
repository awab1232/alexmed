// Runs the WEB mark rules (lib/card-marks.ts via lib/pdf-marks.ts) — point
// thinning, eraser hit test, highlight append cap — and writes the results
// as expected values for the Dart port's parity test
// (test/features/reader/pdf_marks_parity_test.dart). Re-run after changing
// either side:
//   node_modules/.bin/esbuild mobile/tool/export_pdf_marks_fixtures.ts \
//     --bundle --platform=node --format=cjs \
//     --outfile=node_modules/.cache/pm.cjs
//   node node_modules/.cache/pm.cjs > mobile/test/fixtures/pdf_marks_web.json
import {
  addPdfHighlight,
  appendPoint,
  eraseStrokesAt,
  ERASER_RADIUS,
  MAX_PDF_HIGHLIGHTS,
  PEN_WIDTH,
  type Stroke,
  type StrokePoint,
} from "../../lib/pdf-marks";

const pointRuns: StrokePoint[][] = [
  [[0.1, 0.1], [0.1005, 0.1005], [0.102, 0.1], [0.2, 0.3], [0.2001, 0.3]],
  [[0.5, 0.5], [0.5, 0.503], [0.5, 0.5059], [0.5, 0.51]],
  [[0, 0], [0.002, 0.002], [0.004, 0.004]],
];

const strokes: Stroke[] = [
  { id: "a", color: "#e11d48", width: PEN_WIDTH, points: [[0.1, 0.1], [0.3, 0.1]] },
  { id: "b", color: "#2563eb", width: PEN_WIDTH, points: [[0.6, 0.6]] },
  { id: "c", color: "#16a34a", width: 0.02, points: [[0.2, 0.5], [0.2, 0.7], [0.4, 0.7]] },
];
const erasePoints: StrokePoint[] = [
  [0.2, 0.12], [0.2, 0.14], [0.62, 0.61], [0.65, 0.65], [0.215, 0.6], [0.3, 0.72], [0.9, 0.9],
];

console.log(
  JSON.stringify(
    {
      eraserRadius: ERASER_RADIUS,
      penWidth: PEN_WIDTH,
      maxHighlights: MAX_PDF_HIGHLIGHTS,
      thinning: pointRuns.map(run => {
        let points: StrokePoint[] = [];
        for (const p of run) points = appendPoint(points, p);
        return { input: run, output: points };
      }),
      strokes,
      erase: erasePoints.map(point => ({
        point,
        kept: eraseStrokesAt(strokes, point, ERASER_RADIUS).map(s => s.id),
      })),
      capKept: addPdfHighlight(
        Array.from({ length: MAX_PDF_HIGHLIGHTS }, (_, i) => ({
          id: `h${i}`, color: "#fde68a", rects: [{ x: 0, y: 0, width: 0.1, height: 0.01 }],
        })),
        { id: "over", color: "#fde68a", rects: [{ x: 0, y: 0, width: 0.1, height: 0.01 }] }
      ).length,
      emptyRectsKept: addPdfHighlight([], { id: "e", color: "#fde68a", rects: [] }).length,
    },
    null,
    2
  )
);
