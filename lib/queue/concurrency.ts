// Belt-and-suspenders concurrency backstop, checked inside each worker
// BEFORE claiming a row — independent of whatever QStash's own Flow Control
// (per-key parallelism, set at publish time in lib/queue/client.ts) is
// already doing. Two layers because Flow Control caps how many QStash
// deliveries are *in flight*, while this counts how many rows are actually
// *processing* in our own DB — a useful second signal if Flow Control is
// ever misconfigured, disabled, or its semantics don't perfectly match ours.
import { and, count, eq } from "drizzle-orm";
import {
  books,
  bookChapters,
  mirrorBatches,
  mirrorJobs,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { getQueueGlobalConcurrency, getQueuePerUserConcurrency } from "./types";

export async function countProcessingGlobal(
  kind: "mirror" | "books"
): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const table = kind === "mirror" ? mirrorBatches : bookChapters;
  const [row] = await db
    .select({ c: count() })
    .from(table)
    .where(eq(table.status, "processing"));
  return Number(row?.c ?? 0);
}

export async function countProcessingForUser(
  userId: string,
  kind: "mirror" | "books"
): Promise<number> {
  const db = getDb();
  if (!db) return 0;

  if (kind === "mirror") {
    const [row] = await db
      .select({ c: count() })
      .from(mirrorBatches)
      .innerJoin(mirrorJobs, eq(mirrorJobs.id, mirrorBatches.jobId))
      .where(
        and(
          eq(mirrorBatches.status, "processing"),
          eq(mirrorJobs.userId, userId)
        )
      );
    return Number(row?.c ?? 0);
  }

  const [row] = await db
    .select({ c: count() })
    .from(bookChapters)
    .innerJoin(books, eq(books.id, bookChapters.bookId))
    .where(
      and(eq(bookChapters.status, "processing"), eq(books.userId, userId))
    );
  return Number(row?.c ?? 0);
}

export async function isGlobalConcurrencyExceeded(
  kind: "mirror" | "books"
): Promise<boolean> {
  const current = await countProcessingGlobal(kind);
  return current >= getQueueGlobalConcurrency();
}

export async function isUserConcurrencyExceeded(
  userId: string,
  kind: "mirror" | "books"
): Promise<boolean> {
  const current = await countProcessingForUser(userId, kind);
  return current >= getQueuePerUserConcurrency();
}
