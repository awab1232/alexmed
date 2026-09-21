import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createMirrorTextJob,
  deleteMirrorJob,
  getMirrorBatchForUser,
  getMirrorJobForUser,
  listMirrorJobsForUser,
  resetMirrorBatchForRetry,
  resetMirrorJobFailedPagesForRetry,
} from "../db-mirror";
import { seedMirrorGeneration } from "../mirror-dispatch";
import { splitTextIntoPages, validateQuestionText } from "../mirror-text";
import { publishMessage } from "../queue/client";
import { assertJobCreationAllowed, RateLimitedError } from "../queue/rateLimit";
import { protectedProcedure, router } from "./trpc";

export const mirrorRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listMirrorJobsForUser(ctx.user.id);
  }),

  // Pasted question text instead of an uploaded PDF. There is nothing to
  // extract, so the job goes straight to generation through the same batch
  // pipeline (and produces the same cards) as a PDF. `target` decides where the
  // cards land: a brand-new file, or an addition to one of the student's
  // existing files — added as its own separate job, never merged into or
  // regenerating the file's earlier cards.
  submitText: protectedProcedure
    .input(
      z.object({
        // Generous raw cap so normalisation (not the schema) decides the
        // user-facing limit message.
        text: z.string().max(200_000),
        depth: z.enum(["quick", "balanced", "detailed"]).default("balanced"),
        target: z.discriminatedUnion("mode", [
          z.object({
            mode: z.literal("new"),
            title: z.string().trim().max(120).optional(),
          }),
          z.object({
            mode: z.literal("append"),
            deckId: z.string().uuid(),
            title: z.string().trim().max(120).optional(),
          }),
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const validation = validateQuestionText(input.text);
      if (!validation.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: validation.error });
      }

      try {
        await assertJobCreationAllowed(ctx.user.id, "mirror");
      } catch (error) {
        if (error instanceof RateLimitedError) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: error.message,
          });
        }
        throw error;
      }

      const created = await createMirrorTextJob(ctx.user.id, {
        title: input.target.title || null,
        depth: input.depth,
        pages: splitTextIntoPages(validation.text),
        deckId: input.target.mode === "append" ? input.target.deckId : null,
      });
      if (!created) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "لم نجد هذا الملف. اختر ملفًا آخر.",
        });
      }

      // started=false means the queue refused the batches; they are already
      // marked failed, so the job page offers "إعادة المحاولة" for them.
      const started = await seedMirrorGeneration(
        created.job.id,
        created.batches
      );
      return {
        jobId: created.job.id,
        deckId: created.deck.id,
        batchCount: created.batches.length,
        started,
      };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await getMirrorJobForUser(ctx.user.id, input.id);
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      }
      return result;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await deleteMirrorJob(ctx.user.id, input.id);
      if (!ok) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      }
      return { success: true } as const;
    }),

  // Student-initiated retry for a batch that exhausted its automatic QStash
  // retry budget — resets it to "pending" with a fresh attempt count and
  // publishes a new message, same as the very first attempt.
  retryBatch: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const batch = await getMirrorBatchForUser(ctx.user.id, input.batchId);
      if (!batch) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      }
      if (batch.status !== "failed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only a failed batch can be retried",
        });
      }
      await resetMirrorBatchForRetry(input.batchId);
      await publishMessage({
        type: "generate_mirror_batch",
        batchId: input.batchId,
        jobId: batch.jobId,
      });
      return { success: true } as const;
    }),

  // Student-initiated retry for a job whose extraction failed on some pages —
  // re-queues only those specific pages (never the whole file, never a page
  // that already succeeded) via resetMirrorJobFailedPagesForRetry, then
  // resumes the same self-chaining extraction loop as a fresh upload.
  retryExtraction: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await getMirrorJobForUser(ctx.user.id, input.jobId);
      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      }
      if (job.job.status !== "failed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only a failed job can have its extraction retried",
        });
      }
      const ok = await resetMirrorJobFailedPagesForRetry(input.jobId);
      if (!ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No failed pages to retry",
        });
      }
      await publishMessage({
        type: "extract_mirror_job",
        jobId: input.jobId,
      });
      return { success: true } as const;
    }),
});
