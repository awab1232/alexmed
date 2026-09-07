// Belt-and-suspenders concurrency backstop, checked inside each worker
// BEFORE claiming a row — independent of whatever QStash's own Flow Control
// (per-key parallelism, set at publish time in lib/queue/client.ts) is
// already doing. Two layers because Flow Control caps how many QStash
// deliveries are *in flight*, while this counts how many rows are actually
// *processing* in our own DB — a useful second signal if Flow Control is
// ever misconfigured, disabled, or its semantics don't perfectly match ours.
import { and, count, eq } from "drizzle-orm";
import {
  adminMaterialBatches,
  adminMaterials,
  books,
  bookChapters,
  mirrorBatches,
  mirrorJobs,
} from "../../drizzle/schema";
import { getDb } from "../db";
import {
  getAdminMaterialsQueueConcurrency,
  getQueueGlobalConcurrency,
  getQueuePerUserConcurrency,
} from "./types";

type ConcurrencyKind = "mirror" | "books" | "admin_materials";

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

  const [row] = await db
    .select({ c: count() })
    .from(bookChapters)
    .innerJoin(books, eq(books.id, bookChapters.bookId))
    .where(
      and(eq(bookChapters.status, "processing"), eq(books.userId, userId))
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

export async function isUserConcurrencyExceeded(
  userId: string,
  kind: ConcurrencyKind
): Promise<boolean> {
  const current = await countProcessingForUser(userId, kind);
  const limit =
    kind === "admin_materials"
      ? getAdminMaterialsQueueConcurrency()
      : getQueuePerUserConcurrency();
  return current >= limit;
}
