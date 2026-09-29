// Runs the WEB implementation of Exam Focus's number highlighting
// (lib/exam-focus-categories.ts splitHighlights) and source-page label
// (components/exam-focus/ExamFocusCard.tsx pagesLabel) on sample lines and
// writes the results as the expected values for the Dart port's parity
// test (test/features/exam_focus/exam_focus_parity_test.dart). Re-run after
// changing either side:
//   node_modules/.bin/esbuild mobile/tool/export_exam_focus_fixtures.ts \
//     --bundle --platform=node --format=cjs --jsx=automatic \
//     --external:next --external:lucide-react --external:react \
//     --outfile=node_modules/.cache/ef.cjs
//   node node_modules/.cache/ef.cjs > mobile/test/fixtures/exam_focus_web.json
import { splitHighlights } from "../../lib/exam-focus-categories";
import { pagesLabel } from "../../components/exam-focus/ExamFocusCard";

const lines = [
  "Irrigate chemical burns for 15–30 minutes",
  "Fever > 38.5 °C with neutrophils < 500",
  "Paracetamol 15 mg/kg every 6 hours, max 60 mg/kg/day",
  "pH 7.4 and HCO3 24 mmol/L",
  "Give 0.5 mg IM; repeat after 5 min",
  "No numbers here at all",
  "GCS ≤ 8 → intubate",
  "Mortality 30% in 1 year; 2-3 days of fever",
  "Dose 1,000 IU daily for 12 weeks",
  "Stage 2 hypertension (≥140/90 mmHg)",
  "K+ 5.5 mEq/L; 10 units insulin",
  "Section 3.2.1 and 4h fasting",
  "",
];

const pages = [[], [7], [3, 4, 5], [9, 2, 3], [1, 3, 8, 12, 20, 21]];

console.log(
  JSON.stringify(
    {
      highlights: lines.map(text => ({ text, segments: splitHighlights(text) })),
      pages: pages.map(list => ({ pages: list, label: pagesLabel(list) })),
    },
    null,
    2
  )
);
