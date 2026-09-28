import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  createTestDb,
  insertQuestionFile,
  insertUser,
  type TestDb,
} from "./test-fixtures/pglite-db";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  getDb: () => holder.db,
  requireDb: () => holder.db,
}));

import {
  getQuestionFileForUser,
  readQuestionFileContent,
  saveExtractedQuestions,
} from "./db-question-files";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const BOOK = "33333333-3333-4333-8333-333333333333";
const PDF_KEY = "uploads/owner/secret-bank.pdf";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  holder.db = test.db;
  await insertUser(test.client, { id: OWNER });
  await insertUser(test.client, { id: OTHER });
  await insertQuestionFile(test.client, {
    id: BOOK,
    userId: OWNER,
    fileKey: PDF_KEY,
    questions: 2,
  });
  const image = await test.client.query<{ id: string }>(
    `INSERT INTO extracted_question_images ("bookId", "pageNumber", "storageKey")
     VALUES ($1, 1, 'question-files/${BOOK}/page-1_ab12.png') RETURNING id`,
    [BOOK]
  );
  const questions = await test.client.query<{ id: string }>(
    `SELECT id FROM extracted_questions WHERE "bookId" = $1 ORDER BY "orderIndex"`,
    [BOOK]
  );
  await test.client.query(
    `INSERT INTO extracted_question_image_relations ("questionId", "imageId") VALUES ($1, $2)`,
    [questions.rows[0].id, image.rows[0].id]
  );
}, 60_000);

describe("getQuestionFileForUser — safe projection", () => {
  it("returns the owner's questions without the PDF storage key or staging data", async () => {
    const result = await getQuestionFileForUser(OWNER, BOOK);
    expect(result).not.toBeNull();
    expect(result!.book).toEqual({
      id: BOOK,
      fileName: "bank.pdf",
      status: "complete",
      extractionError: null,
      pageCount: 3,
      createdAt: expect.any(Date),
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(PDF_KEY);
    expect(serialized).not.toContain("fileKey");
    expect(serialized).not.toContain("pageTexts");
    expect(serialized).not.toContain("secret staging text");
    expect(serialized).not.toContain("userId");
    expect(serialized).not.toContain("internal worker note");
  });

  it("keeps everything the question cards render, in order", async () => {
    const result = await getQuestionFileForUser(OWNER, BOOK);
    expect(result!.questions.map(q => q.questionText)).toEqual([
      "Question 1?",
      "Question 2?",
    ]);
    expect(result!.questions[0]).toMatchObject({
      options: ["A", "B", "C", "D"],
      extractedAnswerIndex: 1,
      sourcePage: 1,
    });
    // The owner's own file keeps the existing /api/files URL.
    expect(result!.questions[0].imageUrl).toBe(
      `/api/files/question-files/${BOOK}/page-1_ab12.png`
    );
    expect(result!.questions[1].imageUrl).toBeNull();
    expect(result!.coverage.questionsTotal).toBe(2);
  });

  it("returns nothing for another user's question file", async () => {
    expect(await getQuestionFileForUser(OTHER, BOOK)).toBeNull();
  });

  it("never returns a study book through the question-file reader", async () => {
    await test.client.query(
      `UPDATE books SET "sourceType" = 'study_book' WHERE id = $1`,
      [BOOK]
    );
    try {
      expect(await getQuestionFileForUser(OWNER, BOOK)).toBeNull();
    } finally {
      await test.client.query(
        `UPDATE books SET "sourceType" = 'question_file' WHERE id = $1`,
        [BOOK]
      );
    }
  });
});

describe("saveExtractedQuestions — the file's own Arabic", () => {
  it("stores it with the question and marks it 'source'; English-only stays untranslated", async () => {
    const bookId = "55555555-5555-4555-8555-555555555555";
    await insertQuestionFile(test.client, { id: bookId, userId: OWNER });
    await saveExtractedQuestions(bookId, [
      {
        orderIndex: 0,
        questionText: "Bilingual?",
        options: ["a", "b"],
        extractedAnswerIndex: 0,
        extractedAnswerText: "a",
        explanationText: null,
        sourcePage: 1,
        questionTextAr: "ثنائي اللغة؟",
        optionsAr: ["أ", "ب"],
      },
      {
        orderIndex: 1,
        questionText: "English only?",
        options: ["a", "b"],
        extractedAnswerIndex: null,
        extractedAnswerText: null,
        explanationText: null,
        sourcePage: 1,
        questionTextAr: null,
        optionsAr: null,
      },
    ]);
    const { questions } = await readQuestionFileContent(bookId, () => "");
    expect(questions[0]).toMatchObject({
      questionTextAr: "ثنائي اللغة؟",
      optionsAr: ["أ", "ب"],
      translationSource: "source",
    });
    expect(questions[1]).toMatchObject({
      questionTextAr: null,
      optionsAr: null,
      translationSource: null,
    });
  });
});

describe("readQuestionFileContent — image addressing", () => {
  it("lets a caller replace storage-key URLs with its own opaque ones", async () => {
    const content = await readQuestionFileContent(
      BOOK,
      image => `/api/protected-image/${image.imageId}`
    );
    const url = content.questions[0].imageUrl!;
    expect(url).toMatch(/^\/api\/protected-image\/[0-9a-f-]{36}$/);
    expect(JSON.stringify(content)).not.toContain("question-files/");
  });
});
