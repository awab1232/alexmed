// Runs the WEB brain-game rules (lib/brain-games/games.ts scoreQuizStage /
// speedBonus / stageState, lib/brain-games/sudoku.ts PEERS /
// conflictingCells) on sample inputs and writes the results as the
// expected values for the Dart port's parity test
// (test/features/games/game_rules_parity_test.dart). Re-run after changing
// either side:
//   node_modules/.bin/esbuild mobile/tool/export_game_rules_fixtures.ts \
//     --bundle --platform=node --format=cjs --outfile=<tmp>/gr.cjs
//   node <tmp>/gr.cjs > mobile/test/fixtures/game_rules_web.json
import {
  scoreQuizStage,
  speedBonus,
  stageState,
} from "../../lib/brain-games/games";
import { PEERS, conflictingCells } from "../../lib/brain-games/sudoku";

// Deterministic generator (same as the other fixture tools).
let seed = 20260930;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

const quizCases = [];
for (let c = 0; c < 30; c++) {
  const n = 1 + Math.floor(rand() * 10);
  const questions = Array.from({ length: n }, () => ({
    correctIndex: Math.floor(rand() * 4),
    timeLimitMs: [5000, 8000, 10000, 15000][Math.floor(rand() * 4)],
  }));
  const answers = questions.map(q => {
    const r = rand();
    if (r < 0.12) return { choice: null, timeMs: q.timeLimitMs };
    const correct = rand() < 0.65;
    const timeMs =
      r < 0.2
        ? Math.floor(rand() * 260) // too fast to be human
        : r > 0.95
          ? q.timeLimitMs + Math.floor(rand() * 800) // around the deadline
          : Math.floor(rand() * q.timeLimitMs);
    return {
      choice: correct ? q.correctIndex : (q.correctIndex + 1) % 4,
      timeMs,
    };
  });
  // Some cases answer only part of the stage.
  const given = c % 5 === 0 ? answers.slice(0, Math.max(0, n - 2)) : answers;
  const passCorrect = Math.max(1, Math.floor(n * 0.8));
  const result = scoreQuizStage(questions, given, passCorrect);
  quizCases.push({
    questions,
    answers: given,
    passCorrect,
    score: result.score,
    correct: result.correct,
    wrong: result.wrong,
    timeouts: result.timeouts,
    points: result.perQuestion.map(q => q.points),
    passed: result.passed,
    perfect: result.perfect,
  });
}

const bonusCases = [];
for (const limit of [5000, 8000, 10000]) {
  for (const t of [0, 249, 250, 251, 400, 1200, 2500, 4000, 4999, 5000, 7500, 9999, 12000]) {
    bonusCases.push({ timeMs: t, limitMs: limit, bonus: speedBonus(t, limit) });
  }
}

const stageCases = [];
for (const progress of [
  null,
  { currentStage: 3, highestUnlockedStage: 5, completedStages: [1, 2, 4] },
  { currentStage: 6, highestUnlockedStage: 5, completedStages: [1, 2, 3, 4, 5] },
]) {
  for (let stage = 1; stage <= 7; stage++) {
    stageCases.push({ stage, progress, state: stageState(stage, progress) });
  }
}

const boards = [];
for (let b = 0; b < 12; b++) {
  const board = Array.from({ length: 81 }, () =>
    rand() < 0.45 ? 1 + Math.floor(rand() * 9) : 0
  );
  boards.push({ board, conflicts: [...conflictingCells(board)].sort((a, c) => a - c) });
}

console.log(
  JSON.stringify(
    {
      quiz: quizCases,
      bonus: bonusCases,
      stages: stageCases,
      peers: PEERS.map(p => [...p].sort((a, c) => a - c)),
      boards,
    },
    null,
    1
  )
);
