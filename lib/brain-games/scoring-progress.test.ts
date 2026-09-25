import { describe, expect, it } from "vitest";
import {
  PERFECT_STAGE_BONUS,
  scoreQuizStage,
  speedBonus,
  stageState,
} from "./games";
import {
  EMPTY_PROGRESS,
  applyStageOutcome,
  currentStageAfterStart,
  type StageOutcome,
} from "./progress";
import { buildStage, publicStage } from "./stages";

const q = (correctIndex: number, timeLimitMs = 8000) => ({
  correctIndex,
  timeLimitMs,
});

describe("quiz scoring", () => {
  it("speed bonus: big when fast, small when slow", () => {
    expect(speedBonus(1200, 8000)).toBe(85);
    expect(speedBonus(4000, 8000)).toBe(50);
    expect(speedBonus(7500, 8000)).toBe(6);
    expect(speedBonus(100, 8000)).toBe(0); // inhumanly fast → no bonus
  });

  it("correct = base + speed, wrong = 0, timeout = 0", () => {
    const result = scoreQuizStage(
      [q(0), q(1), q(2)],
      [
        { choice: 0, timeMs: 1200 },
        { choice: 3, timeMs: 2000 },
        { choice: null, timeMs: 8000 },
      ],
      1
    );
    expect(result.correct).toBe(1);
    expect(result.wrong).toBe(1);
    expect(result.timeouts).toBe(1);
    expect(result.score).toBe(185);
    expect(result.perQuestion.map(p => p.points)).toEqual([185, 0, 0]);
  });

  it("an answer after the deadline counts as a timeout", () => {
    const result = scoreQuizStage(
      [q(0, 8000)],
      [{ choice: 0, timeMs: 9000 }],
      1
    );
    expect(result.timeouts).toBe(1);
    expect(result.score).toBe(0);
  });

  it("a missing answer counts as a timeout", () => {
    expect(
      scoreQuizStage([q(0), q(0)], [{ choice: 0, timeMs: 2000 }], 1).timeouts
    ).toBe(1);
  });

  it("perfect stage bonus, accuracy, fastest and streak", () => {
    const questions = Array.from({ length: 10 }, () => q(1));
    const answers = Array.from({ length: 10 }, (_, i) => ({
      choice: 1,
      timeMs: 1000 + i * 100,
    }));
    const result = scoreQuizStage(questions, answers, 8);
    expect(result.perfect).toBe(true);
    expect(result.accuracy).toBe(100);
    expect(result.fastestMs).toBe(1000);
    expect(result.bestStreak).toBe(10);
    const withoutBonus = result.perQuestion.reduce((s, p) => s + p.points, 0);
    expect(result.score).toBe(withoutBonus + PERFECT_STAGE_BONUS);
  });

  it("pass needs the threshold (8/10 passes, 7/10 fails)", () => {
    const questions = Array.from({ length: 10 }, () => q(0));
    const answers = (right: number) =>
      Array.from({ length: 10 }, (_, i) => ({
        choice: i < right ? 0 : 1,
        timeMs: 2000,
      }));
    expect(scoreQuizStage(questions, answers(8), 8).passed).toBe(true);
    expect(scoreQuizStage(questions, answers(7), 8).passed).toBe(false);
  });
});

describe("progress transitions", () => {
  const outcome = (over: Partial<StageOutcome>): StageOutcome => ({
    stage: 1,
    passed: true,
    score: 900,
    correct: 9,
    wrong: 1,
    accuracy: 90,
    bestTimeMs: 1400,
    stageTimeMs: 30000,
    answerStreak: 6,
    ...over,
  });

  it("passing stage 17 unlocks 18 and Continue moves to 18", () => {
    const start = {
      ...EMPTY_PROGRESS,
      currentStage: 17,
      highestUnlockedStage: 17,
    };
    const next = applyStageOutcome(start, outcome({ stage: 17 }), 100);
    expect(next.highestUnlockedStage).toBe(18);
    expect(next.currentStage).toBe(18);
    expect(next.unlockedStage).toBe(18);
    expect(next.completedStages).toContain(17);
  });

  it("failing never loses unlocked stages, completions or bests", () => {
    const start = {
      ...EMPTY_PROGRESS,
      currentStage: 12,
      highestUnlockedStage: 12,
      completedStages: [1, 2, 3],
      bestScore: 1500,
      stageBests: { "3": { score: 1500, accuracy: 100, timeMs: 20000 } },
    };
    const next = applyStageOutcome(
      start,
      outcome({ stage: 12, passed: false, score: 300 }),
      100
    );
    expect(next.highestUnlockedStage).toBe(12);
    expect(next.currentStage).toBe(12);
    expect(next.completedStages).toEqual([1, 2, 3]);
    expect(next.bestScore).toBe(1500);
    expect(next.stageBests["3"].score).toBe(1500);
    expect(next.unlockedStage).toBeNull();
    expect(next.totalAttempts).toBe(1);
  });

  it("replaying an old stage keeps Continue where the player really is", () => {
    const start = {
      ...EMPTY_PROGRESS,
      currentStage: 17,
      highestUnlockedStage: 17,
      completedStages: [1, 2, 3],
    };
    expect(currentStageAfterStart(start, 3)).toBe(17);
    expect(
      applyStageOutcome(start, outcome({ stage: 3 }), 100).currentStage
    ).toBe(17);
    expect(
      applyStageOutcome(start, outcome({ stage: 3, passed: false }), 100)
        .currentStage
    ).toBe(17);
  });

  it("keeps the best score per stage and overall bests", () => {
    let p = applyStageOutcome(EMPTY_PROGRESS, outcome({ score: 900 }), 100);
    p = applyStageOutcome(p, outcome({ score: 700, bestTimeMs: 900 }), 100);
    expect(p.stageBests["1"].score).toBe(900);
    expect(p.bestScore).toBe(900);
    expect(p.bestTimeMs).toBe(900);
    expect(p.totalScore).toBe(1600);
    expect(p.completedStages).toEqual([1]);
  });

  it("the last stage completes without unlocking past the end", () => {
    const start = {
      ...EMPTY_PROGRESS,
      currentStage: 50,
      highestUnlockedStage: 50,
    };
    const next = applyStageOutcome(start, outcome({ stage: 50 }), 50);
    expect(next.highestUnlockedStage).toBe(50);
    expect(next.unlockedStage).toBeNull();
    expect(next.completedStages).toContain(50);
  });

  it("stage map states", () => {
    const p = {
      currentStage: 4,
      highestUnlockedStage: 4,
      completedStages: [1, 2, 3],
    };
    expect(stageState(2, p)).toBe("completed");
    expect(stageState(4, p)).toBe("current");
    expect(stageState(5, p)).toBe("locked");
    expect(stageState(1, null)).toBe("current");
    expect(stageState(2, null)).toBe("locked");
  });
});

describe("stage payloads", () => {
  it("the Sudoku solution never reaches the browser", () => {
    const payload = buildStage("sudoku", 1, 123);
    const pub = publicStage(payload) as Record<string, unknown>;
    expect(pub.solution).toBeUndefined();
    expect(payload.kind).toBe("sudoku");
    if (payload.kind === "sudoku") expect(pub.puzzle).toEqual(payload.puzzle);
  });

  it("builds every game deterministically from its seed", () => {
    for (const game of [
      "math",
      "multiplication",
      "general_knowledge",
      "sudoku",
    ] as const) {
      expect(buildStage(game, 7, 99)).toEqual(buildStage(game, 7, 99));
    }
  });
});
