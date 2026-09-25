// 🧠 Brain Games — the game registry, shared quiz types and scoring. Pure
// and dependency-free: the server (lib/trpc/brainGamesRouter.ts) uses it to
// generate and score stages, the UI uses it only for labels/display.
//
// Games live in code, not in a DB table: their stages are generated
// (procedural math, Sudoku generator, curated question bank), so adding
// stages means raising `totalStages` — no migration, no data backfill.

export const BRAIN_GAME_IDS = [
  "math",
  "multiplication",
  "sudoku",
  "general_knowledge",
] as const;
export type BrainGameId = (typeof BRAIN_GAME_IDS)[number];

export type BrainGame = {
  id: BrainGameId;
  kind: "quiz" | "sudoku";
  emoji: string;
  title: string;
  titleAr: string;
  tagline: string;
  totalStages: number;
  questionsPerStage: number; // quiz games only
  passCorrect: number; // quiz games: correct answers needed to pass
};

export const BRAIN_GAMES: Record<BrainGameId, BrainGame> = {
  math: {
    id: "math",
    kind: "quiz",
    emoji: "➕",
    title: "Math Challenge",
    titleAr: "تحدي الحساب",
    tagline: "Test your calculation speed",
    totalStages: 100,
    questionsPerStage: 10,
    passCorrect: 8,
  },
  multiplication: {
    id: "multiplication",
    kind: "quiz",
    emoji: "✖️",
    title: "Multiplication",
    titleAr: "جدول الضرب",
    tagline: "How fast can you multiply?",
    totalStages: 100,
    questionsPerStage: 10,
    passCorrect: 8,
  },
  sudoku: {
    id: "sudoku",
    kind: "sudoku",
    emoji: "🧩",
    title: "Sudoku",
    titleAr: "سودوكو",
    tagline: "Logic. Focus. Solve.",
    totalStages: 50,
    questionsPerStage: 0,
    passCorrect: 0,
  },
  general_knowledge: {
    id: "general_knowledge",
    kind: "quiz",
    emoji: "🌍",
    title: "General Knowledge",
    titleAr: "معلومات عامة",
    tagline: "How much do you know?",
    totalStages: 100,
    questionsPerStage: 10,
    passCorrect: 7,
  },
};

export function isBrainGameId(value: unknown): value is BrainGameId {
  return (
    typeof value === "string" &&
    (BRAIN_GAME_IDS as readonly string[]).includes(value)
  );
}

// ── Quiz stages ──────────────────────────────────────────────────────────
export type QuizQuestion = {
  id: string;
  prompt: string;
  // Optional small line above the prompt ("Find the missing number").
  instruction?: string;
  options: string[];
  correctIndex: number;
  timeLimitMs: number;
  // General Knowledge only.
  explanation?: string;
  category?: string;
};

export type QuizAnswer = {
  // Index of the chosen option, or null for a timeout.
  choice: number | null;
  // Time from the question being shown to the answer (or the deadline).
  timeMs: number;
};

export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 100;
export const PERFECT_STAGE_BONUS = 200;
// Below this, an answer is too fast to be a human reading the question: it
// still counts as correct, but earns no speed bonus.
export const MIN_HUMAN_ANSWER_MS = 250;
// Grace for network/render jitter at the deadline.
export const DEADLINE_GRACE_MS = 400;

// 1.2s of 8s → big bonus (85), 4s → medium (50), 7.5s → small (6).
export function speedBonus(timeMs: number, limitMs: number): number {
  if (timeMs < MIN_HUMAN_ANSWER_MS) return 0;
  const ratio = Math.min(1, Math.max(0, timeMs / limitMs));
  return Math.round(MAX_SPEED_BONUS * (1 - ratio));
}

export type QuizStageResult = {
  score: number;
  correct: number;
  wrong: number;
  timeouts: number;
  total: number;
  accuracy: number; // 0–100
  fastestMs: number | null; // fastest CORRECT answer
  averageMs: number | null;
  bestStreak: number;
  passed: boolean;
  perfect: boolean;
  perQuestion: { correct: boolean; timedOut: boolean; points: number }[];
};

// The single scoring function — the server runs it on the questions it
// stored in the session; nothing the client computed is trusted.
export function scoreQuizStage(
  questions: Pick<QuizQuestion, "correctIndex" | "timeLimitMs">[],
  answers: QuizAnswer[],
  passCorrect: number
): QuizStageResult {
  let score = 0;
  let correct = 0;
  let wrong = 0;
  let timeouts = 0;
  let streak = 0;
  let bestStreak = 0;
  let fastestMs: number | null = null;
  let answeredMs = 0;
  let answeredCount = 0;
  const perQuestion = questions.map((question, i) => {
    const answer = answers[i];
    const late =
      !answer ||
      answer.choice === null ||
      answer.timeMs > question.timeLimitMs + DEADLINE_GRACE_MS;
    if (late) {
      timeouts += 1;
      streak = 0;
      return { correct: false, timedOut: true, points: 0 };
    }
    const timeMs = Math.max(0, Math.min(answer.timeMs, question.timeLimitMs));
    answeredMs += timeMs;
    answeredCount += 1;
    if (answer.choice !== question.correctIndex) {
      wrong += 1;
      streak = 0;
      return { correct: false, timedOut: false, points: 0 };
    }
    correct += 1;
    streak += 1;
    bestStreak = Math.max(bestStreak, streak);
    if (timeMs >= MIN_HUMAN_ANSWER_MS) {
      fastestMs = fastestMs === null ? timeMs : Math.min(fastestMs, timeMs);
    }
    const points = BASE_POINTS + speedBonus(timeMs, question.timeLimitMs);
    score += points;
    return { correct: true, timedOut: false, points };
  });
  const total = questions.length;
  const perfect = total > 0 && correct === total;
  if (perfect) score += PERFECT_STAGE_BONUS;
  return {
    score,
    correct,
    wrong,
    timeouts,
    total,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    fastestMs,
    averageMs: answeredCount ? Math.round(answeredMs / answeredCount) : null,
    bestStreak,
    passed: correct >= passCorrect,
    perfect,
    perQuestion,
  };
}

// ── Stage map helpers (UI) ──────────────────────────────────────────────
export type StageState = "completed" | "current" | "unlocked" | "locked";

export function stageState(
  stage: number,
  progress: {
    currentStage: number;
    highestUnlockedStage: number;
    completedStages: number[];
  } | null
): StageState {
  const current = progress?.currentStage ?? 1;
  const highest = progress?.highestUnlockedStage ?? 1;
  if (stage === current && stage <= highest) return "current";
  if (progress?.completedStages.includes(stage)) return "completed";
  return stage <= highest ? "unlocked" : "locked";
}
