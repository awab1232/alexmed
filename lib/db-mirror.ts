// Data-access layer for مِرآة's server-side generation jobs — mirrors
// lib/db-books.ts's own conventions exactly (same getDb() singleton,
// ownership-scoped queries via joins, safe-empty-default reads, throw-on-write
// when the DB isn't configured), kept separate from lib/db.ts for the same
// reason lib/db-books.ts is: a distinct pipeline with its own lifecycle.
import { and, asc, eq } from "drizzle-orm";
import {
  cards,
  decks,
  mirrorBatches,
  mirrorJobs,
  type MirrorBatch,
} from "../drizzle/schema";
import { getDb } from "./db";
import type { GeneratedCard } from "./pdf-cards";

export type MirrorPageText = { page: number; text: string; hasText: boolean };

// One page per generation batch is intentional for مِرآة: exam PDFs can contain
// many questions on one page, so isolating pages prevents a dense page from
// being crowded out by neighboring pages and makes coverage auditable.
const BATCH_SIZE = 1;
// Keep one AI request comfortably small enough for Vercel/OmniRoute. If a
// page is denser than this, it becomes multiple ordered batches; no text is
// dropped just to fit the request.
const BATCH_MAX_CHARS = 6_000;

type MirrorPageGroup = MirrorPageText[];

function splitMirrorPages(pages: MirrorPageText[]): MirrorPageGroup[] {
  const groups: MirrorPageGroup[] = [];
  let group: MirrorPageGroup = [];
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

export async function createMirrorJobWithBatches(
  userId: string,
  input: {
    fileName: string;
    fileKey: string;
    pageCount: number;
    depth: string;
    pages: MirrorPageText[];
  }
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const [job] = await db
    .insert(mirrorJobs)
    .values({
      userId,
      fileName: input.fileName,
      fileKey: input.fileKey,
      pageCount: input.pageCount,
      depth: input.depth,
    })
    .returning();

  const batchPageGroups = splitMirrorPages(input.pages);

  let batches: {
    id: string;
    orderIndex: number;
    startPage: number;
    endPage: number;
  }[] = [];
  if (batchPageGroups.length) {
    const inserted = await db
      .insert(mirrorBatches)
      .values(
        batchPageGroups.map((group, index) => ({
          jobId: job.id,
          orderIndex: index,
          startPage: group[0].page,
          endPage: group[group.length - 1].page,
          pageTexts: group,
        }))
      )
      .returning({
        id: mirrorBatches.id,
        orderIndex: mirrorBatches.orderIndex,
        startPage: mirrorBatches.startPage,
        endPage: mirrorBatches.endPage,
      });
    // Same caveat as createBookWithChapters: INSERT...RETURNING row order
    // isn't guaranteed, so sort explicitly by the stored orderIndex.
    batches = inserted.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  return { job, batches };
}

export async function listMirrorJobsForUser(userId: string) {
  const db = getDb();
  if (!db) return [];

  return db
    .select({
      id: mirrorJobs.id,
      fileName: mirrorJobs.fileName,
      pageCount: mirrorJobs.pageCount,
      status: mirrorJobs.status,
      deckId: mirrorJobs.deckId,
      createdAt: mirrorJobs.createdAt,
    })
    .from(mirrorJobs)
    .where(eq(mirrorJobs.userId, userId));
}

// Excludes each batch's pageTexts/cards blobs on purpose — this is polled
// repeatedly while a job is generating, so keep the payload light (same
// choice getBookForUser makes for bookChapters).
export async function getMirrorJobForUser(userId: string, jobId: string) {
  const db = getDb();
  if (!db) return null;

  const [job] = await db
    .select()
    .from(mirrorJobs)
    .where(and(eq(mirrorJobs.id, jobId), eq(mirrorJobs.userId, userId)))
    .limit(1);
  if (!job) return null;

  const batches = await db
    .select({
      id: mirrorBatches.id,
      orderIndex: mirrorBatches.orderIndex,
      startPage: mirrorBatches.startPage,
      endPage: mirrorBatches.endPage,
      status: mirrorBatches.status,
      errorMessage: mirrorBatches.errorMessage,
    })
    .from(mirrorBatches)
    .where(eq(mirrorBatches.jobId, jobId))
    .orderBy(asc(mirrorBatches.orderIndex));

  return { job, batches };
}

export async function deleteMirrorJob(userId: string, jobId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const deleted = await db
    .delete(mirrorJobs)
    .where(and(eq(mirrorJobs.id, jobId), eq(mirrorJobs.userId, userId)))
    .returning({ id: mirrorJobs.id });
  return deleted.length > 0;
}

// Ownership check for a batch-scoped action (the generate-batch route) —
// joins through to the owning job's userId rather than trusting batchId
// alone, same pattern as db-books.ts's getChapterForUser. Also surfaces the
// job's `depth` (generation depth lives on the job, not each batch) since
// the caller needs it to build the generation prompt.
export async function getMirrorBatchForUser(
  userId: string,
  batchId: string
): Promise<(MirrorBatch & { depth: string }) | null> {
  const db = getDb();
  if (!db) return null;

  const [row] = await db
    .select({ batch: mirrorBatches, depth: mirrorJobs.depth })
    .from(mirrorBatches)
    .innerJoin(mirrorJobs, eq(mirrorJobs.id, mirrorBatches.jobId))
    .where(and(eq(mirrorBatches.id, batchId), eq(mirrorJobs.userId, userId)))
    .limit(1);

  return row ? { ...row.batch, depth: row.depth } : null;
}

export async function setBatchGenerating(batchId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(mirrorBatches)
    .set({ status: "generating", errorMessage: null, updatedAt: new Date() })
    .where(eq(mirrorBatches.id, batchId));
}

export async function setBatchFailed(batchId: string, errorMessage: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(mirrorBatches)
    .set({ status: "failed", errorMessage, updatedAt: new Date() })
    .where(eq(mirrorBatches.id, batchId));
}

// Completes one batch, then graduates the whole job the moment every batch
// has reached "complete" — this is what lets the client just drive batches
// one at a time (like كتبي's analyze-chapter loop) without a separate
// "finalize" step of its own.
export async function completeBatchGeneration(
  batchId: string,
  jobId: string,
  userId: string,
  generatedCards: GeneratedCard[]
) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(mirrorBatches)
    .set({
      status: "complete",
      cards: generatedCards,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(mirrorBatches.id, batchId));

  const siblings = await db
    .select({ status: mirrorBatches.status })
    .from(mirrorBatches)
    .where(eq(mirrorBatches.jobId, jobId));
  const allComplete = siblings.every(sibling => sibling.status === "complete");
  if (allComplete) {
    await graduateMirrorJob(jobId, userId);
  }
}

// Copies a fully-generated job's cards into a real decks/cards row (the
// established library/browse/SRS-review surface needs no changes as a
// result) and marks the job complete. Idempotent via the deckId-still-null
// check, in case of a rare double-invocation race.
export async function graduateMirrorJob(jobId: string, userId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  await db.transaction(async tx => {
    const [job] = await tx
      .select()
      .from(mirrorJobs)
      .where(and(eq(mirrorJobs.id, jobId), eq(mirrorJobs.userId, userId)))
      .limit(1);
    if (!job || job.deckId) return;

    const batches = await tx
      .select({ cards: mirrorBatches.cards })
      .from(mirrorBatches)
      .where(eq(mirrorBatches.jobId, jobId))
      .orderBy(asc(mirrorBatches.orderIndex));
    const allCards = batches.flatMap(batch => batch.cards ?? []);

    const [deck] = await tx
      .insert(decks)
      .values({
        userId,
        fileName: job.fileName,
        fileKey: job.fileKey,
        pageCount: job.pageCount,
        depth: job.depth,
      })
      .returning();

    if (allCards.length) {
      await tx.insert(cards).values(
        allCards.map(card => ({
          deckId: deck.id,
          question: card.question,
          questionArabic: card.questionArabic,
          answer: card.answer,
          answerArabic: card.answerArabic,
          explanation: card.explanation,
          explanationArabic: card.explanationArabic,
          keyIdea: card.keyIdea,
          keyIdeaArabic: card.keyIdeaArabic,
          keyword: card.keyword,
          keywordArabic: card.keywordArabic,
          sourcePage: card.sourcePage,
          status: card.status,
          confidence: card.confidence,
        }))
      );
    }

    await tx
      .update(mirrorJobs)
      .set({ status: "complete", deckId: deck.id, updatedAt: new Date() })
      .where(eq(mirrorJobs.id, jobId));
  });
}
