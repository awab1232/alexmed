// Runs the WEB question-card rules (components/questions/QuestionList.tsx:
// correctAnswerOf, optionState, deckProgress) on sample questions and writes
// the results as the expected values for the Dart port's parity test
// (test/features/question_files/question_rules_parity_test.dart).
// Re-run after changing either side:
//   node_modules/.bin/esbuild mobile/tool/export_question_rules_fixtures.ts \
//     --bundle --platform=node --format=cjs --loader:.css=empty \
//     --outfile=<tmp>/qr.cjs
//   node <tmp>/qr.cjs > mobile/test/fixtures/question_rules_web.json
import {
  correctAnswerOf,
  deckProgress,
  optionState,
  type QuestionListItem,
} from "../../components/questions/QuestionList";

const base = {
  questionText: "Q",
  options: ["a", "b", "c", "d"],
  explanationText: null,
  sourcePage: 1,
  keywords: null,
  aiExplanationAr: null,
  imageUrl: null,
};
const questions: QuestionListItem[] = [
  { ...base, id: "q1", extractedAnswerIndex: 2, aiInferredAnswerIndex: null },
  { ...base, id: "q2", extractedAnswerIndex: null, aiInferredAnswerIndex: 1 },
  { ...base, id: "q3", extractedAnswerIndex: null, aiInferredAnswerIndex: null },
  { ...base, id: "q4", extractedAnswerIndex: 0, aiInferredAnswerIndex: 3 },
  { ...base, id: "q5", extractedAnswerIndex: null, aiInferredAnswerIndex: null, options: null },
];

const answerSets: Record<string, { selected: number | null; revealed: boolean }>[] = [
  {},
  { q1: { selected: 2, revealed: true } },
  { q1: { selected: 1, revealed: true }, q2: { selected: 1, revealed: true } },
  {
    q1: { selected: 2, revealed: true },
    q2: { selected: 0, revealed: true },
    q3: { selected: 3, revealed: true },
    q4: { selected: null, revealed: true },
  },
];

const states = [];
for (const correct of [null, 0, 2]) {
  for (const selected of [null, 0, 1, 2]) {
    for (const revealed of [false, true]) {
      states.push({
        correct,
        selected,
        revealed,
        states: [0, 1, 2, 3].map(i => optionState(i, { selected, revealed, correct })),
      });
    }
  }
}

console.log(
  JSON.stringify(
    {
      questions: questions.map(q => ({
        id: q.id,
        extractedAnswerIndex: q.extractedAnswerIndex,
        aiInferredAnswerIndex: q.aiInferredAnswerIndex,
        options: q.options,
        correct: correctAnswerOf(q),
      })),
      progress: answerSets.map(answers => ({
        answers,
        result: deckProgress(questions, answers),
      })),
      states,
    },
    null,
    1
  )
);
