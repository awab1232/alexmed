// Builds a stage on the server — the only place stage content is created.
// The full payload (with answers / solution) is stored in the session row;
// the client gets `publicStage(payload)`.
import { BRAIN_GAMES, type BrainGameId, type QuizQuestion } from "./games";
import { generateGkStage } from "./general-knowledge";
import { generateMathStage } from "./math";
import { generateMultiplicationStage } from "./multiplication";
import { createRng } from "./rng";
import { generateSudoku, sudokuSpec, type SudokuDifficulty } from "./sudoku";

export type QuizPayload = {
  kind: "quiz";
  questions: QuizQuestion[];
  passCorrect: number;
};

export type SudokuPayload = {
  kind: "sudoku";
  puzzle: number[];
  solution: number[];
  difficulty: SudokuDifficulty;
  level: number;
  parSeconds: number;
  maxHints: number;
};

export type StagePayload = QuizPayload | SudokuPayload;

// Quiz stages are short; a Sudoku can be paused and resumed for days.
export function sessionLifetimeMs(gameId: BrainGameId): number {
  return BRAIN_GAMES[gameId].kind === "sudoku"
    ? 7 * 24 * 60 * 60 * 1000
    : 60 * 60 * 1000;
}

export function buildStage(
  gameId: BrainGameId,
  stage: number,
  seed: number,
  context: { recentQuestionIds?: string[] } = {}
): StagePayload {
  const game = BRAIN_GAMES[gameId];
  const rng = createRng(seed);
  switch (gameId) {
    case "math":
      return {
        kind: "quiz",
        questions: generateMathStage(stage, rng, game.questionsPerStage),
        passCorrect: game.passCorrect,
      };
    case "multiplication":
      return {
        kind: "quiz",
        questions: generateMultiplicationStage(
          stage,
          rng,
          game.questionsPerStage
        ),
        passCorrect: game.passCorrect,
      };
    case "general_knowledge":
      return {
        kind: "quiz",
        questions: generateGkStage(
          stage,
          rng,
          game.questionsPerStage,
          context.recentQuestionIds ?? []
        ),
        passCorrect: game.passCorrect,
      };
    case "sudoku": {
      const spec = sudokuSpec(stage);
      const generated = generateSudoku(stage, rng);
      return {
        kind: "sudoku",
        puzzle: generated.puzzle,
        solution: generated.solution,
        difficulty: generated.difficulty,
        level: generated.level,
        parSeconds: spec.parSeconds,
        maxHints: spec.maxHints,
      };
    }
  }
}

// What the browser receives. Quiz answers are included so feedback is
// instant with no request per question (the server still re-scores every
// submission from its own copy); the Sudoku solution never leaves the
// server — hints come from a server call.
export type PublicStage =
  | QuizPayload
  | Omit<SudokuPayload, "solution" | "level">;

export function publicStage(payload: StagePayload): PublicStage {
  if (payload.kind === "quiz") return payload;
  return {
    kind: "sudoku",
    puzzle: payload.puzzle,
    difficulty: payload.difficulty,
    parSeconds: payload.parSeconds,
    maxHints: payload.maxHints,
  };
}
