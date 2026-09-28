// End-to-end: Protected Doctor Question Sets, from "normal user applies" to
// "doctor disables the set", driving the REAL code paths — tRPC routers, the
// REAL question-file pipeline workers (stage 1 text extraction on a real
// PDF, stage 2 page images, stage 3 enrichment), the protected image route
// and /api/files — on a real Postgres (PGlite).
//
// Faked only where the outside world is: the AI model (invokeLLM returns
// canned JSON and counts calls), the S3 bucket (an in-memory map / a local
// file), QStash (messages are captured and delivered to the matching worker
// route in-process), and the session (auth()).
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createTestDb,
  insertUser,
  type TestDb,
} from "./test-fixtures/pglite-db";
import {
  buildQuestionBankPdf,
  IDS,
  seedPeople,
  TEST_HMAC_KEY,
} from "./test-fixtures/question-sets";

const h = vi.hoisted(() => ({
  db: null as unknown,
  session: null as null | { user: { id: string; role?: string } },
  queue: [] as { type: string; bookId?: string }[],
  objects: new Map<string, Buffer>(),
  pdfUrl: "",
  llmCalls: 0,
}));

vi.mock("@/lib/db", () => ({ getDb: () => h.db, requireDb: () => h.db }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => h.session) }));
vi.mock("@/lib/queue/verify", () => ({
  verifyQStashRequest: vi.fn(async () => true),
}));
vi.mock("@/lib/queue/client", () => ({
  publishMessage: vi.fn(async (message: { type: string; bookId?: string }) => {
    h.queue.push(message);
  }),
}));
vi.mock("@/lib/llm", async importOriginal => ({
  ...(await importOriginal<typeof import("./llm")>()),
  invokeLLM: vi.fn(async (params: { max_tokens?: number }) => {
    h.llmCalls++;
    // Stage 2 (page classification) vs stage 3 (question enrichment).
    const content =
      params.max_tokens === 600
        ? JSON.stringify({
            hasImage: true,
            captionEn: "diagram",
            isAtPageEnd: false,
          })
        : JSON.stringify({
            keywords: ["anatomy"],
            explanationAr: "شرح تجريبي",
            inferredAnswerIndex: 1,
          });
    return { choices: [{ message: { content } }] };
  }),
}));
vi.mock("@/lib/storage", () => ({
  storageObjectSize: vi.fn(async () => 2048),
  storageGetSignedUrl: vi.fn(async (key: string) =>
    key.endsWith(".pdf") ? h.pdfUrl : `https://storage.test/${key}`
  ),
  storagePut: vi.fn(async (key: string, data: Buffer) => {
    h.objects.set(key, Buffer.from(data));
    return { key, url: `/api/files/${key}` };
  }),
  storageGet: vi.fn(async (key: string) => ({ key, url: `/api/files/${key}` })),
  deleteObject: vi.fn(),
  deleteObjects: vi.fn(),
}));

import type { User } from "../drizzle/schema";
import { doctorRouter } from "./trpc/doctorRouter";
import { questionSetsRouter } from "./trpc/questionSetsRouter";
import { adminDoctorsRouter } from "./trpc/adminDoctorSetsRouter";
import { questionFilesRouter } from "./trpc/questionFilesRouter";
import { newUploadKey } from "./upload-keys";
import { POST as extractQuestions } from "@/app/api/books/extract-questions/route";
import { POST as extractQuestionImages } from "@/app/api/books/extract-question-images/route";
import { POST as generateQuestionContent } from "@/app/api/books/generate-question-content/route";
import { GET as protectedImage } from "@/app/api/question-sets/[setId]/images/[imageId]/route";
import { GET as filesRoute } from "@/app/api/files/[...key]/route";

const WORKERS: Record<string, (request: Request) => Promise<Response>> = {
  extract_question_file_job: extractQuestions,
  extract_question_file_images: extractQuestionImages,
  generate_question_file_content: generateQuestionContent,
};

const NEW_DOCTOR = "e0000000-0000-4000-8000-00000000000e";
let test: TestDb;

const as = (id: string, role: "user" | "admin" = "user") => ({
  user: { id, role, email: `${id}@x.test`, name: null } as unknown as User,
  ip: "198.51.100.7",
});

// Deliver captured QStash messages to their worker routes until the queue
// drains — the same sequence QStash would run in production.
async function drainQueue() {
  for (let guard = 0; h.queue.length && guard < 200; guard++) {
    const message = h.queue.shift()!;
    const worker = WORKERS[message.type];
    if (!worker) throw new Error(`No worker for ${message.type}`);
    const response = await worker(
      new Request("http://localhost/worker", {
        method: "POST",
        headers: { "upstash-signature": "test" },
        body: JSON.stringify(message),
      })
    );
    expect(response.status).toBeLessThan(500);
  }
}

beforeAll(async () => {
  process.env.DOCTOR_SETS_ENABLED = "true";
  process.env.QUESTION_SET_CODE_HMAC_KEY = TEST_HMAC_KEY;
  process.env.JOB_CREATION_RATE_LIMIT_MAX = "1000";
  const dir = mkdtempSync(path.join(tmpdir(), "nl-e2e-"));
  const pdfPath = path.join(dir, "bank.pdf");
  writeFileSync(pdfPath, buildQuestionBankPdf());
  h.pdfUrl = pathToFileURL(pdfPath).href;
  test = await createTestDb();
  h.db = test.db;
  await seedPeople(test.client);
  await insertUser(test.client, {
    id: NEW_DOCTOR,
    name: "Dr New",
    username: "drnew",
  });
  await test.client.query(
    `UPDATE plans SET "questionsDailyLimit" = 100000, "questionsMonthlyLimit" = NULL`
  );
}, 60_000);

afterAll(() => {
  delete process.env.JOB_CREATION_RATE_LIMIT_MAX;
});

describe("Protected Doctor Question Sets — end to end", () => {
  let setId = "";
  let bookId = "";
  let fileKey = "";
  let codes: string[] = [];

  it("1. a normal user applies and an admin approves them as a doctor", async () => {
    const doctor = doctorRouter.createCaller(as(NEW_DOCTOR));
    await expect(doctor.sets.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await doctor.submitApplication({
      fullName: "Dr. New Doctor",
      university: "University of Jordan",
      faculty: "Medicine",
      department: "Anatomy",
    });
    await adminDoctorsRouter
      .createCaller(as(IDS.admin, "admin"))
      .review({ userId: NEW_DOCTOR, action: "approve" });
    expect((await doctor.status()).approved).toBe(true);
  });

  it("2. the doctor creates a set and the EXISTING question-file pipeline processes the PDF once", async () => {
    const doctor = doctorRouter.createCaller(as(NEW_DOCTOR));
    fileKey = newUploadKey("book-pdfs", NEW_DOCTOR, "bank.pdf");
    ({ setId } = await doctor.sets.create({
      title: "Anatomy Midterm 2026",
      subjectLabel: "Anatomy",
      visibility: "unlisted",
      key: fileKey,
      fileName: "bank.pdf",
    }));
    bookId = (await doctor.sets.get({ setId })).set.bookId;
    expect(h.queue).toEqual([{ type: "extract_question_file_job", bookId }]);

    await drainQueue();

    const { set, coverage } = await doctor.sets.get({ setId });
    expect(set.bookStatus).toBe("complete");
    expect(set.processingDone).toBe(true);
    expect(coverage).toMatchObject({ questionsTotal: 4, done: true });
    // One classification per page + one enrichment per question — once.
    expect(h.llmCalls).toBe(2 + 4);
  }, 120_000);

  it("3. the doctor previews the real extracted questions (no watermark)", async () => {
    const preview = await doctorRouter
      .createCaller(as(NEW_DOCTOR))
      .sets.preview({ setId });
    expect(preview.questions.map(q => q.questionText)).toEqual([
      "Which nerve supplies the deltoid muscle?",
      "Which bone forms the point of the elbow?",
      "Which chamber of the heart pumps blood into the aorta?",
      "What is the normal resting heart rate range in adults?",
    ]);
    expect(preview.questions[0]).toMatchObject({
      options: [
        "Radial nerve",
        "Axillary nerve",
        "Median nerve",
        "Ulnar nerve",
      ],
      extractedAnswerIndex: 1,
      aiExplanationAr: "شرح تجريبي",
      keywords: ["anatomy"],
    });
    // Q4 states no answer → the AI suggestion is kept separately, as today.
    expect(preview.questions[3]).toMatchObject({
      extractedAnswerIndex: null,
      aiInferredAnswerIndex: 1,
    });
    expect(preview.questions[0].imageUrl).toMatch(
      new RegExp(`^/api/question-sets/${setId}/images/`)
    );
  });

  it("4. publish and generate access codes", async () => {
    const doctor = doctorRouter.createCaller(as(NEW_DOCTOR));
    expect(await doctor.sets.publish({ setId })).toEqual({
      ok: true,
      questionCount: 4,
    });
    ({ codes } = await doctor.codes.generate({ setId, count: 10 }));
    expect(codes).toHaveLength(10);
  });

  it("5. a student redeems a code and opens the set in the existing question UI data, watermarked, with 0 AI calls", async () => {
    const student = questionSetsRouter.createCaller(as(IDS.student1));
    const before = h.llmCalls;
    expect(await student.redeem({ code: codes[0] })).toEqual({
      outcome: "added",
      setId,
    });
    expect((await student.mine()).map(s => s.id)).toContain(setId);
    const opened = await student.get({ setId });
    expect(opened.questions).toHaveLength(4);
    expect(opened.watermark).toMatch(/^NiroLearn · @sara · /);
    const body = JSON.stringify(opened);
    expect(body).not.toContain(fileKey);
    expect(body).not.toContain("question-files/");
    expect(body).not.toContain("storage.test");
    for (let i = 0; i < 20; i++) await student.get({ setId });
    expect(h.llmCalls).toBe(before);
    expect(h.queue).toEqual([]);
  });

  it("6. the student gets the image through the protected route, never the PDF", async () => {
    const opened = await questionSetsRouter
      .createCaller(as(IDS.student1))
      .get({ setId });
    const [, , , set, , imageId] = opened.questions[0].imageUrl!.split("/");
    h.session = { user: { id: IDS.student1 } };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("PNG", { status: 200 }))
    );
    try {
      const image = await protectedImage(new Request("http://localhost/x"), {
        params: Promise.resolve({ setId: set, imageId }),
      });
      expect(image.status).toBe(200);
      expect(image.headers.get("cache-control")).toBe("private, no-store");
      expect(image.headers.get("location")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
    // The PDF itself, and the page image by storage key, stay owner-only.
    const pdf = await filesRoute(
      new Request(`http://localhost/api/files/${fileKey}`),
      {
        params: Promise.resolve({ key: fileKey.split("/") }),
      }
    );
    expect(pdf.status).toBe(404);
    const pageKey = [...h.objects.keys()][0];
    const page = await filesRoute(
      new Request(`http://localhost/api/files/${pageKey}`),
      {
        params: Promise.resolve({ key: pageKey.split("/") }),
      }
    );
    expect(page.status).toBe(404);
  });

  it("7. another student can't use the claimed code, or open the set, or reach it via question files", async () => {
    const other = questionSetsRouter.createCaller(as(IDS.student2));
    await expect(other.redeem({ code: codes[0] })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(other.get({ setId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      questionFilesRouter.createCaller(as(IDS.student2)).get({ bookId })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("8. revoking the student ends their access immediately", async () => {
    const doctor = doctorRouter.createCaller(as(NEW_DOCTOR));
    const [entitlement] = await doctor.students.list({ setId });
    await doctor.students.revoke({ entitlementId: entitlement.entitlementId });
    await expect(
      questionSetsRouter.createCaller(as(IDS.student1)).get({ setId })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("9. disabling the set stops every student; enabling restores them", async () => {
    const doctor = doctorRouter.createCaller(as(NEW_DOCTOR));
    const student2 = questionSetsRouter.createCaller(as(IDS.student2));
    await student2.redeem({ code: codes[1] });
    expect((await student2.get({ setId })).questions).toHaveLength(4);
    await doctor.sets.disable({ setId });
    await expect(student2.get({ setId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await doctor.sets.enable({ setId });
    expect((await student2.get({ setId })).questions).toHaveLength(4);
  });

  it("10. a normal student's own question file still works exactly as before", async () => {
    const student = questionFilesRouter.createCaller(as(IDS.student2));
    await test.client.query(
      `INSERT INTO books (id, "userId", "fileName", "fileKey", "sourceType", status)
       VALUES ('f0000000-0000-4000-8000-00000000000f', $1, 'mine.pdf', 'book-pdfs/x/mine.pdf', 'question_file', 'extracting')`,
      [IDS.student2]
    );
    h.queue.push({
      type: "extract_question_file_job",
      bookId: "f0000000-0000-4000-8000-00000000000f",
    });
    await drainQueue();
    const own = await student.get({
      bookId: "f0000000-0000-4000-8000-00000000000f",
    });
    expect(own.book.status).toBe("complete");
    expect(own.questions).toHaveLength(4);
    expect(own.questions[0].imageUrl).toMatch(
      /^\/api\/files\/question-files\//
    );
    expect((await student.list()).map(f => f.id)).toContain(
      "f0000000-0000-4000-8000-00000000000f"
    );
  }, 120_000);
});
