import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  deleteMirrorJob,
  getMirrorBatchForUser,
  getMirrorJobForUser,
  listMirrorJobsForUser,
  resetMirrorBatchForRetry,
} from "../db-mirror";
import { publishMessage } from "../queue/client";
import { protectedProcedure, router } from "./trpc";

export const mirrorRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listMirrorJobsForUser(ctx.user.id);
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
});
