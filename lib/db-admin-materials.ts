// Data-access layer for مكتبة الأدمن (Admin Library) — deliberately isolated
// from lib/db-mirror.ts and lib/db-books.ts (separate tables, separate
// helpers, even its own small page-batching function below rather than
// importing مِرآة's) even though the pipeline shape is intentionally the
// same. Same getDb() singleton / ownership-scoped-query / throw-on-write
// conventions as the rest of the app.
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import {
  adminMaterialAuditLogs,
  adminMaterialBatches,
  adminMaterialCards,
  adminMaterialReviews,
  adminMaterials,
  type AdminMaterial,
  type AdminMaterialCard,
} from "../drizzle/schema";
import { getDb } from "./db";
import { applySrsRating, type SrsRating } from "./srs";

export type AdminMaterialPageText = {
  page: number;
  text: string;
  hasText: boolean;
};

export type GeneratedAdminMaterialCard = {
  question: string;
  questionArabic: string;
  answer: string;
  answerArabic: string;
  explanation: string;
  explanationArabic: string;
  keyIdea: string;
  keyIdeaArabic: string;
  keyword: string;
  keywordArabic: string;
  sourcePage: number;
  status: "complete" | "needs_review";
  confidence: "high" | "medium" | "low";
};

// Same batching shape as مِرآة (lib/db-mirror.ts's splitMirrorPages) — kept
// as its own small copy here rather than a cross-import, so this feature's
// data layer has zero dependency on مِرآة's, per the isolation requirement.
const BATCH_SIZE = 2;
const BATCH_MAX_CHARS = 6_000;

type PageGroup = AdminMaterialPageText[];

function splitAdminMaterialPages(pages: AdminMaterialPageText[]): PageGroup[] {
  const groups: PageGroup[] = [];
  let group: PageGroup = [];
  let groupChars = 0;
  const flush = () => {
    if (group.length) groups.push(group);
    group = [];
    groupChars = 0;
  };

  for (const page of pages) {
    const lines = page.text.split("\n");
    let segment = "";
    const segments: string[] = [];
    for (const line of lines) {
      const pieces =
        line.length > BATCH_MAX_CHARS
          ? (line.match(new RegExp(`.{1,${BATCH_MAX_CHARS}}`, "g")) ?? [line])
          : [line];
      for (const piece of pieces) {
        if (segment && segment.length + piece.length + 1 > BATCH_MAX_CHARS) {
          segments.push(segment);
          segment = "";
        }
        segment += `${segment ? "\n" : ""}${piece}`;
      }
    }
    if (segment) segments.push(segment);

    for (const text of segments.length ? segments : [""]) {
      const exceedsPages = group.length >= BATCH_SIZE;
      const exceedsChars =
        group.length > 0 && groupChars + text.length > BATCH_MAX_CHARS;
      if (exceedsPages || exceedsChars) flush();
      group.push({ ...page, text });
      groupChars += text.length;
    }
  }
  flush();
  return groups;
}

async function writeAuditLog(
  materialId: string | null,
  actorUserId: string | null,
  action: string,
  extra?: { metadata?: Record<string, unknown>; ipAddress?: string }
) {
  const db = getDb();
  if (!db) return;
  await db.insert(adminMaterialAuditLogs).values({
    materialId,
    actorUserId,
    action,
    metadata: extra?.metadata,
    ipAddress: extra?.ipAddress,
  });
}
export { writeAuditLog as writeAdminMaterialAuditLog };

// ── Admin: draft → processing ────────────────────────────────────────────

export async function createAdminMaterialDraft(
  adminId: string,
  input: {
    fileName: string;
    fileKey: string;
    title: string;
    description?: string;
    category?: string;
    difficulty?: "easy" | "medium" | "hard";
    language?: string;
  }
): Promise<AdminMaterial> {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const [material] = await db
    .insert(adminMaterials)
    .values({
      ownerAdminId: adminId,
      fileName: input.fileName,
      fileKey: input.fileKey,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? null,
      difficulty: input.difficulty ?? "medium",
      language: input.language ?? "both",
      status: "draft",
    })
    .returning();

  await writeAuditLog(material.id, adminId, "upload");
  return material;
}

// Atomic claim: only a "draft" material can start processing, so a
// double-click of "بدء المعالجة" (or a retried request) can never publish
// two extraction pipelines for the same material.
export async function startAdminMaterialProcessing(
  materialId: string,
  actorUserId: string
): Promise<boolean> {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const claimed = await db
    .update(adminMaterials)
    .set({ status: "processing", updatedAt: new Date() })
    .where(
      and(eq(adminMaterials.id, materialId), eq(adminMaterials.status, "draft"))
    )
    .returning({ id: adminMaterials.id });
  if (claimed.length) {
    await writeAuditLog(materialId, actorUserId, "start_processing");
  }
  return claimed.length > 0;
}

// No-ownership-filter lookup for the extraction queue worker — same
// trust-boundary reasoning as lib/db-mirror.ts's getMirrorJobById.
export async function getAdminMaterialById(
  materialId: string
): Promise<AdminMaterial | null> {
  const db = getDb();
  if (!db) return null;
  const [material] = await db
    .select()
    .from(adminMaterials)
    .where(eq(adminMaterials.id, materialId))
    .limit(1);
  return material ?? null;
}

export async function updateAdminMaterialExtractionProgress(
  materialId: string,
  update: {
    pageCount?: number;
    pageTexts: AdminMaterialPageText[];
    pagesNeedingOcr: number[];
    ocrFailedPages: number[];
  }
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(adminMaterials)
    .set({
      ...(update.pageCount !== undefined
        ? { pageCount: update.pageCount }
        : {}),
      pageTexts: update.pageTexts,
      pagesNeedingOcr: update.pagesNeedingOcr,
      ocrFailedPages: update.ocrFailedPages,
      extractionAttemptCount: sql`${adminMaterials.extractionAttemptCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(adminMaterials.id, materialId));
}

export async function markAdminMaterialExtractionFailed(
  materialId: string,
  errorMessage: string
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(adminMaterials)
    .set({
      status: "failed",
      extractionError: errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(adminMaterials.id, materialId));
}

// Creates the generation batches once extraction is fully done — the
// material's own status stays "processing" through both the extraction and
// generation sub-phases (the admin lifecycle has no separate "extracting"
// state the way مِرآة's does; the admin progress screen distinguishes the
// two sub-phases from whether batches exist yet, not from a status value).
export async function finalizeAdminMaterialExtraction(
  materialId: string,
  pages: AdminMaterialPageText[]
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const batchPageGroups = splitAdminMaterialPages(pages);

  let batches: {
    id: string;
    batchIndex: number;
    startPage: number;
    endPage: number;
  }[] = [];
  if (batchPageGroups.length) {
    const inserted = await db
      .insert(adminMaterialBatches)
      .values(
        batchPageGroups.map((group, index) => ({
          materialId,
          batchIndex: index,
          startPage: group[0].page,
          endPage: group[group.length - 1].page,
          pageTexts: group,
        }))
      )
      .returning({
        id: adminMaterialBatches.id,
        batchIndex: adminMaterialBatches.batchIndex,
        startPage: adminMaterialBatches.startPage,
        endPage: adminMaterialBatches.endPage,
      });
    batches = inserted.sort((a, b) => a.batchIndex - b.batchIndex);
  }

  await db
    .update(adminMaterials)
    .set({
      pageTexts: null,
      pagesNeedingOcr: null,
      ocrFailedPages: null,
      extractionError: null,
      updatedAt: new Date(),
    })
    .where(eq(adminMaterials.id, materialId));

  return { batches };
}

// ── Admin: generation batches ────────────────────────────────────────────

export async function getAdminMaterialBatchById(batchId: string) {
  const db = getDb();
  if (!db) return null;
  const [batch] = await db
    .select()
    .from(adminMaterialBatches)
    .where(eq(adminMaterialBatches.id, batchId))
    .limit(1);
  return batch ?? null;
}

export async function markAdminMaterialBatchRetrying(
  batchId: string,
  errorMessage: string
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(adminMaterialBatches)
    .set({
      status: "retrying",
      errorMessage,
      lastErrorAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(adminMaterialBatches.id, batchId));
}

export async function markAdminMaterialBatchFailedTerminal(
  batchId: string,
  errorMessage: string
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(adminMaterialBatches)
    .set({
      status: "failed",
      errorMessage,
      lastErrorAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(adminMaterialBatches.id, batchId));
}

// Admin-initiated retry of one failed batch — resets its attempt budget; the
// caller (tRPC mutation) republishes a fresh generate_admin_material_batch
// message afterward, same as مِرآة's retryBatch.
export async function resetAdminMaterialBatchForRetry(batchId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(adminMaterialBatches)
    .set({
      status: "pending",
      attemptCount: 0,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(adminMaterialBatches.id, batchId));
}

// Completes one batch AND inserts its cards in a single transaction (the
// spec's explicit requirement) — safe to call at most once per batch: the
// caller only reaches here after claimAdminMaterialBatch's atomic claim
// (WHERE status IN ('pending','failed','retrying')) succeeded, so a given
// batchId can never have two concurrent/duplicate generations both trying
// to insert its cards, and a retried batch's earlier (failed) attempt never
// reaches this function at all.
export async function completeAdminMaterialBatchGeneration(
  batchId: string,
  materialId: string,
  generatedCards: GeneratedAdminMaterialCard[]
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  await db.transaction(async tx => {
    await tx
      .update(adminMaterialBatches)
      .set({
        status: "complete",
        errorMessage: null,
        lastCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(adminMaterialBatches.id, batchId));

    if (generatedCards.length) {
      await tx.insert(adminMaterialCards).values(
        generatedCards.map(card => ({
          materialId,
          batchId,
          questionEn: card.question,
          questionAr: card.questionArabic,
          answerEn: card.answer,
          answerAr: card.answerArabic,
          explanationEn: card.explanation,
          explanationAr: card.explanationArabic,
          keyIdeaEn: card.keyIdea,
          keyIdeaAr: card.keyIdeaArabic,
          keywordEn: card.keyword,
          keywordAr: card.keywordArabic,
          sourcePage: card.sourcePage,
          confidence: card.confidence,
          // The AI's own "needs_review" signal becomes the card's starting
          // review flag for the admin's queue; otherwise it starts "pending"
          // (awaiting the admin's explicit approval before publish, but not
          // flagged as a quality concern).
          reviewStatus: (card.status === "needs_review"
            ? "needs_review"
            : "pending") as "pending" | "needs_review",
        }))
      );
    }
  });
}

// Idempotent finalize (SELECT...FOR UPDATE, same pattern as
// finalizeMirrorJobIfDone): all batches complete -> ready_for_review
// (snapshotting cardCount); any batch still failed after exhausting
// retries -> "failed" (distinct from مِرآة's partial_failed — nothing is
// visible to students either way until the admin publishes, so there's no
// "good enough, ship it" state here; the admin retries the failed batches
// and this flips back to ready_for_review once they all succeed).
export async function finalizeAdminMaterialIfDone(materialId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  await db.transaction(async tx => {
    const [material] = await tx
      .select()
      .from(adminMaterials)
      .where(eq(adminMaterials.id, materialId))
      .for("update");
    if (!material || material.status !== "processing") return;

    const siblings = await tx
      .select({ status: adminMaterialBatches.status })
      .from(adminMaterialBatches)
      .where(eq(adminMaterialBatches.materialId, materialId));
    if (!siblings.length) return;

    const stillWorking = siblings.some(
      sibling =>
        sibling.status === "pending" ||
        sibling.status === "processing" ||
        sibling.status === "retrying"
    );
    if (stillWorking) return;

    const anyFailed = siblings.some(sibling => sibling.status === "failed");
    if (anyFailed) {
      await tx
        .update(adminMaterials)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(adminMaterials.id, materialId));
      return;
    }

    const [{ c: cardCount }] = await tx
      .select({ c: count() })
      .from(adminMaterialCards)
      .where(eq(adminMaterialCards.materialId, materialId));

    await tx
      .update(adminMaterials)
      .set({
        status: "ready_for_review",
        cardCount: Number(cardCount ?? 0),
        updatedAt: new Date(),
      })
      .where(eq(adminMaterials.id, materialId));
  });
}

// ── Admin: publish / archive / delete ────────────────────────────────────

export async function publishAdminMaterial(
  materialId: string,
  actorUserId: string
): Promise<boolean> {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const [{ c: cardCount }] = await db
    .select({ c: count() })
    .from(adminMaterialCards)
    .where(eq(adminMaterialCards.materialId, materialId));

  const claimed = await db
    .update(adminMaterials)
    .set({
      status: "published",
      cardCount: Number(cardCount ?? 0),
      publishedAt: new Date(),
      archivedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(adminMaterials.id, materialId),
        eq(adminMaterials.status, "ready_for_review")
      )
    )
    .returning({ id: adminMaterials.id });

  if (claimed.length) {
    await writeAuditLog(materialId, actorUserId, "publish");
  }
  return claimed.length > 0;
}

// "إخفاء"/"أرشفة" both map to this single state per the approved design —
// no separate hidden-but-not-archived state exists in the lifecycle.
export async function archiveAdminMaterial(
  materialId: string,
  actorUserId: string
): Promise<boolean> {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const archived = await db
    .update(adminMaterials)
    .set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(adminMaterials.id, materialId))
    .returning({ id: adminMaterials.id });
  if (archived.length) {
    await writeAuditLog(materialId, actorUserId, "archive");
  }
  return archived.length > 0;
}

export async function deleteAdminMaterial(
  materialId: string,
  actorUserId: string
): Promise<boolean> {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const [material] = await db
    .select({ fileName: adminMaterials.fileName, title: adminMaterials.title })
    .from(adminMaterials)
    .where(eq(adminMaterials.id, materialId))
    .limit(1);
  if (!material) return false;

  // Logged before the row (and its cascade-deleted children) actually
  // disappears, since admin_material_audit_logs has no FK to survive on —
  // the file/title context is captured directly in metadata instead.
  await writeAuditLog(materialId, actorUserId, "delete_material", {
    metadata: { fileName: material.fileName, title: material.title },
  });

  const deleted = await db
    .delete(adminMaterials)
    .where(eq(adminMaterials.id, materialId))
    .returning({ id: adminMaterials.id });
  return deleted.length > 0;
}

// ── Admin: browsing/reviewing ─────────────────────────────────────────────

export async function listAdminMaterials(filters?: { search?: string }) {
  const db = getDb();
  if (!db) return [];

  const conditions = [];
  if (filters?.search) {
    const like = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(adminMaterials.title, like),
        ilike(adminMaterials.fileName, like)
      )
    );
  }

  return db
    .select()
    .from(adminMaterials)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(adminMaterials.createdAt));
}

export async function getAdminMaterialStats() {
  const db = getDb();
  if (!db) {
    return {
      total: 0,
      published: 0,
      processing: 0,
      readyForReview: 0,
      failed: 0,
      publishedCardCount: 0,
      reviewEventCount: 0,
    };
  }

  const rows = await db
    .select({ status: adminMaterials.status, c: count() })
    .from(adminMaterials)
    .groupBy(adminMaterials.status);
  const byStatus = Object.fromEntries(rows.map(r => [r.status, Number(r.c)]));

  const [{ c: publishedCardCount }] = await db
    .select({ c: count() })
    .from(adminMaterialCards)
    .innerJoin(
      adminMaterials,
      eq(adminMaterials.id, adminMaterialCards.materialId)
    )
    .where(eq(adminMaterials.status, "published"));

  const [{ c: reviewEventCount }] = await db
    .select({ c: count() })
    .from(adminMaterialReviews);

  const total = rows.reduce((sum, r) => sum + Number(r.c), 0);

  return {
    total,
    published: byStatus.published ?? 0,
    processing: byStatus.processing ?? 0,
    readyForReview: byStatus.ready_for_review ?? 0,
    failed: byStatus.failed ?? 0,
    publishedCardCount: Number(publishedCardCount ?? 0),
    reviewEventCount: Number(reviewEventCount ?? 0),
  };
}

export async function getAdminMaterialWithBatches(materialId: string) {
  const db = getDb();
  if (!db) return null;
  const material = await getAdminMaterialById(materialId);
  if (!material) return null;

  const batches = await db
    .select({
      id: adminMaterialBatches.id,
      batchIndex: adminMaterialBatches.batchIndex,
      startPage: adminMaterialBatches.startPage,
      endPage: adminMaterialBatches.endPage,
      status: adminMaterialBatches.status,
      errorMessage: adminMaterialBatches.errorMessage,
    })
    .from(adminMaterialBatches)
    .where(eq(adminMaterialBatches.materialId, materialId))
    .orderBy(asc(adminMaterialBatches.batchIndex));

  // Live count, not material.cardCount (which is only a snapshot taken at
  // ready_for_review/published) — the admin's own progress screen needs the
  // real-time number while batches are still generating.
  const [{ c: liveCardCount }] = await db
    .select({ c: count() })
    .from(adminMaterialCards)
    .where(eq(adminMaterialCards.materialId, materialId));

  return { material, batches, liveCardCount: Number(liveCardCount ?? 0) };
}

export async function getAdminMaterialCardsForReview(
  materialId: string,
  filters?: {
    search?: string;
    reviewStatus?: "pending" | "approved" | "needs_review";
    confidence?: "high" | "medium" | "low";
  }
): Promise<AdminMaterialCard[]> {
  const db = getDb();
  if (!db) return [];

  const conditions = [eq(adminMaterialCards.materialId, materialId)];
  if (filters?.reviewStatus) {
    conditions.push(eq(adminMaterialCards.reviewStatus, filters.reviewStatus));
  }
  if (filters?.confidence) {
    conditions.push(eq(adminMaterialCards.confidence, filters.confidence));
  }
  if (filters?.search) {
    const like = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(adminMaterialCards.questionEn, like),
        ilike(adminMaterialCards.questionAr, like),
        ilike(adminMaterialCards.keywordEn, like)
      )!
    );
  }

  return db
    .select()
    .from(adminMaterialCards)
    .where(and(...conditions))
    .orderBy(asc(adminMaterialCards.sourcePage));
}

export async function updateAdminMaterialCard(
  cardId: string,
  fields: Partial<
    Pick<
      AdminMaterialCard,
      | "questionEn"
      | "questionAr"
      | "answerEn"
      | "answerAr"
      | "explanationEn"
      | "explanationAr"
      | "keyIdeaEn"
      | "keyIdeaAr"
      | "keywordEn"
      | "keywordAr"
      | "reviewStatus"
    >
  >
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(adminMaterialCards)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(adminMaterialCards.id, cardId));
}

export async function deleteAdminMaterialCard(cardId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(adminMaterialCards).where(eq(adminMaterialCards.id, cardId));
}

export async function bulkDeleteAdminMaterialCards(cardIds: string[]) {
  const db = getDb();
  if (!db || !cardIds.length) return;
  await db
    .delete(adminMaterialCards)
    .where(inArray(adminMaterialCards.id, cardIds));
}

export async function bulkApproveAdminMaterialCards(cardIds: string[]) {
  const db = getDb();
  if (!db || !cardIds.length) return;
  await db
    .update(adminMaterialCards)
    .set({ reviewStatus: "approved", updatedAt: new Date() })
    .where(inArray(adminMaterialCards.id, cardIds));
}

// ── Student: published-only reads ────────────────────────────────────────
// Every function below enforces status="published" itself — never accepts a
// status from the caller, and never trusts a query-string/body value.

export async function listPublishedAdminMaterialsForStudents(filters?: {
  search?: string;
  category?: string;
  difficulty?: "easy" | "medium" | "hard";
}) {
  const db = getDb();
  if (!db) return [];

  const conditions = [eq(adminMaterials.status, "published")];
  if (filters?.category)
    conditions.push(eq(adminMaterials.category, filters.category));
  if (filters?.difficulty)
    conditions.push(eq(adminMaterials.difficulty, filters.difficulty));
  if (filters?.search) {
    const like = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(adminMaterials.title, like),
        ilike(adminMaterials.description, like)
      )!
    );
  }

  return db
    .select({
      id: adminMaterials.id,
      title: adminMaterials.title,
      description: adminMaterials.description,
      category: adminMaterials.category,
      difficulty: adminMaterials.difficulty,
      pageCount: adminMaterials.pageCount,
      cardCount: adminMaterials.cardCount,
      publishedAt: adminMaterials.publishedAt,
    })
    .from(adminMaterials)
    .where(and(...conditions))
    .orderBy(desc(adminMaterials.publishedAt));
}

// Returns null for anything not currently "published" — draft/processing/
// ready_for_review/archived/failed are all indistinguishable from
// "not found" to a student, by design.
export async function getPublishedAdminMaterialForStudent(materialId: string) {
  const db = getDb();
  if (!db) return null;
  const [material] = await db
    .select()
    .from(adminMaterials)
    .where(
      and(
        eq(adminMaterials.id, materialId),
        eq(adminMaterials.status, "published")
      )
    )
    .limit(1);
  return material ?? null;
}

export async function getPublishedAdminMaterialCardsForStudent(
  materialId: string,
  userId: string
) {
  const db = getDb();
  if (!db) return [];

  // Ownership/visibility gate lives in the WHERE clause itself (joined
  // through to adminMaterials.status), not left to the caller.
  const rows = await db
    .select({
      card: adminMaterialCards,
      review: adminMaterialReviews,
    })
    .from(adminMaterialCards)
    .innerJoin(
      adminMaterials,
      eq(adminMaterials.id, adminMaterialCards.materialId)
    )
    .leftJoin(
      adminMaterialReviews,
      and(
        eq(adminMaterialReviews.materialCardId, adminMaterialCards.id),
        eq(adminMaterialReviews.userId, userId)
      )
    )
    .where(
      and(
        eq(adminMaterialCards.materialId, materialId),
        eq(adminMaterials.status, "published")
      )
    )
    .orderBy(asc(adminMaterialCards.sourcePage));

  return rows.map(row => ({ ...row.card, review: row.review }));
}

export async function getStudentMaterialProgress(
  materialId: string,
  userId: string
) {
  const db = getDb();
  if (!db) return { total: 0, reviewed: 0, dueToday: 0 };

  const [{ c: total }] = await db
    .select({ c: count() })
    .from(adminMaterialCards)
    .innerJoin(
      adminMaterials,
      eq(adminMaterials.id, adminMaterialCards.materialId)
    )
    .where(
      and(
        eq(adminMaterialCards.materialId, materialId),
        eq(adminMaterials.status, "published")
      )
    );

  const [{ c: reviewed }] = await db
    .select({ c: count() })
    .from(adminMaterialReviews)
    .innerJoin(
      adminMaterialCards,
      eq(adminMaterialCards.id, adminMaterialReviews.materialCardId)
    )
    .where(
      and(
        eq(adminMaterialCards.materialId, materialId),
        eq(adminMaterialReviews.userId, userId)
      )
    );

  const [{ c: dueToday }] = await db
    .select({ c: count() })
    .from(adminMaterialReviews)
    .innerJoin(
      adminMaterialCards,
      eq(adminMaterialCards.id, adminMaterialReviews.materialCardId)
    )
    .where(
      and(
        eq(adminMaterialCards.materialId, materialId),
        eq(adminMaterialReviews.userId, userId),
        lte(adminMaterialReviews.dueAt, new Date())
      )
    );

  return {
    total: Number(total ?? 0),
    reviewed: Number(reviewed ?? 0),
    dueToday: Number(dueToday ?? 0),
  };
}

// Upsert-by-rating: verifies the card's material is still "published" before
// touching anything (a student can't keep rating cards from a material an
// admin just archived), then applies the same SM-2 scheduling مِرآة/كتبي use.
export async function rateAdminMaterialCard(
  userId: string,
  materialCardId: string,
  rating: SrsRating
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const [row] = await db
    .select({ materialStatus: adminMaterials.status })
    .from(adminMaterialCards)
    .innerJoin(
      adminMaterials,
      eq(adminMaterials.id, adminMaterialCards.materialId)
    )
    .where(eq(adminMaterialCards.id, materialCardId))
    .limit(1);
  if (!row || row.materialStatus !== "published") return null;

  const [existing] = await db
    .select({
      easeFactor: adminMaterialReviews.easeFactor,
      intervalDays: adminMaterialReviews.intervalDays,
      reviewCount: adminMaterialReviews.reviewCount,
    })
    .from(adminMaterialReviews)
    .where(
      and(
        eq(adminMaterialReviews.userId, userId),
        eq(adminMaterialReviews.materialCardId, materialCardId)
      )
    )
    .limit(1);

  const update = applySrsRating(
    existing ?? { easeFactor: 2.5, intervalDays: 0, reviewCount: 0 },
    rating
  );

  await db
    .insert(adminMaterialReviews)
    .values({
      materialCardId,
      userId,
      easeFactor: update.easeFactor,
      intervalDays: update.intervalDays,
      dueAt: update.dueAt,
      reviewCount: update.reviewCount,
      lastRating: rating,
      lastReviewedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        adminMaterialReviews.userId,
        adminMaterialReviews.materialCardId,
      ],
      set: {
        easeFactor: update.easeFactor,
        intervalDays: update.intervalDays,
        dueAt: update.dueAt,
        reviewCount: update.reviewCount,
        lastRating: rating,
        lastReviewedAt: new Date(),
      },
    });

  return update;
}

export async function recordAdminMaterialView(
  materialId: string,
  userId: string,
  ipAddress?: string
) {
  await writeAuditLog(materialId, userId, "view_material", { ipAddress });
}
