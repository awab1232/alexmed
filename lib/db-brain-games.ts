// Data access for 🧠 Brain Games. The database is the source of truth:
//  - a stage can only start if it's unlocked for this user;
//  - its content (with answers) is generated and stored here, per session;
//  - a submission is re-scored from that stored copy and checked against
//    the server clock, inside a transaction that locks the session and the
//    progress row — so double submits are idempotent and concurrent
//    submits can't lose each other's progress.
import { and, desc, eq, gt, sql } from "drizzle-orm";
import {
  brainGameProgress,
  brainGameSessions,
  type BrainGameProgress,
} from "../drizzle/schema";
import { getDb, requireDb } from "./db";
import {
  BRAIN_GAMES,
  DEADLINE_GRACE_MS,
  scoreQuizStage,
  type BrainGameId,
  type QuizAnswer,
} from "./brain-games/games";
import { mergeRecentIds } from "./brain-games/general-knowledge";
import {
  applyStageOutcome,
  currentStageAfterStart,
  type ProgressState,
} from "./brain-games/progress";
import { randomSeed } from "./brain-games/rng";
import {
  buildStage,
  publicStage,
  sessionLifetimeMs,
  type QuizPayload,
  type StagePayload,
  type SudokuPayload,
} from "./brain-games/stages";
import {
  isSolved,
  isValidBoardShape,
  nextHint,
  scoreSudoku,
} from "./brain-games/sudoku";

export class BrainGameError extends Error {
  constructor(
    public code:
      | "NOT_FOUND"
      | "STAGE_LOCKED"
      | "SESSION_EXPIRED"
      | "SESSION_CLOSED"
      | "INVALID_SUBMISSION"
      | "NOT_SOLVED"
      | "NO_HINTS_LEFT",
    message: string
  ) {
    super(message);
  }
}

// Slack for clock/network differences when comparing the answer times the
// client reports with the time the server actually saw pass.
const SERVER_TIME_SLACK_MS = 5000;

function toState(row: BrainGameProgress): ProgressState {
  return {
    currentStage: row.currentStage,
    highestUnlockedStage: row.highestUnlockedStage,
    completedStages: row.completedStages ?? [],
    bestScore: row.bestScore,
    totalScore: row.totalScore,
    totalCorrect: row.totalCorrect,
    totalWrong: row.totalWrong,
    totalAttempts: row.totalAttempts,
    bestTimeMs: row.bestTimeMs,
    currentStreak: row.currentStreak,
    bestStreak: row.bestStreak,
    stageBests: row.stageBests ?? {},
  };
}

type Db = ReturnType<typeof requireDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type SessionRow = typeof brainGameSessions.$inferSelect;

// The (user, game) progress row, created on first use and locked for the
// rest of the transaction.
async function lockProgress(tx: Tx, userId: string, gameId: BrainGameId) {
  await tx
    .insert(brainGameProgress)
    .values({ userId, gameId })
    .onConflictDoNothing({
      target: [brainGameProgress.userId, brainGameProgress.gameId],
    });
  const [row] = await tx
    .select()
    .from(brainGameProgress)
    .where(
      and(
        eq(brainGameProgress.userId, userId),
        eq(brainGameProgress.gameId, gameId)
      )
    )
    .for("update");
  return row;
}

// ── Reads ────────────────────────────────────────────────────────────────
export async function listProgressForUser(userId: string) {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(brainGameProgress)
    .where(eq(brainGameProgress.userId, userId));
}

export async function getProgressForUser(userId: string, gameId: BrainGameId) {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(brainGameProgress)
    .where(
      and(
        eq(brainGameProgress.userId, userId),
        eq(brainGameProgress.gameId, gameId)
      )
    );
  return row ?? null;
}

export type PublicSession = {
  sessionId: string;
  gameId: BrainGameId;
  stage: number;
  stageData: ReturnType<typeof publicStage>;
  startedAt: string;
  expiresAt: string;
  serverNow: string;
  clientState: Record<string, unknown> | null;
  hintsUsed: number;
};

function toPublicSession(row: SessionRow): PublicSession {
  return {
    sessionId: row.id,
    gameId: row.gameId as BrainGameId,
    stage: row.stage,
    stageData: publicStage(row.payload as unknown as StagePayload),
    startedAt: row.startedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    serverNow: new Date().toISOString(),
    clientState: row.clientState ?? null,
    hintsUsed: row.hintsUsed,
  };
}

// The in-progress (not expired) session for this game, if any — what a
// refresh / reopen resumes.
export async function getActiveSession(
  userId: string,
  gameId: BrainGameId
): Promise<PublicSession | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(brainGameSessions)
    .where(
      and(
        eq(brainGameSessions.userId, userId),
        eq(brainGameSessions.gameId, gameId),
        eq(brainGameSessions.status, "active"),
        gt(brainGameSessions.expiresAt, new Date())
      )
    )
    .orderBy(desc(brainGameSessions.startedAt))
    .limit(1);
  return row ? toPublicSession(row) : null;
}

// ── Start ────────────────────────────────────────────────────────────────
export async function startStageSession(
  userId: string,
  gameId: BrainGameId,
  stage: number
): Promise<PublicSession> {
  const game = BRAIN_GAMES[gameId];
  if (!Number.isInteger(stage) || stage < 1 || stage > game.totalStages) {
    throw new BrainGameError("STAGE_LOCKED", "هذا المستوى غير موجود.");
  }
  const db = requireDb();
  return db.transaction(async tx => {
    const progress = await lockProgress(tx, userId, gameId);
    if (stage > progress.highestUnlockedStage) {
      throw new BrainGameError(
        "STAGE_LOCKED",
        `أنهِ المستوى ${progress.highestUnlockedStage} أولًا لفتح هذا المستوى.`
      );
    }
    // One live attempt per game: starting again closes older ones (their
    // results can no longer be submitted).
    await tx
      .update(brainGameSessions)
      .set({ status: "abandoned" })
      .where(
        and(
          eq(brainGameSessions.userId, userId),
          eq(brainGameSessions.gameId, gameId),
          eq(brainGameSessions.status, "active")
        )
      );
    const stats = (progress.stats ?? {}) as { recentQuestionIds?: string[] };
    const seed = randomSeed();
    const payload = buildStage(gameId, stage, seed, {
      recentQuestionIds: stats.recentQuestionIds ?? [],
    });
    const now = new Date();
    const [session] = await tx
      .insert(brainGameSessions)
      .values({
        userId,
        gameId,
        stage,
        seed,
        payload: payload as unknown as Record<string, unknown>,
        startedAt: now,
        expiresAt: new Date(now.getTime() + sessionLifetimeMs(gameId)),
      })
      .returning();
    await tx
      .update(brainGameProgress)
      .set({
        currentStage: currentStageAfterStart(toState(progress), stage),
        lastPlayedAt: now,
        updatedAt: now,
      })
      .where(eq(brainGameProgress.id, progress.id));
    return toPublicSession(session);
  });
}

// ── Submit ───────────────────────────────────────────────────────────────
export type StageResult = {
  sessionId: string;
  gameId: BrainGameId;
  stage: number;
  passed: boolean;
  score: number;
  correct: number;
  total: number;
  accuracy: number;
  fastestMs: number | null;
  timeMs: number | null;
  hintsUsed?: number;
  perQuestion?: { correct: boolean; timedOut: boolean; points: number }[];
  unlockedStage: number | null;
  nextStage: number | null;
  bestScore: number;
  stageBestScore: number;
  newBest: boolean;
  // true when this is a repeat of an already-recorded submission.
  duplicate?: boolean;
};

async function lockSession(tx: Tx, userId: string, sessionId: string) {
  const [session] = await tx
    .select()
    .from(brainGameSessions)
    .where(
      and(
        eq(brainGameSessions.id, sessionId),
        eq(brainGameSessions.userId, userId)
      )
    )
    .for("update");
  if (!session) throw new BrainGameError("NOT_FOUND", "الجلسة غير موجودة.");
  return session;
}

function assertOpen(session: SessionRow) {
  if (session.status === "abandoned") {
    throw new BrainGameError(
      "SESSION_CLOSED",
      "بدأت محاولة أحدث لهذه اللعبة، فأُغلقت هذه."
    );
  }
  if (session.expiresAt.getTime() < Date.now()) {
    throw new BrainGameError(
      "SESSION_EXPIRED",
      "انتهت صلاحية هذه الجلسة، ابدأ المستوى من جديد."
    );
  }
}

async function recordOutcome(
  tx: Tx,
  input: {
    userId: string;
    session: SessionRow;
    passed: boolean;
    score: number;
    correct: number;
    wrong: number;
    total: number;
    accuracy: number;
    fastestMs: number | null;
    timeMs: number | null;
    answerStreak: number;
    playedQuestionIds?: string[];
    hintsUsed?: number;
    perQuestion?: StageResult["perQuestion"];
  }
): Promise<StageResult> {
  const { session } = input;
  const gameId = session.gameId as BrainGameId;
  const game = BRAIN_GAMES[gameId];
  const progress = await lockProgress(tx, input.userId, gameId);
  const before = toState(progress);
  const previousStageBest =
    before.stageBests[String(session.stage)]?.score ?? 0;
  const next = applyStageOutcome(
    before,
    {
      stage: session.stage,
      passed: input.passed,
      score: input.score,
      correct: input.correct,
      wrong: input.wrong,
      accuracy: input.accuracy,
      bestTimeMs: input.fastestMs,
      stageTimeMs: input.timeMs,
      answerStreak: input.answerStreak,
    },
    game.totalStages
  );
  const stats = { ...((progress.stats ?? {}) as Record<string, unknown>) };
  if (input.playedQuestionIds?.length) {
    stats.recentQuestionIds = mergeRecentIds(
      (stats.recentQuestionIds as string[] | undefined) ?? [],
      input.playedQuestionIds
    );
  }
  if (input.hintsUsed) {
    stats.hintsUsed = Number(stats.hintsUsed ?? 0) + input.hintsUsed;
  }
  const now = new Date();
  await tx
    .update(brainGameProgress)
    .set({
      currentStage: next.currentStage,
      highestUnlockedStage: next.highestUnlockedStage,
      completedStages: next.completedStages,
      bestScore: next.bestScore,
      totalScore: next.totalScore,
      totalCorrect: next.totalCorrect,
      totalWrong: next.totalWrong,
      totalAttempts: next.totalAttempts,
      bestTimeMs: next.bestTimeMs,
      currentStreak: next.currentStreak,
      bestStreak: next.bestStreak,
      stageBests: next.stageBests,
      stats,
      lastPlayedAt: now,
      updatedAt: now,
    })
    .where(eq(brainGameProgress.id, progress.id));

  const result: StageResult = {
    sessionId: session.id,
    gameId,
    stage: session.stage,
    passed: input.passed,
    score: input.score,
    correct: input.correct,
    total: input.total,
    accuracy: input.accuracy,
    fastestMs: input.fastestMs,
    timeMs: input.timeMs,
    hintsUsed: input.hintsUsed,
    perQuestion: input.perQuestion,
    unlockedStage: next.unlockedStage,
    nextStage:
      input.passed && session.stage < game.totalStages
        ? session.stage + 1
        : null,
    bestScore: next.bestScore,
    stageBestScore: Math.max(previousStageBest, input.passed ? input.score : 0),
    newBest: input.passed && input.score > previousStageBest,
  };
  await tx
    .update(brainGameSessions)
    .set({
      status: "submitted",
      submittedAt: now,
      result: result as unknown as Record<string, unknown>,
      score: input.score,
      passed: input.passed,
    })
    .where(eq(brainGameSessions.id, session.id));
  return result;
}

export function validateQuizAnswers(
  payload: QuizPayload,
  answers: QuizAnswer[],
  serverElapsedMs: number
): void {
  const { questions } = payload;
  if (answers.length !== questions.length) {
    throw new BrainGameError("INVALID_SUBMISSION", "عدد الإجابات غير صحيح.");
  }
  let reported = 0;
  answers.forEach((answer, i) => {
    const valid =
      (answer.choice === null ||
        (Number.isInteger(answer.choice) &&
          answer.choice >= 0 &&
          answer.choice < questions[i].options.length)) &&
      Number.isFinite(answer.timeMs) &&
      answer.timeMs >= 0;
    if (!valid) {
      throw new BrainGameError("INVALID_SUBMISSION", "إجابة غير صالحة.");
    }
    reported += Math.min(
      answer.timeMs,
      questions[i].timeLimitMs + DEADLINE_GRACE_MS
    );
  });
  // The answers can't have taken longer than the time that really passed
  // since the server started the stage.
  if (reported > serverElapsedMs + SERVER_TIME_SLACK_MS) {
    throw new BrainGameError(
      "INVALID_SUBMISSION",
      "توقيت الإجابات لا يطابق وقت الجلسة."
    );
  }
}

export async function submitQuizSession(
  userId: string,
  sessionId: string,
  answers: QuizAnswer[]
): Promise<StageResult> {
  const db = requireDb();
  return db.transaction(async tx => {
    const session = await lockSession(tx, userId, sessionId);
    if (session.status === "submitted" && session.result) {
      return { ...(session.result as unknown as StageResult), duplicate: true };
    }
    assertOpen(session);
    const payload = session.payload as unknown as StagePayload;
    if (payload.kind !== "quiz") {
      throw new BrainGameError("INVALID_SUBMISSION", "نوع الجلسة غير صحيح.");
    }
    validateQuizAnswers(
      payload,
      answers,
      Date.now() - session.startedAt.getTime()
    );
    const scored = scoreQuizStage(
      payload.questions,
      answers,
      payload.passCorrect
    );
    const answeredMs = answers.reduce(
      (sum, a, i) => sum + Math.min(a.timeMs, payload.questions[i].timeLimitMs),
      0
    );
    return recordOutcome(tx, {
      userId,
      session,
      passed: scored.passed,
      score: scored.score,
      correct: scored.correct,
      wrong: scored.wrong + scored.timeouts,
      total: scored.total,
      accuracy: scored.accuracy,
      fastestMs: scored.fastestMs,
      timeMs: answeredMs,
      answerStreak: scored.bestStreak,
      playedQuestionIds:
        session.gameId === "general_knowledge"
          ? payload.questions.map(q => q.id)
          : undefined,
      perQuestion: scored.perQuestion,
    });
  });
}

// ── Sudoku ───────────────────────────────────────────────────────────────
export type SudokuClientState = {
  board: number[];
  notes: number[][];
  elapsedMs: number;
  mistakes: number;
};

export async function saveSudokuState(
  userId: string,
  sessionId: string,
  state: SudokuClientState
): Promise<boolean> {
  const db = requireDb();
  const updated = await db
    .update(brainGameSessions)
    .set({ clientState: state as unknown as Record<string, unknown> })
    .where(
      and(
        eq(brainGameSessions.id, sessionId),
        eq(brainGameSessions.userId, userId),
        eq(brainGameSessions.status, "active")
      )
    )
    .returning({ id: brainGameSessions.id });
  return updated.length > 0;
}

export async function takeSudokuHint(
  userId: string,
  sessionId: string,
  board: number[]
): Promise<{
  index: number;
  value: number;
  hintsUsed: number;
  maxHints: number;
}> {
  const db = requireDb();
  return db.transaction(async tx => {
    const session = await lockSession(tx, userId, sessionId);
    if (session.status !== "active") {
      throw new BrainGameError("SESSION_CLOSED", "هذه الجلسة مغلقة.");
    }
    assertOpen(session);
    const payload = session.payload as unknown as SudokuPayload;
    if (payload.kind !== "sudoku" || !isValidBoardShape(board)) {
      throw new BrainGameError("INVALID_SUBMISSION", "لوحة غير صالحة.");
    }
    if (session.hintsUsed >= payload.maxHints) {
      throw new BrainGameError(
        "NO_HINTS_LEFT",
        "استخدمت كل التلميحات لهذا المستوى."
      );
    }
    const hint = nextHint(board, payload.puzzle, payload.solution);
    if (!hint) {
      throw new BrainGameError("INVALID_SUBMISSION", "اللوحة مكتملة.");
    }
    const [updated] = await tx
      .update(brainGameSessions)
      .set({ hintsUsed: sql`${brainGameSessions.hintsUsed} + 1` })
      .where(eq(brainGameSessions.id, session.id))
      .returning({ hintsUsed: brainGameSessions.hintsUsed });
    return {
      ...hint,
      hintsUsed: updated.hintsUsed,
      maxHints: payload.maxHints,
    };
  });
}

// A human can't fill a cell faster than this — the floor applied to the
// reported solve time (so a faked "2 seconds" earns no time bonus).
const MIN_MS_PER_EMPTY_CELL = 1500;

export async function submitSudokuSession(
  userId: string,
  sessionId: string,
  input: { board: number[]; elapsedMs: number; mistakes: number }
): Promise<StageResult> {
  const db = requireDb();
  return db.transaction(async tx => {
    const session = await lockSession(tx, userId, sessionId);
    if (session.status === "submitted" && session.result) {
      return { ...(session.result as unknown as StageResult), duplicate: true };
    }
    assertOpen(session);
    const payload = session.payload as unknown as StagePayload;
    if (payload.kind !== "sudoku" || !isValidBoardShape(input.board)) {
      throw new BrainGameError("INVALID_SUBMISSION", "لوحة غير صالحة.");
    }
    // Only a correctly solved board completes the stage — anything else is
    // rejected and the session stays open.
    if (
      !isSolved(input.board, payload.puzzle) ||
      input.board.some((v, i) => v !== payload.solution[i])
    ) {
      throw new BrainGameError("NOT_SOLVED", "الحل غير صحيح بعد.");
    }
    const emptyCells = payload.puzzle.filter(v => !v).length;
    const serverElapsed = Date.now() - session.startedAt.getTime();
    const floor = emptyCells * MIN_MS_PER_EMPTY_CELL;
    const reported = Number.isFinite(input.elapsedMs)
      ? input.elapsedMs
      : serverElapsed;
    const timeMs = Math.min(serverElapsed, Math.max(floor, reported));
    const mistakes = Math.max(
      0,
      Math.min(200, Math.floor(input.mistakes || 0))
    );
    const score = scoreSudoku({
      difficulty: payload.difficulty,
      parSeconds: payload.parSeconds,
      seconds: Math.round(timeMs / 1000),
      hintsUsed: session.hintsUsed,
      mistakes,
    });
    return recordOutcome(tx, {
      userId,
      session,
      passed: true,
      score,
      correct: emptyCells,
      wrong: mistakes,
      total: emptyCells,
      accuracy: Math.round((emptyCells / (emptyCells + mistakes)) * 100),
      fastestMs: timeMs,
      timeMs,
      answerStreak: 0,
      hintsUsed: session.hintsUsed,
    });
  });
}
