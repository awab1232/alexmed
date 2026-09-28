// The question-file extraction worker on a real Postgres (PGlite) and real
// PDFs: text pages are read directly (no OCR), image-only pages go through
// the shared OCR (lib/pdf-ocr.ts — the model call is the only thing faked
// here), resuming in batches across invocations like the study-book worker.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestDb,
  insertUser,
  type TestDb,
} from "@/lib/test-fixtures/pglite-db";
import { buildQuestionBankPdf } from "@/lib/test-fixtures/question-sets";

const h = vi.hoisted(() => ({
  db: null as unknown,
  pdfUrl: "",
  published: [] as unknown[],
  ocrText: new Map<number, string>(),
  ocrFails: new Set<number>(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => h.db, requireDb: () => h.db }));
vi.mock("@/lib/queue/verify", () => ({
  verifyQStashRequest: vi.fn(async () => true),
}));
vi.mock("@/lib/queue/client", () => ({
  publishMessage: vi.fn(async (...args: unknown[]) => {
    h.published.push(args);
  }),
}));
vi.mock("@/lib/storage", () => ({
  storageGetSignedUrl: vi.fn(async () => h.pdfUrl),
}));
vi.mock("@/lib/pdf-ocr", async importOriginal => ({
  ...(await importOriginal<typeof import("@/lib/pdf-ocr")>()),
  ocrPages: vi.fn(async (_parser: unknown, pageNumbers: number[]) => ({
    pages: pageNumbers
      .filter(n => !h.ocrFails.has(n))
      .map(n => ({ page: n, text: h.ocrText.get(n) ?? "", hasText: true })),
    failedPages: pageNumbers.filter(n => h.ocrFails.has(n)),
  })),
}));

import { ocrPages } from "@/lib/pdf-ocr";
import { POST } from "./route";

const USER = "11111111-1111-4111-8111-111111111111";
const mockOcr = ocrPages as unknown as ReturnType<typeof vi.fn>;
let test: TestDb;
let bookCounter = 0;

function usePdf(pages: string[][]) {
  const dir = mkdtempSync(path.join(tmpdir(), "nl-qf-"));
  const file = path.join(dir, "q.pdf");
  writeFileSync(file, buildQuestionBankPdf(pages));
  h.pdfUrl = pathToFileURL(file).href;
}

async function newBook() {
  bookCounter++;
  const id = `20000000-0000-4000-8000-${String(bookCounter).padStart(12, "0")}`;
  await test.client.query(
    `INSERT INTO books (id, "userId", "fileName", "fileKey", "sourceType", status)
     VALUES ($1, $2, 'q.pdf', 'book-pdfs/x/q.pdf', 'question_file', 'extracting')`,
    [id, USER]
  );
  return id;
}

function run(bookId: string) {
  return POST(
    new Request("http://localhost/api/books/extract-questions", {
      method: "POST",
      body: JSON.stringify({ bookId }),
    })
  );
}

async function book(bookId: string) {
  const { rows } = await test.client.query<{
    status: string;
    extractionError: string | null;
    pageTexts: unknown;
    pagesNeedingOcr: unknown;
    questions: number;
  }>(
    `SELECT status, "extractionError", "pageTexts", "pagesNeedingOcr",
       (SELECT count(*)::int FROM extracted_questions q WHERE q."bookId" = b.id) AS questions
     FROM books b WHERE id = $1`,
    [bookId]
  );
  return rows[0];
}

const ocrQuestion = (n: number) =>
  `${n}. Scanned question number ${n}?\nA. One\nB. Two\nC. Three\nD. Four\nAnswer: A`;

beforeAll(async () => {
  test = await createTestDb();
  h.db = test.db;
  await insertUser(test.client, { id: USER });
}, 60_000);

beforeEach(() => {
  h.published = [];
  h.ocrText.clear();
  h.ocrFails.clear();
  mockOcr.mockClear();
  delete process.env.QUEUE_MAX_ATTEMPTS;
});

describe("POST /api/books/extract-questions", () => {
  it("reads a text PDF directly — no OCR call — and hands off to stage 2", async () => {
    usePdf([
      ["1. First?", "A. a", "B. b", "C. c", "D. d", "Answer: A"],
      ["2. Second?", "A. a", "B. b", "C. c", "D. d", "Answer: B"],
    ]);
    const id = await newBook();
    const res = await run(id);
    expect(await res.json()).toMatchObject({
      status: "complete",
      questionCount: 2,
    });
    expect(mockOcr).not.toHaveBeenCalled();
    expect(await book(id)).toMatchObject({
      status: "complete",
      questions: 2,
      pageTexts: null,
      pagesNeedingOcr: null,
    });
    expect(h.published).toEqual([
      [{ type: "extract_question_file_images", bookId: id }],
    ]);
  });

  it("OCRs only the image-only page of a mixed PDF", async () => {
    usePdf([
      ["1. Typed question?", "A. a", "B. b", "C. c", "D. d", "Answer: C"],
      [], // a scanned page: no text layer
    ]);
    h.ocrText.set(2, ocrQuestion(2));
    const id = await newBook();
    await run(id);
    expect(mockOcr).toHaveBeenCalledTimes(1);
    expect(mockOcr.mock.calls[0][1]).toEqual([2]);
    const rows = await test.client.query<{
      questionText: string;
      sourcePage: number;
    }>(
      `SELECT "questionText", "sourcePage" FROM extracted_questions WHERE "bookId" = $1 ORDER BY "orderIndex"`,
      [id]
    );
    expect(rows.rows).toEqual([
      { questionText: "Typed question?", sourcePage: 1 },
      { questionText: "Scanned question number 2?", sourcePage: 2 },
    ]);
    expect(await book(id)).toMatchObject({
      status: "complete",
      pageTexts: null,
    });
  });

  it("reads a fully scanned file in batches of 12, resuming across invocations", async () => {
    const pages = Array.from({ length: 14 }, () => [] as string[]);
    usePdf(pages);
    for (let n = 1; n <= 14; n++) h.ocrText.set(n, ocrQuestion(n));
    const id = await newBook();

    const first = await (await run(id)).json();
    expect(first).toMatchObject({ status: "extracting", remaining: 2 });
    expect(mockOcr.mock.calls[0][1]).toHaveLength(12);
    expect(h.published).toEqual([
      [
        { type: "extract_question_file_job", bookId: id },
        { flowControl: { key: `question-file-extract-${id}`, parallelism: 1 } },
      ],
    ]);
    expect((await book(id)).status).toBe("extracting");

    const second = await (await run(id)).json();
    expect(second).toMatchObject({ status: "complete", questionCount: 14 });
    expect(mockOcr.mock.calls[1][1]).toEqual([13, 14]);
    expect(await book(id)).toMatchObject({ questions: 14, pageTexts: null });
  });

  it("retries a failing OCR page with backoff, then gives up on it without failing the rest", async () => {
    process.env.QUEUE_MAX_ATTEMPTS = "2";
    usePdf([["1. Typed?", "A. a", "B. b", "C. c", "D. d", "Answer: A"], []]);
    h.ocrFails.add(2);
    const id = await newBook();
    const first = await (await run(id)).json();
    expect(first.status).toBe("extracting");
    const [, options] = h.published[0] as [unknown, { delay?: number }];
    expect(options.delay).toBeGreaterThan(0);
    const second = await (await run(id)).json();
    expect(second).toMatchObject({ status: "complete", questionCount: 1 });
  });

  it("fails clearly when even OCR finds no text anywhere", async () => {
    process.env.QUEUE_MAX_ATTEMPTS = "1";
    usePdf([[]]);
    h.ocrFails.add(1);
    const id = await newBook();
    await run(id);
    const row = await book(id);
    expect(row.status).toBe("failed");
    expect(row.extractionError).toMatch(/القراءة الضوئية/);
  });

  it("a second delivery while one is running re-checks later instead of working twice", async () => {
    usePdf([["1. Q?", "A. a", "B. b", "C. c", "D. d", "Answer: A"]]);
    const id = await newBook();
    await test.client.query(
      `UPDATE books SET "extractionLeaseUntil" = now() + interval '5 minutes' WHERE id = $1`,
      [id]
    );
    expect(await (await run(id)).json()).toMatchObject({
      status: "lease_held",
    });
    expect(mockOcr).not.toHaveBeenCalled();
    expect((h.published[0] as [unknown, { delay?: number }])[1].delay).toBe(60);
  });
});
