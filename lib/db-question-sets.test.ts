// Protected Doctor Question Sets on a real Postgres (PGlite): lifecycle,
// codes, redemption (including races), the access rule and ownership.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "./test-fixtures/pglite-db";
import {
  IDS,
  seedPeople,
  simulatePipelineDone,
  TEST_HMAC_KEY,
} from "./test-fixtures/question-sets";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  getDb: () => holder.db,
  requireDb: () => holder.db,
}));

import {
  archiveQuestionSet,
  bookHasPublishedQuestionSet,
  createQuestionSet,
  disableQuestionSet,
  enableQuestionSet,
  generateAccessCodes,
  hasLiveQuestionSets,
  listAccessCodes,
  listMyQuestionSets,
  listQuestionSetCatalog,
  listSetStudents,
  publishQuestionSet,
  redeemAccessCode,
  RedeemError,
  revokeAccessCode,
  revokeStudentAccess,
  updateQuestionSetSettings,
} from "./db-question-sets";
import { getQuestionSetAccess } from "./question-set-access";

let test: TestDb;
const settings = { title: "Anatomy Midterm", visibility: "unlisted" as const };

async function newPublishedSet(ownerId: string = IDS.doctorA) {
  const set = await createQuestionSet(ownerId, settings, {
    fileName: "anatomy.pdf",
    fileKey: `book-pdfs/${ownerId}/x.pdf`,
  });
  const pipeline = await simulatePipelineDone(test.client, set.bookId);
  const published = await publishQuestionSet(ownerId, set.id);
  expect(published).toEqual({ ok: true, questionCount: 3 });
  return { ...set, ...pipeline };
}

async function codesFor(setId: string, n: number, owner: string = IDS.doctorA) {
  const result = await generateAccessCodes(owner, setId, n);
  return result!.codes;
}

function access(userId: string, setId: string, role?: string) {
  return getQuestionSetAccess({ id: userId, role }, setId);
}

async function expectRedeemFails(
  userId: string,
  code: string,
  kind: "invalid" | "rate_limited" = "invalid"
) {
  await expect(redeemAccessCode(userId, code, null)).rejects.toMatchObject({
    kind,
  });
}

beforeAll(async () => {
  process.env.QUESTION_SET_CODE_HMAC_KEY = TEST_HMAC_KEY;
  test = await createTestDb();
  holder.db = test.db;
  await seedPeople(test.client);
}, 60_000);

beforeEach(async () => {
  // Rate-limit counters must not leak between tests.
  await test.client.query(`DELETE FROM question_set_redeem_attempts`);
});

describe("creating and publishing", () => {
  it("creates the set over an ordinary question-file book (same pipeline)", async () => {
    const set = await createQuestionSet(IDS.doctorA, settings, {
      fileName: "bank.pdf",
      fileKey: `book-pdfs/${IDS.doctorA}/bank.pdf`,
    });
    const book = await test.client.query<{
      sourceType: string;
      status: string;
      subjectId: string | null;
      userId: string;
    }>(
      `SELECT "sourceType", status, "subjectId", "userId" FROM books WHERE id = $1`,
      [set.bookId]
    );
    expect(book.rows[0]).toEqual({
      sourceType: "question_file",
      status: "extracting",
      subjectId: null,
      userId: IDS.doctorA,
    });
  });

  it("refuses to publish before the pipeline has finished, or for another doctor", async () => {
    const set = await createQuestionSet(IDS.doctorA, settings, {
      fileName: "b.pdf",
      fileKey: "k",
    });
    expect(await publishQuestionSet(IDS.doctorA, set.id)).toEqual({
      ok: false,
      reason: "not_ready",
    });
    await simulatePipelineDone(test.client, set.bookId);
    // One question still waiting for its AI enrichment → not ready.
    await test.client.query(
      `UPDATE extracted_questions SET "aiStatus" = 'processing' WHERE "bookId" = $1 AND "orderIndex" = 0`,
      [set.bookId]
    );
    expect((await publishQuestionSet(IDS.doctorA, set.id)).ok).toBe(false);
    await test.client.query(
      `UPDATE extracted_questions SET "aiStatus" = 'complete' WHERE "bookId" = $1`,
      [set.bookId]
    );
    expect(await publishQuestionSet(IDS.doctorB, set.id)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect((await publishQuestionSet(IDS.doctorA, set.id)).ok).toBe(true);
    expect(await publishQuestionSet(IDS.doctorA, set.id)).toEqual({
      ok: false,
      reason: "not_draft",
    });
  });

  it("refuses a book with no extracted questions", async () => {
    const set = await createQuestionSet(IDS.doctorA, settings, {
      fileName: "empty.pdf",
      fileKey: "k",
    });
    await test.client.query(
      `UPDATE books SET status = 'complete' WHERE id = $1`,
      [set.bookId]
    );
    expect((await publishQuestionSet(IDS.doctorA, set.id)).ok).toBe(false);
  });

  it("rejects an end date before the start date", async () => {
    await expect(
      createQuestionSet(
        IDS.doctorA,
        {
          ...settings,
          startsAt: new Date("2026-10-05"),
          endsAt: new Date("2026-10-01"),
        },
        { fileName: "w.pdf", fileKey: "k" }
      )
    ).rejects.toThrow();
  });

  it("protects a published set's book from deletion and its doctor's account", async () => {
    const set = await newPublishedSet();
    expect(await bookHasPublishedQuestionSet(set.bookId)).toBe(true);
    expect(await hasLiveQuestionSets(IDS.doctorA)).toBe(true);
    await archiveQuestionSet({ id: IDS.doctorA, role: "doctor" }, set.id);
    expect(await bookHasPublishedQuestionSet(set.bookId)).toBe(false);
  });
});

describe("access codes", () => {
  it("generates strong NL-XXXX-XXXX-XXXX codes and stores only hashes", async () => {
    const set = await newPublishedSet();
    const codes = await codesFor(set.id, 50);
    expect(codes).toHaveLength(50);
    expect(new Set(codes).size).toBe(50);
    for (const code of codes) {
      expect(code).toMatch(
        /^NL-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/
      );
    }
    const dump = JSON.stringify(
      (await test.client.query(`SELECT * FROM question_set_access_codes`)).rows
    );
    const audit = JSON.stringify(
      (await test.client.query(`SELECT * FROM question_set_audit_events`)).rows
    );
    for (const code of codes.slice(0, 10)) {
      const raw = code.replace(/^NL-/, "").replace(/-/g, "");
      expect(dump).not.toContain(raw);
      expect(audit).not.toContain(raw);
    }
    expect(await listAccessCodes(IDS.doctorA, set.id)).toHaveLength(50);
  });

  it("only generates for the owner, and only for a published set", async () => {
    const set = await newPublishedSet();
    expect(await generateAccessCodes(IDS.doctorB, set.id, 5)).toBeNull();
    const draft = await createQuestionSet(IDS.doctorA, settings, {
      fileName: "d.pdf",
      fileKey: "k",
    });
    expect(await generateAccessCodes(IDS.doctorA, draft.id, 5)).toBeNull();
    expect(await listAccessCodes(IDS.doctorB, set.id)).toEqual([]);
  });

  it("refuses to run without the HMAC key", async () => {
    const set = await newPublishedSet();
    const saved = process.env.QUESTION_SET_CODE_HMAC_KEY;
    delete process.env.QUESTION_SET_CODE_HMAC_KEY;
    try {
      await expect(generateAccessCodes(IDS.doctorA, set.id, 1)).rejects.toThrow(
        /QUESTION_SET_CODE_HMAC_KEY/
      );
    } finally {
      process.env.QUESTION_SET_CODE_HMAC_KEY = saved;
    }
  });
});

describe("redeeming", () => {
  it("claims a code once and creates an entitlement", async () => {
    const set = await newPublishedSet();
    const [code] = await codesFor(set.id, 1);
    expect(await access(IDS.student1, set.id)).toBeNull();
    // Any case, spaces, no prefix — still the same code.
    const typed = ` ${code.toLowerCase().replace(/^nl-/, "")} `;
    expect(await redeemAccessCode(IDS.student1, typed, null)).toEqual({
      outcome: "added",
      setId: set.id,
    });
    expect(await access(IDS.student1, set.id)).toMatchObject({
      role: "entitled",
      bookId: set.bookId,
    });
  });

  it("same student, same code again: 'already added', nothing consumed", async () => {
    const set = await newPublishedSet();
    const [code] = await codesFor(set.id, 1);
    await redeemAccessCode(IDS.student1, code, null);
    expect(await redeemAccessCode(IDS.student1, code, null)).toEqual({
      outcome: "already",
      setId: set.id,
    });
  });

  it("an already-entitled student doesn't burn a second code", async () => {
    const set = await newPublishedSet();
    const [first, second] = await codesFor(set.id, 2);
    await redeemAccessCode(IDS.student1, first, null);
    expect((await redeemAccessCode(IDS.student1, second, null)).outcome).toBe(
      "already"
    );
    const unused = await listAccessCodes(IDS.doctorA, set.id, {
      status: "unused",
    });
    expect(unused).toHaveLength(1);
    // …and that second code still works for someone else.
    expect((await redeemAccessCode(IDS.student2, second, null)).outcome).toBe(
      "added"
    );
  });

  it("another student's code fails generically", async () => {
    const set = await newPublishedSet();
    const [code] = await codesFor(set.id, 1);
    await redeemAccessCode(IDS.student1, code, null);
    await expectRedeemFails(IDS.student2, code);
    expect(await access(IDS.student2, set.id)).toBeNull();
  });

  it("two students racing for one code: exactly one wins", async () => {
    const set = await newPublishedSet();
    const [code] = await codesFor(set.id, 1);
    const results = await Promise.allSettled([
      redeemAccessCode(IDS.student1, code, null),
      redeemAccessCode(IDS.student2, code, null),
    ]);
    const winners = results.filter(r => r.status === "fulfilled");
    const losers = results.filter(r => r.status === "rejected");
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect((losers[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      RedeemError
    );
    const claimed = await test.client.query(
      `SELECT count(*)::int AS n FROM question_set_entitlements WHERE "setId" = $1`,
      [set.id]
    );
    expect(claimed.rows[0]).toEqual({ n: 1 });
  });

  it("one student racing two codes of the same set: one entitlement, one code used", async () => {
    const set = await newPublishedSet();
    const [a, b] = await codesFor(set.id, 2);
    const results = await Promise.all([
      redeemAccessCode(IDS.student1, a, null),
      redeemAccessCode(IDS.student1, b, null),
    ]);
    expect(results.map(r => r.outcome).sort()).toEqual(["added", "already"]);
    const rows = await test.client.query<{ status: string }>(
      `SELECT status FROM question_set_access_codes WHERE "setId" = $1`,
      [set.id]
    );
    expect(rows.rows.map(r => r.status).sort()).toEqual(["claimed", "unused"]);
  });

  it("garbage, unknown, revoked, disabled-set and ended-set codes all fail the same way", async () => {
    const set = await newPublishedSet();
    const [revoked, onDisabled, onEnded] = await codesFor(set.id, 3);
    await expectRedeemFails(IDS.student1, "hello");
    await expectRedeemFails(IDS.student1, "NL-0000-0000-0000");

    const [revokedRow] = (
      await listAccessCodes(IDS.doctorA, set.id, {
        search: revoked.slice(-4),
      })
    ).filter(row => row.hint === revoked.slice(-4));
    expect(await revokeAccessCode(IDS.doctorA, revokedRow.id)).toBe(true);
    await expectRedeemFails(IDS.student1, revoked);

    await test.client.query(`DELETE FROM question_set_redeem_attempts`);
    await disableQuestionSet({ id: IDS.doctorA, role: "doctor" }, set.id);
    await expectRedeemFails(IDS.student1, onDisabled);
    await enableQuestionSet({ id: IDS.doctorA, role: "doctor" }, set.id);

    await test.client.query(
      `UPDATE question_sets SET "endsAt" = now() - interval '1 minute', "startsAt" = null WHERE id = $1`,
      [set.id]
    );
    await expectRedeemFails(IDS.student1, onEnded);
  });

  it("blocks redemption before the start date", async () => {
    const set = await newPublishedSet();
    const [code] = await codesFor(set.id, 1);
    await test.client.query(
      `UPDATE question_sets SET "startsAt" = now() + interval '1 day' WHERE id = $1`,
      [set.id]
    );
    await expectRedeemFails(IDS.student1, code);
    await test.client.query(
      `UPDATE question_sets SET "startsAt" = now() - interval '1 minute' WHERE id = $1`,
      [set.id]
    );
    expect((await redeemAccessCode(IDS.student1, code, null)).outcome).toBe(
      "added"
    );
  });

  it("rate limits after 5 failures per student (and per IP), then answers 429-style", async () => {
    for (let i = 0; i < 5; i++) {
      await expectRedeemFails(IDS.student2, `NL-0000-0000-000${i}`);
    }
    await expectRedeemFails(IDS.student2, "NL-0000-0000-0009", "rate_limited");

    const ip = "ip-hash-for-test";
    for (let i = 0; i < 20; i++) {
      const who = i % 2 ? IDS.student1 : IDS.admin;
      await test.client.query(
        `INSERT INTO question_set_redeem_attempts ("userId", "ipHash", outcome) VALUES ($1, $2, 'invalid')`,
        [who, ip]
      );
    }
    await expect(
      redeemAccessCode(IDS.doctorB, "NL-0000-0000-0001", ip)
    ).rejects.toMatchObject({ kind: "rate_limited" });
  });
});

describe("the access rule", () => {
  async function entitledSet() {
    const set = await newPublishedSet();
    const [code] = await codesFor(set.id, 1);
    await redeemAccessCode(IDS.student1, code, null);
    return set;
  }

  it("owner and admin can open, other users and doctors cannot", async () => {
    const set = await entitledSet();
    expect((await access(IDS.doctorA, set.id))?.role).toBe("owner");
    expect((await access(IDS.admin, set.id, "admin"))?.role).toBe("admin");
    expect(await access(IDS.student2, set.id)).toBeNull();
    expect(await access(IDS.doctorB, set.id)).toBeNull();
    // A user id claiming a role the session didn't give it isn't the point
    // here — but a non-uuid set id is never even queried.
    expect(await access(IDS.student1, "not-a-uuid")).toBeNull();
  });

  it("revoking a student stops their access immediately, keeping the record", async () => {
    const set = await entitledSet();
    const [row] = await listSetStudents(IDS.doctorA, set.id);
    expect(
      await revokeStudentAccess(
        { id: IDS.doctorB, role: "doctor" },
        row.entitlementId
      )
    ).toBe(false);
    expect(
      await revokeStudentAccess(
        { id: IDS.doctorA, role: "doctor" },
        row.entitlementId
      )
    ).toBe(true);
    expect(await access(IDS.student1, set.id)).toBeNull();
    const [after] = await listSetStudents(IDS.doctorA, set.id);
    expect(after.status).toBe("revoked");
  });

  it("the kill switch stops every student and brings them back", async () => {
    const set = await entitledSet();
    expect(
      await disableQuestionSet({ id: IDS.doctorB, role: "doctor" }, set.id)
    ).toBe(false);
    expect(
      await disableQuestionSet({ id: IDS.doctorA, role: "doctor" }, set.id)
    ).toBe(true);
    expect(await access(IDS.student1, set.id)).toBeNull();
    expect((await access(IDS.doctorA, set.id))?.role).toBe("owner");
    expect(
      await enableQuestionSet({ id: IDS.doctorA, role: "doctor" }, set.id)
    ).toBe(true);
    expect((await access(IDS.student1, set.id))?.role).toBe("entitled");
  });

  it("a doctor can't lift an admin's disable", async () => {
    const set = await entitledSet();
    await disableQuestionSet({ id: IDS.admin, role: "admin" }, set.id);
    expect(
      await enableQuestionSet({ id: IDS.doctorA, role: "doctor" }, set.id)
    ).toBe(false);
    expect(
      await enableQuestionSet({ id: IDS.admin, role: "admin" }, set.id)
    ).toBe(true);
  });

  it("uses the database clock for the window", async () => {
    const set = await entitledSet();
    await test.client.query(
      `UPDATE question_sets SET "endsAt" = now() - interval '1 second' WHERE id = $1`,
      [set.id]
    );
    expect(await access(IDS.student1, set.id)).toBeNull();
    await test.client.query(
      `UPDATE question_sets SET "endsAt" = now() + interval '1 hour', "startsAt" = now() + interval '1 minute' WHERE id = $1`,
      [set.id]
    );
    expect(await access(IDS.student1, set.id)).toBeNull();
    const mine = await listMyQuestionSets(IDS.student1);
    expect(mine.find(s => s.id === set.id)?.availability).toBe("not_started");
    await test.client.query(
      `UPDATE question_sets SET "startsAt" = now() - interval '1 minute' WHERE id = $1`,
      [set.id]
    );
    expect((await access(IDS.student1, set.id))?.role).toBe("entitled");
  });

  it("a suspended doctor's sets close for students and for the doctor", async () => {
    const set = await entitledSet();
    await test.client.query(
      `UPDATE doctor_profiles SET status = 'suspended' WHERE "userId" = $1`,
      [IDS.doctorA]
    );
    try {
      expect(await access(IDS.student1, set.id)).toBeNull();
      expect(await access(IDS.doctorA, set.id)).toBeNull();
      expect((await access(IDS.admin, set.id, "admin"))?.role).toBe("admin");
    } finally {
      await test.client.query(
        `UPDATE doctor_profiles SET status = 'approved' WHERE "userId" = $1`,
        [IDS.doctorA]
      );
    }
    // The account-level suspension counts too.
    await test.client.query(
      `UPDATE users SET "suspendedAt" = now() WHERE id = $1`,
      [IDS.doctorA]
    );
    try {
      expect(await access(IDS.student1, set.id)).toBeNull();
    } finally {
      await test.client.query(
        `UPDATE users SET "suspendedAt" = null WHERE id = $1`,
        [IDS.doctorA]
      );
    }
  });

  it("archiving is final for students", async () => {
    const set = await entitledSet();
    expect(
      await archiveQuestionSet({ id: IDS.doctorB, role: "doctor" }, set.id)
    ).toBe(false);
    expect(
      await archiveQuestionSet({ id: IDS.doctorA, role: "doctor" }, set.id)
    ).toBe(true);
    expect(await access(IDS.student1, set.id)).toBeNull();
    expect(
      await enableQuestionSet({ id: IDS.doctorA, role: "doctor" }, set.id)
    ).toBe(false);
    const mine = await listMyQuestionSets(IDS.student1);
    expect(mine.find(s => s.id === set.id)).toBeUndefined();
  });

  it("other doctors can't touch settings, codes or students of a set", async () => {
    const set = await entitledSet();
    expect(
      await updateQuestionSetSettings(IDS.doctorB, set.id, {
        ...settings,
        title: "x",
      })
    ).toBe(false);
    expect(await generateAccessCodes(IDS.doctorB, set.id, 1)).toBeNull();
    expect(await listSetStudents(IDS.doctorB, set.id)).toEqual([]);
  });
});

describe("catalog", () => {
  it("lists only listed + published sets, metadata only, and listing grants nothing", async () => {
    const listed = await newPublishedSet();
    await updateQuestionSetSettings(IDS.doctorA, listed.id, {
      ...settings,
      title: "Listed set",
      visibility: "listed",
    });
    const unlisted = await newPublishedSet();
    const catalog = await listQuestionSetCatalog(IDS.student2);
    const ids = catalog.map(set => set.id);
    expect(ids).toContain(listed.id);
    expect(ids).not.toContain(unlisted.id);
    const entry = catalog.find(set => set.id === listed.id)!;
    expect(Object.keys(entry).sort()).toEqual(
      [
        "academicYear",
        "description",
        "doctorName",
        "endsAt",
        "examType",
        "id",
        "inMyAccount",
        "questionCount",
        "startsAt",
        "subjectLabel",
        "title",
      ].sort()
    );
    expect(await access(IDS.student2, listed.id)).toBeNull();
  });
});
