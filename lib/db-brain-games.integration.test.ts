// Real-Postgres integration test for 🧠 Brain Games' server guarantees —
// the parts unit tests can't prove: row locking, idempotent submits,
// concurrent submits, locked stages, persistence across "sessions".
// Skipped unless LIVE_DB=1. Uses its own throwaway user
// (brain-games-qa+<time>@example.invalid) and deletes it at the end, which
// cascades to that user's progress and sessions — no other data touched.
//
//   LIVE_DB=1 npx vitest run lib/db-brain-games.integration.test.ts
import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const live = process.env.LIVE_DB === "1";
if (live) loadEnv();

// Each step is a few round trips to a remote Postgres — generous timeout.
describe.skipIf(!live)(
  "Brain Games — real database",
  { timeout: 60_000 },
  () => {
    let userId = "";
    // Imported lazily so the skipped run never opens a DB connection.
    let db: typeof import("./db-brain-games");
    let schema: typeof import("../drizzle/schema");
    let requireDb: typeof import("./db").requireDb;
    let eq: typeof import("drizzle-orm").eq;

    beforeAll(async () => {
      db = await import("./db-brain-games");
      schema = await import("../drizzle/schema");
      ({ requireDb } = await import("./db"));
      ({ eq } = await import("drizzle-orm"));
      const [user] = await requireDb()
        .insert(schema.users)
        .values({
          email: `brain-games-qa+${Date.now()}@example.invalid`,
          name: "Brain Games QA",
        })
        .returning({ id: schema.users.id });
      userId = user.id;
    });

    // Removes this run's QA user and any left over by an interrupted run —
    // matched by the reserved example.invalid test address only.
    afterAll(async () => {
      const { like } = await import("drizzle-orm");
      await requireDb()
        .delete(schema.users)
        .where(like(schema.users.email, "brain-games-qa+%@example.invalid"));
    }, 60_000);

    // Answers that pass/fail a stored quiz stage, with plausible timings.
    const answersFor = (
      session: Awaited<ReturnType<typeof db.startStageSession>>,
      correct: number
    ) => {
      if (session.stageData.kind !== "quiz") throw new Error("not a quiz");
      return session.stageData.questions.map((q, i) => ({
        choice: i < correct ? q.correctIndex : (q.correctIndex + 1) % 4,
        timeMs: 1,
      }));
    };

    it("refuses a locked stage (can't open stage 50 first)", async () => {
      await expect(
        db.startStageSession(userId, "math", 50)
      ).rejects.toMatchObject({ code: "STAGE_LOCKED" });
      await expect(
        db.startStageSession(userId, "math", 2)
      ).rejects.toMatchObject({ code: "STAGE_LOCKED" });
    });

    it("passing stage 1 unlocks 2; the result is re-scored on the server", async () => {
      const session = await db.startStageSession(userId, "math", 1);
      const result = await db.submitQuizSession(
        userId,
        session.sessionId,
        answersFor(session, 9)
      );
      expect(result.passed).toBe(true);
      expect(result.correct).toBe(9);
      expect(result.unlockedStage).toBe(2);
      const progress = await db.getProgressForUser(userId, "math");
      expect(progress?.highestUnlockedStage).toBe(2);
      expect(progress?.currentStage).toBe(2);
      expect(progress?.completedStages).toEqual([1]);
    });

    it("a repeated submit is idempotent (no double score)", async () => {
      const session = await db.startStageSession(userId, "math", 2);
      const answers = answersFor(session, 10);
      const first = await db.submitQuizSession(
        userId,
        session.sessionId,
        answers
      );
      const again = await db.submitQuizSession(
        userId,
        session.sessionId,
        answers
      );
      expect(again.duplicate).toBe(true);
      expect(again.score).toBe(first.score);
      const progress = await db.getProgressForUser(userId, "math");
      expect(progress?.totalAttempts).toBe(2); // stage 1 + stage 2, not 3
    });

    it("concurrent submits of the same session record exactly one result", async () => {
      const session = await db.startStageSession(userId, "math", 3);
      const answers = answersFor(session, 10);
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          db.submitQuizSession(userId, session.sessionId, answers)
        )
      );
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(5);
      const progress = await db.getProgressForUser(userId, "math");
      expect(progress?.totalAttempts).toBe(3);
      expect(progress?.highestUnlockedStage).toBe(4);
    });

    it("concurrent submits across games never lose each other's progress", async () => {
      const a = await db.startStageSession(userId, "multiplication", 1);
      const b = await db.startStageSession(userId, "general_knowledge", 1);
      await Promise.all([
        db.submitQuizSession(userId, a.sessionId, answersFor(a, 10)),
        db.submitQuizSession(userId, b.sessionId, answersFor(b, 10)),
      ]);
      const all = await db.listProgressForUser(userId);
      const by = new Map(all.map(p => [p.gameId, p]));
      expect(by.get("multiplication")?.highestUnlockedStage).toBe(2);
      expect(by.get("general_knowledge")?.highestUnlockedStage).toBe(2);
      expect(by.get("math")?.highestUnlockedStage).toBe(4);
    });

    it("failing keeps the unlocked stage and Continue stays on it", async () => {
      const session = await db.startStageSession(userId, "math", 4);
      const result = await db.submitQuizSession(
        userId,
        session.sessionId,
        answersFor(session, 5)
      );
      expect(result.passed).toBe(false);
      const progress = await db.getProgressForUser(userId, "math");
      expect(progress?.highestUnlockedStage).toBe(4);
      expect(progress?.currentStage).toBe(4);
      expect(progress?.completedStages).toEqual([1, 2, 3]);
    });

    it("rejects answer times the server clock says are impossible", async () => {
      const session = await db.startStageSession(userId, "math", 4);
      if (session.stageData.kind !== "quiz") throw new Error("not a quiz");
      const answers = session.stageData.questions.map(q => ({
        choice: q.correctIndex,
        timeMs: q.timeLimitMs, // 10 × 8s "spent" in a stage started ms ago
      }));
      await expect(
        db.submitQuizSession(userId, session.sessionId, answers)
      ).rejects.toMatchObject({ code: "INVALID_SUBMISSION" });
    });

    it("an in-progress stage is resumable and starting again closes it", async () => {
      const first = await db.startStageSession(userId, "math", 4);
      const active = await db.getActiveSession(userId, "math");
      expect(active?.sessionId).toBe(first.sessionId);
      expect(active?.stage).toBe(4);
      const second = await db.startStageSession(userId, "math", 4);
      await expect(
        db.submitQuizSession(userId, first.sessionId, answersFor(first, 10))
      ).rejects.toMatchObject({ code: "SESSION_CLOSED" });
      expect((await db.getActiveSession(userId, "math"))?.sessionId).toBe(
        second.sessionId
      );
    });

    it("Sudoku: hides the solution, rejects a wrong board, limits hints, resumes, accepts the real solution", async () => {
      const session = await db.startStageSession(userId, "sudoku", 1);
      expect(session.stageData.kind).toBe("sudoku");
      expect(
        (session.stageData as Record<string, unknown>).solution
      ).toBeUndefined();
      if (session.stageData.kind !== "sudoku") return;
      const puzzle = session.stageData.puzzle;
      const { solve } = await import("./brain-games/sudoku");
      const solution = solve(puzzle)!;

      const wrong = [...solution];
      const i = puzzle.indexOf(0);
      wrong[i] = (wrong[i] % 9) + 1;
      await expect(
        db.submitSudokuSession(userId, session.sessionId, {
          board: wrong,
          elapsedMs: 60_000,
          mistakes: 0,
        })
      ).rejects.toMatchObject({ code: "NOT_SOLVED" });

      for (let k = 0; k < 3; k++) {
        const hint = await db.takeSudokuHint(userId, session.sessionId, puzzle);
        expect(hint.value).toBe(solution[hint.index]);
      }
      await expect(
        db.takeSudokuHint(userId, session.sessionId, puzzle)
      ).rejects.toMatchObject({ code: "NO_HINTS_LEFT" });

      expect(
        await db.saveSudokuState(userId, session.sessionId, {
          board: puzzle,
          notes: Array.from({ length: 81 }, () => []),
          elapsedMs: 1234,
          mistakes: 1,
        })
      ).toBe(true);
      const resumed = await db.getActiveSession(userId, "sudoku");
      expect(resumed?.clientState).toMatchObject({
        elapsedMs: 1234,
        mistakes: 1,
      });

      const result = await db.submitSudokuSession(userId, session.sessionId, {
        board: solution,
        elapsedMs: 60_000,
        mistakes: 1,
      });
      expect(result.passed).toBe(true);
      expect(result.hintsUsed).toBe(3);
      expect(result.unlockedStage).toBe(2);
      const progress = await db.getProgressForUser(userId, "sudoku");
      expect(progress?.highestUnlockedStage).toBe(2);
    });

    it("progress persists for the user across fresh reads", async () => {
      const all = await db.listProgressForUser(userId);
      expect(all.map(p => p.gameId).sort()).toEqual([
        "general_knowledge",
        "math",
        "multiplication",
        "sudoku",
      ]);
    });
  }
);
