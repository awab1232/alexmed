// Per-user rate limit on JOB CREATION specifically (not on every request) —
// DB-backed rather than a new Redis/Upstash-ratelimit dependency, since the
// check is infrequent (once per upload) and Postgres already has the rows
// needed to count from.
import { and, count, eq, gte } from "drizzle-orm";
import { books, mirrorJobs } from "../../drizzle/schema";
import { getDb } from "../db";
import {
  getJobCreationRateLimitMax,
  getJobCreationRateLimitWindowMinutes,
} from "./types";

export class RateLimitedError extends Error {
  constructor(
    message = "لقد تجاوزت الحد المسموح لإنشاء الملفات، حاول لاحقًا."
  ) {
    super(message);
    this.name = "RateLimitedError";
  }
}

export async function assertJobCreationAllowed(
  userId: string,
  kind: "mirror" | "books"
): Promise<void> {
  const db = getDb();
  if (!db) return; // no DB configured (local tooling) — nothing to enforce

  const table = kind === "mirror" ? mirrorJobs : books;
  const windowStart = new Date(
    Date.now() - getJobCreationRateLimitWindowMinutes() * 60_000
  );

  const [row] = await db
    .select({ c: count() })
    .from(table)
    .where(and(eq(table.userId, userId), gte(table.createdAt, windowStart)));

  if (Number(row?.c ?? 0) >= getJobCreationRateLimitMax()) {
    throw new RateLimitedError();
  }
}
