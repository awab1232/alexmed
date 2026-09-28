// A real, in-process Postgres (PGlite, WASM) with every migration in
// drizzle/migrations applied — for tests that must run actual SQL (atomic
// claims, unique constraints, access decisions) without touching any live
// database. Tests point lib/db at it with:
//
//   const holder = vi.hoisted(() => ({ db: null as unknown }));
//   vi.mock("@/lib/db", () => ({ getDb: () => holder.db, requireDb: () => holder.db }));
//   beforeAll(async () => { holder.db = (await createTestDb()).db; });
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { PglitePreparedQuery } from "drizzle-orm/pglite/session";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../drizzle/migrations");

// Production runs drizzle on postgres-js, whose raw `db.execute(sql…)`
// resolves to the row array itself; drizzle's PGlite driver resolves to
// { rows, fields }. The app's raw queries (billing counters, the AI
// limiter, metrics) index the result as an array, so the test database
// answers in the production shape — the same SQL, the same result shape.
const rawExecute = PglitePreparedQuery.prototype.execute;
PglitePreparedQuery.prototype.execute = async function (
  this: { fields?: unknown; customResultMapper?: unknown },
  ...args: Parameters<typeof rawExecute>
) {
  const result = await rawExecute.apply(this as never, args);
  if (!this.fields && !this.customResultMapper) {
    return (result as unknown as { rows: unknown[] }).rows as never;
  }
  return result;
};

export async function createTestDb() {
  const client = new PGlite();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const text = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of text.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
  }
  return { client, db: drizzle(client) };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

// Minimal rows the question-file tables hang off.
export async function insertUser(
  client: PGlite,
  input: { id: string; name?: string; username?: string; role?: string }
) {
  await client.query(
    `INSERT INTO users (id, name, username, role, email) VALUES ($1, $2, $3, $4, $5)`,
    [
      input.id,
      input.name ?? "Test user",
      input.username ?? null,
      input.role ?? "user",
      `${input.id}@example.test`,
    ]
  );
}

export async function insertQuestionFile(
  client: PGlite,
  input: {
    id: string;
    userId: string;
    status?: string;
    fileKey?: string;
    questions?: number;
  }
) {
  await client.query(
    `INSERT INTO books (id, "userId", "fileName", "fileKey", "sourceType", status, "pageCount", "pageTexts")
     VALUES ($1, $2, 'bank.pdf', $3, 'question_file', $4, 3, '[{"page":1,"text":"secret staging text","hasText":true}]')`,
    [
      input.id,
      input.userId,
      input.fileKey ?? `uploads/${input.userId}/bank.pdf`,
      input.status ?? "complete",
    ]
  );
  for (let i = 0; i < (input.questions ?? 0); i++) {
    await client.query(
      `INSERT INTO extracted_questions ("bookId", "orderIndex", "questionText", options, "extractedAnswerIndex", "sourcePage", "aiStatus", "aiError")
       VALUES ($1, $2, $3, '["A","B","C","D"]', 1, 1, 'complete', 'internal worker note')`,
      [input.id, i, `Question ${i + 1}?`]
    );
  }
}
