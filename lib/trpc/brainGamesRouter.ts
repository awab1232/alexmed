import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  BRAIN_GAMES,
  BRAIN_GAME_IDS,
  type BrainGameId,
} from "../brain-games/games";
import {
  BrainGameError,
  getActiveSession,
  getProgressForUser,
  listProgressForUser,
  saveSudokuState,
  startStageSession,
  submitQuizSession,
  submitSudokuSession,
  takeSudokuHint,
} from "../db-brain-games";
import { protectedProcedure, router } from "./trpc";

const gameIdSchema = z.enum(BRAIN_GAME_IDS);
const boardSchema = z.array(z.number().int().min(0).max(9)).length(81);

// Domain errors → tRPC codes the UI branches on (e.g. PRECONDITION_FAILED
// = expired session → offer a fresh start; FORBIDDEN = locked stage).
const CODE_MAP = {
  NOT_FOUND: "NOT_FOUND",
  STAGE_LOCKED: "FORBIDDEN",
  SESSION_EXPIRED: "PRECONDITION_FAILED",
  SESSION_CLOSED: "CONFLICT",
  INVALID_SUBMISSION: "BAD_REQUEST",
  NOT_SOLVED: "UNPROCESSABLE_CONTENT",
  NO_HINTS_LEFT: "TOO_MANY_REQUESTS",
} as const;

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof BrainGameError) {
      throw new TRPCError({
        code: CODE_MAP[error.code],
        message: error.message,
      });
    }
    throw error;
  }
}

function summary(
  gameId: BrainGameId,
  row: Awaited<ReturnType<typeof getProgressForUser>>
) {
  const game = BRAIN_GAMES[gameId];
  return {
    ...game,
    progress: row
      ? {
          currentStage: row.currentStage,
          highestUnlockedStage: row.highestUnlockedStage,
          completedStages: row.completedStages ?? [],
          bestScore: row.bestScore,
          totalScore: row.totalScore,
          totalCorrect: row.totalCorrect,
          totalWrong: row.totalWrong,
          totalAttempts: row.totalAttempts,
          bestTimeMs: row.bestTimeMs,
          bestStreak: row.bestStreak,
          currentStreak: row.currentStreak,
          stageBests: row.stageBests ?? {},
          lastPlayedAt: row.lastPlayedAt?.toISOString() ?? null,
        }
      : null,
  };
}

export const brainGamesRouter = router({
  // Every game with this user's progress (null = never played).
  overview: protectedProcedure.query(async ({ ctx }) => {
    const rows = await listProgressForUser(ctx.user.id);
    const byGame = new Map(rows.map(row => [row.gameId, row]));
    return BRAIN_GAME_IDS.map(id => summary(id, byGame.get(id) ?? null));
  }),

  game: protectedProcedure
    .input(z.object({ gameId: gameIdSchema }))
    .query(async ({ ctx, input }) => {
      const row = await getProgressForUser(ctx.user.id, input.gameId);
      const active = await getActiveSession(ctx.user.id, input.gameId);
      return {
        ...summary(input.gameId, row),
        activeSession: active
          ? { stage: active.stage, startedAt: active.startedAt }
          : null,
      };
    }),

  // The unfinished attempt to resume after a refresh / reopen, if any.
  activeSession: protectedProcedure
    .input(z.object({ gameId: gameIdSchema }))
    .query(({ ctx, input }) => getActiveSession(ctx.user.id, input.gameId)),

  // Server checks the stage is unlocked, generates it and stores it.
  startStage: protectedProcedure
    .input(
      z.object({
        gameId: gameIdSchema,
        stage: z.number().int().min(1).max(1000),
      })
    )
    .mutation(({ ctx, input }) =>
      run(() => startStageSession(ctx.user.id, input.gameId, input.stage))
    ),

  // Idempotent: a repeated submit returns the recorded result.
  submitQuiz: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        answers: z
          .array(
            z.object({
              choice: z.number().int().min(0).max(9).nullable(),
              timeMs: z.number().min(0).max(600_000),
            })
          )
          .max(50),
      })
    )
    .mutation(({ ctx, input }) =>
      run(() => submitQuizSession(ctx.user.id, input.sessionId, input.answers))
    ),

  sudokuSave: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        board: boardSchema,
        notes: z
          .array(z.array(z.number().int().min(1).max(9)).max(9))
          .length(81),
        elapsedMs: z
          .number()
          .min(0)
          .max(30 * 24 * 3600 * 1000),
        mistakes: z.number().int().min(0).max(10_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionId, ...state } = input;
      return { saved: await saveSudokuState(ctx.user.id, sessionId, state) };
    }),

  sudokuHint: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid(), board: boardSchema }))
    .mutation(({ ctx, input }) =>
      run(() => takeSudokuHint(ctx.user.id, input.sessionId, input.board))
    ),

  submitSudoku: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        board: boardSchema,
        elapsedMs: z
          .number()
          .min(0)
          .max(30 * 24 * 3600 * 1000),
        mistakes: z.number().int().min(0).max(10_000),
      })
    )
    .mutation(({ ctx, input }) =>
      run(() =>
        submitSudokuSession(ctx.user.id, input.sessionId, {
          board: input.board,
          elapsedMs: input.elapsedMs,
          mistakes: input.mistakes,
        })
      )
    ),
});
