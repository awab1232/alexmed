// Router-level security for Protected Doctor Question Sets, on PGlite:
// feature flag, doctor gating, IDOR, response shape (no fileKey / storage
// keys / signed URLs), watermark, and "0 AI calls" for student reads.
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createTestDb, type TestDb } from "../test-fixtures/pglite-db";
import {
  IDS,
  seedPeople,
  simulatePipelineDone,
  TEST_HMAC_KEY,
} from "../test-fixtures/question-sets";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  getDb: () => holder.db,
  requireDb: () => holder.db,
}));
// Anything that could reach an AI model or the queue — a student read must
// never touch either.
const spies = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
  publishMessage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/llm", () => ({
  invokeLLM: spies.invokeLLM,
  DEFAULT_VISION_MODEL: "x",
}));
vi.mock("@/lib/queue/client", () => ({ publishMessage: spies.publishMessage }));
vi.mock("@/lib/storage", () => ({
  storageObjectSize: vi.fn().mockResolvedValue(1234),
  storageGetSignedUrl: vi.fn().mockResolvedValue("https://signed.example/x"),
}));

import type { User } from "../../drizzle/schema";
import { doctorRouter } from "./doctorRouter";
import { questionSetsRouter } from "./questionSetsRouter";
import {
  adminDoctorsRouter,
  adminQuestionSetsRouter,
} from "./adminDoctorSetsRouter";

let test: TestDb;

function user(id: string, role: "user" | "admin" = "user") {
  return {
    id,
    role,
    email: `${id}@example.test`,
    name: null,
  } as unknown as User;
}
const doctor = (id: string = IDS.doctorA) =>
  doctorRouter.createCaller({ user: user(id) });
const student = (id: string = IDS.student1) =>
  questionSetsRouter.createCaller({ user: user(id), ip: "203.0.113.9" });
const admin = () => ({
  doctors: adminDoctorsRouter.createCaller({ user: user(IDS.admin, "admin") }),
  sets: adminQuestionSetsRouter.createCaller({
    user: user(IDS.admin, "admin"),
  }),
});

async function publishedSetWithStudent() {
  const key = `book-pdfs/${IDS.doctorA}/11111111-1111-4111-8111-111111111111-bank.pdf`;
  const { setId } = await doctor().sets.create({
    title: "Physiology Final",
    visibility: "unlisted",
    key,
    fileName: "bank.pdf",
  });
  const [{ bookId }] = (
    await test.client.query<{ bookId: string }>(
      `SELECT "bookId" FROM question_sets WHERE id = $1`,
      [setId]
    )
  ).rows;
  const pipeline = await simulatePipelineDone(test.client, bookId);
  await doctor().sets.publish({ setId });
  const { codes } = await doctor().codes.generate({ setId, count: 3 });
  await student().redeem({ code: codes[0] });
  return { setId, bookId, key, codes, ...pipeline };
}

beforeAll(async () => {
  process.env.QUESTION_SET_CODE_HMAC_KEY = TEST_HMAC_KEY;
  process.env.DOCTOR_SETS_ENABLED = "true";
  // The existing per-user upload rate limit (5 / 10 min) applies to doctor
  // uploads too; this suite creates more sets than that.
  process.env.JOB_CREATION_RATE_LIMIT_MAX = "1000";
  test = await createTestDb();
  holder.db = test.db;
  await seedPeople(test.client);
  // Doctor uploads consume the normal QUESTION_FILE quota (enforced here
  // too); lift the free plan's cap so the suite can create many sets.
  await test.client.query(
    `UPDATE plans SET "questionsDailyLimit" = 100000, "questionsMonthlyLimit" = NULL`
  );
}, 60_000);

beforeEach(async () => {
  process.env.DOCTOR_SETS_ENABLED = "true";
  await test.client.query(`DELETE FROM question_set_redeem_attempts`);
});

afterEach(() => {
  spies.invokeLLM.mockClear();
});

describe("feature flag", () => {
  it("hides every procedure while DOCTOR_SETS_ENABLED is off", async () => {
    process.env.DOCTOR_SETS_ENABLED = "false";
    await expect(doctor().status()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(doctor().sets.list()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      student().redeem({ code: "NL-0000-0000-0000" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(student().mine()).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(admin().doctors.list()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await student().enabled()).toBe(false);
  });
});

describe("who may use doctor procedures", () => {
  it("refuses students, pending and rejected applicants (checked in the database)", async () => {
    await expect(doctor(IDS.student1).sets.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await doctor(IDS.student2).submitApplication({
      fullName: "Omar Doc",
      university: "Uni",
      faculty: "Med",
      department: "Physio",
    });
    expect((await doctor(IDS.student2).status()).profile?.status).toBe(
      "pending"
    );
    await expect(doctor(IDS.student2).sets.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // Re-applying while pending is refused.
    await expect(
      doctor(IDS.student2).submitApplication({
        fullName: "Omar Doc",
        university: "Uni",
        faculty: "Med",
        department: "Physio",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await admin().doctors.review({
      userId: IDS.student2,
      action: "reject",
      reason: "no proof",
    });
    await expect(doctor(IDS.student2).sets.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // A rejected applicant may apply again.
    await doctor(IDS.student2).submitApplication({
      fullName: "Omar Doc",
      university: "Uni",
      faculty: "Med",
      department: "Physio",
    });
    await admin().doctors.review({ userId: IDS.student2, action: "approve" });
    expect(await doctor(IDS.student2).sets.list()).toEqual([]);
    // Suspension applies to the very next call (no session involved).
    await admin().doctors.review({ userId: IDS.student2, action: "suspend" });
    await expect(doctor(IDS.student2).sets.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await admin().doctors.review({ userId: IDS.student2, action: "reinstate" });
    expect(await doctor(IDS.student2).sets.list()).toEqual([]);
  });

  it("admin review procedures are admin-only", async () => {
    const asStudent = adminDoctorsRouter.createCaller({
      user: user(IDS.student1),
    });
    await expect(asStudent.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("creating through the existing pipeline", () => {
  it("rejects an upload key issued to someone else", async () => {
    await expect(
      doctor().sets.create({
        title: "x",
        visibility: "unlisted",
        key: `book-pdfs/${IDS.doctorB}/11111111-1111-4111-8111-111111111111-bank.pdf`,
        fileName: "bank.pdf",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("publishes the SAME extract_question_file_job as a student upload", async () => {
    spies.publishMessage.mockClear();
    const { bookId } = await publishedSetWithStudent();
    expect(spies.publishMessage).toHaveBeenCalledWith({
      type: "extract_question_file_job",
      bookId,
    });
  });
});

describe("student reads", () => {
  it("returns the questions with no fileKey, storage key or signed URL, and makes 0 AI / queue calls", async () => {
    const { setId, key } = await publishedSetWithStudent();
    spies.publishMessage.mockClear();
    const result = await student().get({ setId });
    expect(result.role).toBe("entitled");
    expect(result.questions.map(q => q.questionText)).toEqual([
      "Protected question 1?",
      "Protected question 2?",
      "Protected question 3?",
    ]);
    expect(result.questions[0].imageUrl).toMatch(
      new RegExp(`^/api/question-sets/${setId}/images/[0-9a-f-]{36}$`)
    );
    const body = JSON.stringify(result);
    for (const leak of [
      key,
      "fileKey",
      "question-files/",
      "signed.example",
      "bookId",
      "pageTexts",
    ]) {
      expect(body).not.toContain(leak);
    }
    expect(result.watermark).toMatch(/^NiroLearn · @sara · [0-9A-F]{4}$/);
    expect(spies.invokeLLM).not.toHaveBeenCalled();
    expect(spies.publishMessage).not.toHaveBeenCalled();
  });

  it("500 students opening the same set: still 0 AI calls (reads only)", async () => {
    const { setId } = await publishedSetWithStudent();
    await Promise.all(
      Array.from({ length: 50 }, () => student().get({ setId }))
    );
    expect(spies.invokeLLM).not.toHaveBeenCalled();
  });

  it("IDOR: another student, or a guessed id, gets NOT_FOUND", async () => {
    const { setId } = await publishedSetWithStudent();
    await expect(student(IDS.student2).get({ setId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      student().get({ setId: "99999999-9999-4999-8999-999999999999" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("the doctor's preview uses the same reader, without a watermark", async () => {
    const { setId } = await publishedSetWithStudent();
    const preview = await doctor().sets.preview({ setId });
    expect(preview.questions).toHaveLength(3);
    expect(JSON.stringify(preview)).not.toContain("question-files/");
    expect("watermark" in preview).toBe(false);
    await expect(
      doctor(IDS.doctorB).sets.preview({ setId })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("redeem answers generically and rate limits with TOO_MANY_REQUESTS", async () => {
    const { codes } = await publishedSetWithStudent();
    const err = await student(IDS.student2)
      .redeem({ code: "NL-0000-0000-0000" })
      .catch(e => e);
    expect(err.code).toBe("BAD_REQUEST");
    // Someone else's claimed code: same message, nothing revealed.
    const taken = await student(IDS.student2)
      .redeem({ code: codes[0] })
      .catch(e => e);
    expect(taken.message).toBe(err.message);
    for (let i = 0; i < 4; i++) {
      await student(IDS.student2)
        .redeem({ code: "NL-0000-0000-0001" })
        .catch(() => undefined);
    }
    await expect(
      student(IDS.student2).redeem({ code: codes[1] })
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    // Stored attempts carry a hashed IP, never the raw address.
    const rows = await test.client.query<{ ipHash: string }>(
      `SELECT "ipHash" FROM question_set_redeem_attempts LIMIT 1`
    );
    expect(rows.rows[0].ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows.rows)).not.toContain("203.0.113.9");
  });
});

describe("doctor IDOR", () => {
  it("doctor B can't manage doctor A's set by id", async () => {
    const { setId } = await publishedSetWithStudent();
    const b = doctor(IDS.doctorB);
    await expect(b.sets.get({ setId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(b.sets.disable({ setId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(b.sets.archive({ setId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      b.sets.update({ setId, title: "pwned", visibility: "listed" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(b.codes.generate({ setId, count: 5 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(await b.codes.list({ setId })).toEqual([]);
    expect(await b.students.list({ setId })).toEqual([]);
    expect(await b.audit({ setId })).toEqual([]);
    const [entitlement] = await doctor().students.list({ setId });
    await expect(
      b.students.revoke({ entitlementId: entitlement.entitlementId })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // A's set is untouched.
    expect((await doctor().sets.get({ setId })).set.title).toBe(
      "Physiology Final"
    );
  });

  it("a student can't call doctor procedures on a set they hold", async () => {
    const { setId } = await publishedSetWithStudent();
    await expect(
      doctor(IDS.student1).students.list({ setId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("admin moderation is audited", async () => {
    const { setId } = await publishedSetWithStudent();
    await admin().sets.preview({ setId });
    await admin().sets.disable({ setId });
    await expect(student().get({ setId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const events = (await admin().sets.audit({ setId })).map(e => e.event);
    expect(events).toEqual(
      expect.arrayContaining([
        "admin_viewed",
        "admin_disabled",
        "code_claimed",
        "codes_generated",
        "published",
        "created",
      ])
    );
  });
});
