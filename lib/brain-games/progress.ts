// How one finished stage changes a player's progress — pure, so every rule
// (unlocking, never losing progress, bests) is unit-tested. The DB layer
// applies it inside a transaction that locks the progress row, so two
// concurrent submits can't overwrite each other.
import type { BrainGameStageBest } from "../../drizzle/schema";

export type ProgressState = {
  currentStage: number;
  highestUnlockedStage: number;
  completedStages: number[];
  bestScore: number;
  totalScore: number;
  totalCorrect: number;
  totalWrong: number;
  totalAttempts: number;
  bestTimeMs: number | null;
  currentStreak: number;
  bestStreak: number;
  stageBests: Record<string, BrainGameStageBest>;
};

export const EMPTY_PROGRESS: ProgressState = {
  currentStage: 1,
  highestUnlockedStage: 1,
  completedStages: [],
  bestScore: 0,
  totalScore: 0,
  totalCorrect: 0,
  totalWrong: 0,
  totalAttempts: 0,
  bestTimeMs: null,
  currentStreak: 0,
  bestStreak: 0,
  stageBests: {},
};

export type StageOutcome = {
  stage: number;
  passed: boolean;
  score: number;
  correct: number;
  wrong: number;
  accuracy: number;
  // Fastest correct answer (quiz) or solve time (Sudoku).
  bestTimeMs: number | null;
  // Stage completion time shown in the stage's best record.
  stageTimeMs: number | null;
  answerStreak: number;
};

// Starting a stage makes it the one "Continue" returns to — unless it's an
// older stage replayed while the player is further ahead.
export function currentStageAfterStart(
  progress: Pick<ProgressState, "currentStage">,
  stage: number
): number {
  return Math.max(progress.currentStage, stage);
}

export function applyStageOutcome(
  progress: ProgressState,
  outcome: StageOutcome,
  totalStages: number
): ProgressState & { unlockedStage: number | null } {
  const next: ProgressState = {
    ...progress,
    completedStages: [...progress.completedStages],
    stageBests: { ...progress.stageBests },
  };
  next.totalAttempts += 1;
  next.totalScore += outcome.score;
  next.totalCorrect += outcome.correct;
  next.totalWrong += outcome.wrong;
  next.bestScore = Math.max(next.bestScore, outcome.score);
  next.bestStreak = Math.max(next.bestStreak, outcome.answerStreak);
  if (outcome.bestTimeMs !== null) {
    next.bestTimeMs =
      next.bestTimeMs === null
        ? outcome.bestTimeMs
        : Math.min(next.bestTimeMs, outcome.bestTimeMs);
  }

  let unlockedStage: number | null = null;
  if (outcome.passed) {
    if (!next.completedStages.includes(outcome.stage)) {
      next.completedStages.push(outcome.stage);
      next.completedStages.sort((a, b) => a - b);
    }
    const key = String(outcome.stage);
    const previous = next.stageBests[key];
    if (!previous || outcome.score > previous.score) {
      next.stageBests[key] = {
        score: outcome.score,
        accuracy: outcome.accuracy,
        timeMs: outcome.stageTimeMs,
      };
    }
    next.currentStreak += 1;
    const following = Math.min(outcome.stage + 1, totalStages);
    if (following > next.highestUnlockedStage) {
      next.highestUnlockedStage = following;
      unlockedStage = following;
    }
    // "Continue" moves on to the next stage — unless the player was
    // replaying an old stage while further ahead: then keep their place.
    if (outcome.stage >= next.currentStage) next.currentStage = following;
  } else {
    // A failed attempt never removes anything: unlocked stages, completed
    // stages and bests all stay; Continue points at the failed stage only
    // if it's where the player actually is.
    next.currentStreak = 0;
    if (outcome.stage >= next.currentStage) next.currentStage = outcome.stage;
  }
  return { ...next, unlockedStage };
}
