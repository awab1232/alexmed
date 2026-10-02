// Runs the WEB implementation (lib/mirror-card-question.ts) on sample
// questions and writes its results as the expected values for the Dart
// port's parity test (test/features/mirror/card_question_parity_test.dart).
// Re-run after changing either side:
//   node_modules/.bin/esbuild mobile/tool/export_card_question_fixtures.ts \
//     --bundle --platform=node --format=cjs --outfile=<tmp>/cq.cjs
//   node <tmp>/cq.cjs > mobile/test/fixtures/card_question_web.json
import {
  parseCardQuestion,
  resolveCardAnswer,
} from "../../lib/mirror-card-question";

const cases: { question: string; answer: string; arabic?: boolean }[] = [
  {
    question:
      "12. Which drug is a loop diuretic? A. Furosemide B. Spironolactone C. Amiloride D. Mannitol",
    answer: "A. Furosemide",
  },
  {
    question:
      "Which nerve supplies the deltoid?\nA) Radial nerve\nB) Axillary nerve\nC) Median nerve\nD) Ulnar nerve",
    answer: "B",
  },
  {
    question:
      "Deficiency of vitamin A. causes which of the following? A. Night blindness B. Scurvy C. Rickets",
    answer: "Night blindness",
  },
  {
    question:
      "The antidote for heparin is: (a) Vitamin K (b) Protamine sulfate (c) Naloxone (d) Flumazenil Answer: b",
    answer: "Protamine",
  },
  { question: "Define homeostasis.", answer: "Maintaining a stable internal environment." },
  {
    question: "Which is a statin? A. Atorvastatin B. Enalapril",
    answer: "(a)",
  },
  {
    question:
      "ما هو ترياق الهيبارين؟ أ) فيتامين ك ب) كبريتات البروتامين ج) نالوكسون د) فلومازينيل",
    answer: "",
    arabic: true,
  },
  {
    question: "١. أي من التالي مدر عروي؟\n١) فوروسيميد\n٢) سبيرونولاكتون\n٣) مانيتول",
    answer: "",
    arabic: true,
  },
  {
    question: "Pick one: A. x B. y C. z D. w E. v F. u",
    answer: "E - v",
  },
  {
    question: "Which one? A. Apple juice B. Apple C. Pear",
    answer: "Apple",
  },
];

const results = cases.map(c => {
  const parsed = parseCardQuestion(c.question, { arabic: !!c.arabic });
  const options = parsed.options.map(r => c.question.slice(r.start, r.end));
  return {
    ...c,
    stem: parsed.stem,
    options: parsed.options,
    correct: c.arabic ? null : resolveCardAnswer(c.answer, c.question, options),
  };
});
console.log(JSON.stringify(results, null, 2));
