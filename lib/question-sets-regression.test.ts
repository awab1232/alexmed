// Regression guards around Protected Doctor Question Sets: the existing
// study-book sharing can't pick up a doctor's set, the existing owner view
// of question files is unchanged, and the new guards used by existing flows
// (book delete, account delete) are harmless before the migration exists.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "./test-fixtures/pglite-db";
import {
  IDS,
  seedPeople,
  simulatePipelineDone,
} from "./test-fixtures/question-sets";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  getDb: () => holder.db,
  requireDb: () => holder.db,
}));

import { createShareRequest } from "./db-sharing";
import { getQuestionFileForUser } from "./db-question-files";
import {
  bookHasPublishedQuestionSet,
  createQuestionSet,
  hasLiveQuestionSets,
  publishQuestionSet,
} from "./db-question-sets";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  holder.db = test.db;
  await seedPeople(test.client);
}, 60_000);

describe("existing flows around a doctor's protected set", () => {
  it("the study-book share mechanism refuses a doctor's question-set book", async () => {
    const set = await createQuestionSet(
      IDS.doctorA,
      { title: "Shared?", visibility: "unlisted" },
      { fileName: "s.pdf", fileKey: "k" }
    );
    await simulatePipelineDone(test.client, set.bookId);
    await publishQuestionSet(IDS.doctorA, set.id);
    await expect(
      createShareRequest(IDS.doctorA, set.bookId, IDS.student1)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const shares = await test.client.query(
      `SELECT count(*)::int AS n FROM book_shares WHERE "bookId" = $1`,
      [set.bookId]
    );
    expect(shares.rows[0]).toEqual({ n: 0 });
  });

  it("the doctor still sees their book as an ordinary question file (owner view unchanged)", async () => {
    const set = await createQuestionSet(
      IDS.doctorB,
      { title: "Own view", visibility: "unlisted" },
      { fileName: "own.pdf", fileKey: "k" }
    );
    await simulatePipelineDone(test.client, set.bookId);
    const own = await getQuestionFileForUser(IDS.doctorB, set.bookId);
    expect(own?.questions).toHaveLength(3);
    // …and nobody else does, entitled or not: students use questionSets.get.
    expect(await getQuestionFileForUser(IDS.student1, set.bookId)).toBeNull();
  });
});

describe("guards before the migration is applied", () => {
  it("treat a missing question_sets table as 'no live sets' instead of failing", async () => {
    const missing = Object.assign(new Error("Failed query"), {
      cause: Object.assign(
        new Error('relation "question_sets" does not exist'),
        {
          code: "42P01",
        }
      ),
    });
    const throwingDb = {
      select: () => ({
        from: () => ({
          where: () => ({ limit: () => Promise.reject(missing) }),
        }),
      }),
    };
    const saved = holder.db;
    holder.db = throwingDb;
    try {
      expect(await hasLiveQuestionSets(IDS.doctorA)).toBe(false);
      expect(await bookHasPublishedQuestionSet(IDS.doctorA)).toBe(false);
    } finally {
      holder.db = saved;
    }
  });

  it("still surface any other database error", async () => {
    const throwingDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.reject(
                Object.assign(new Error("boom"), { code: "57P01" })
              ),
          }),
        }),
      }),
    };
    const saved = holder.db;
    holder.db = throwingDb;
    try {
      await expect(hasLiveQuestionSets(IDS.doctorA)).rejects.toThrow("boom");
    } finally {
      holder.db = saved;
    }
  });
});
