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

import { isFileKeyAccessibleToUser } from "./db-file-access";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const BOOK = "33333333-3333-4333-8333-333333333333";
const PDF_KEY = "uploads/owner/bank.pdf";
const PAGE_KEY = `question-files/${BOOK}/page-2_ff00.png`;

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
  });
}, 60_000);

describe("isFileKeyAccessibleToUser — question files", () => {
  it("lets the owner read their question file's PDF and page images", async () => {
    expect(await isFileKeyAccessibleToUser(OWNER, PDF_KEY)).toBe(true);
    expect(await isFileKeyAccessibleToUser(OWNER, PAGE_KEY)).toBe(true);
  });

  it("gives any other user neither the PDF nor the page images", async () => {
    expect(await isFileKeyAccessibleToUser(OTHER, PDF_KEY)).toBe(false);
    expect(await isFileKeyAccessibleToUser(OTHER, PAGE_KEY)).toBe(false);
  });

  it("does not open a question file through a book_shares row", async () => {
    // Sharing is study-book only (lib/db-sharing.ts refuses question
    // files); even a row inserted directly must not reach the page images.
    await test.client.query(
      `INSERT INTO book_shares ("bookId", "ownerId", "recipientId", status)
       VALUES ($1, $2, $3, 'accepted')`,
      [BOOK, OWNER, OTHER]
    );
    expect(await isFileKeyAccessibleToUser(OTHER, PAGE_KEY)).toBe(false);
    expect(await isFileKeyAccessibleToUser(OTHER, PDF_KEY)).toBe(false);
  });

  it("still opens a shared study book's PDF to its accepted recipient (unchanged)", async () => {
    const studyBook = "44444444-4444-4444-8444-444444444444";
    const studyKey = "uploads/owner/textbook.pdf";
    await test.client.query(
      `INSERT INTO books (id, "userId", "fileName", "fileKey", "sourceType", status)
       VALUES ($1, $2, 'textbook.pdf', $3, 'study_book', 'complete')`,
      [studyBook, OWNER, studyKey]
    );
    expect(await isFileKeyAccessibleToUser(OTHER, studyKey)).toBe(false);
    await test.client.query(
      `INSERT INTO book_shares ("bookId", "ownerId", "recipientId", status)
       VALUES ($1, $2, $3, 'accepted')`,
      [studyBook, OWNER, OTHER]
    );
    expect(await isFileKeyAccessibleToUser(OTHER, studyKey)).toBe(true);
  });
});
