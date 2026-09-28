// Belt-and-suspenders concurrency backstop, checked inside each worker
// BEFORE claiming a row — independent of whatever QStash's own Flow Control
// (per-key parallelism, set at publish time in lib/queue/client.ts) is
// already doing. Two layers because Flow Control caps how many QStash
// deliveries are *in flight*, while this counts how many rows are actually
// *processing* in our own DB — a useful second signal if Flow Control is
// ever misconfigured, disabled, or its semantics don't perfectly match ours.
import { and, count, eq, gte } from "drizzle-orm";
import {
  adminMaterialBatches,
  adminMaterials,
  books,
  bookChapters,
  chapterGenerationJobs,
  mirrorBatches,
  mirrorJobs,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { getUserPlan } from "../billing/entitlement";
import {
  STALE_GENERATION_JOB_MS,
  staleBookChapterProcessingCutoff,
} from "./claim";
import {
  getAdminMaterialsQueueConcurrency,
  getQueueGlobalConcurrency,
  getQueuePerUserConcurrency,
} from "./types";

type ConcurrencyKind = "mirror" | "books" | "admin_materials";

// On-demand chapter generation (lib/generation-jobs.ts): how many of this
// student's jobs are running right now, across every replica. A job whose
// worker died stops counting once it's stale (same rule as the claim).
export async function countProcessingGenerationForUser(
  userId: string
): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const t = chapterGenerationJobs;
  const [row] = await db
    .select({ c: count() })
    .from(t)
    .where(
      and(
        eq(t.userId, userId),
        eq(t.status, "processing"),
        gte(t.startedAt, new Date(Date.now() - STALE_GENERATION_JOB_MS))
      )
    );
  return Number(row?.c ?? 0);
}

// Same per-student budget as their file processing (the plan's
// processingConcurrency, never below QUEUE_PER_USER_CONCURRENCY), so one
// student with a long book can't hold every generation slot.
export async function isUserGenerationConcurrencyExceeded(
  userId: string
): Promise<boolean> {
  const current = await countProcessingGenerationForUser(userId);
  return current >= (await studentConcurrencyLimit(userId));
}

export async function countProcessingGlobal(
  kind: ConcurrencyKind
): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const table =
    kind === "mirror"
      ? mirrorBatches
      : kind === "books"
        ? bookChapters
        : adminMaterialBatches;
  const [row] = await db
    .select({ c: count() })
    .from(table)
    .where(eq(table.status, "processing"));
  return Number(row?.c ?? 0);
}

// "admin_materials" counts against the uploading admin (ownerAdminId), not a
// student — same rationale as مِرآة/كتبي's per-user cap, just applied to
// whichever admin is currently uploading, so one admin's large batch upload
// can't monopolize the shared admin-materials concurrency budget either.
export async function countProcessingForUser(
  userId: string,
  kind: ConcurrencyKind
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

  if (kind === "admin_materials") {
    const [row] = await db
      .select({ c: count() })
      .from(adminMaterialBatches)
      .innerJoin(
        adminMaterials,
        eq(adminMaterials.id, adminMaterialBatches.materialId)
      )
      .where(
        and(
          eq(adminMaterialBatches.status, "processing"),
          eq(adminMaterials.ownerAdminId, userId)
        )
      );
    return Number(row?.c ?? 0);
  }

  // An abandoned "processing" chapter (worker killed mid-run, see
  // claimBookChapter) must not hold one of the student's slots forever.
  const [row] = await db
    .select({ c: count() })
    .from(bookChapters)
    .innerJoin(books, eq(books.id, bookChapters.bookId))
    .where(
      and(
        eq(bookChapters.status, "processing"),
        eq(books.userId, userId),
        gte(bookChapters.lastStartedAt, staleBookChapterProcessingCutoff())
      )
    );
  return Number(row?.c ?? 0);
}

function globalLimitFor(kind: ConcurrencyKind): number {
  return kind === "admin_materials"
    ? getAdminMaterialsQueueConcurrency()
    : getQueueGlobalConcurrency();
}

export async function isGlobalConcurrencyExceeded(
  kind: ConcurrencyKind
): Promise<boolean> {
  const current = await countProcessingGlobal(kind);
  return current >= globalLimitFor(kind);
}

// 💳 Priority processing: how many of a student's files are analysed in
// parallel comes from their plan (plans.processingConcurrency), never below
// the operator's QUEUE_PER_USER_CONCURRENCY. If the plan can't be read the
// queue keeps working at the base value.
async function studentConcurrencyLimit(userId: string): Promise<number> {
  const base = getQueuePerUserConcurrency();
  try {
    const plan = await getUserPlan(userId);
    return Math.max(base, plan.processingConcurrency);
  } catch (error) {
    console.error("[Queue] Could not read plan for concurrency", error);
    return base;
  }
}

export async function isUserConcurrencyExceeded(
  userId: string,
  kind: ConcurrencyKind
): Promise<boolean> {
  const current = await countProcessingForUser(userId, kind);
  const limit =
    kind === "admin_materials"
      ? getAdminMaterialsQueueConcurrency()
      : await studentConcurrencyLimit(userId);
  return current >= limit;
}
