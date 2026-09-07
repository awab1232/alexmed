import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  archiveAdminMaterial,
  bulkApproveAdminMaterialCards,
  bulkDeleteAdminMaterialCards,
  createAdminMaterialDraft,
  deleteAdminMaterial,
  deleteAdminMaterialCard,
  getAdminMaterialBatchById,
  getAdminMaterialCardsForReview,
  getAdminMaterialStats,
  getAdminMaterialWithBatches,
  listAdminMaterials,
  publishAdminMaterial,
  resetAdminMaterialBatchForRetry,
  startAdminMaterialProcessing,
  updateAdminMaterialCard,
  writeAdminMaterialAuditLog,
} from "../db-admin-materials";
import { publishMessage } from "../queue/client";
import {
  assertJobCreationAllowed,
  RateLimitedError,
} from "../queue/rateLimit";
import { adminProcedure, router } from "./trpc";

// Every procedure here uses adminProcedure (lib/trpc/trpc.ts) — server-side
// rejects anyone whose session role isn't exactly "admin" before the
// handler body ever runs. Never trusts anything from the client to decide
// who's an admin.
export const adminMaterialsRouter = router({
  list: adminProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => listAdminMaterials(input)),

  stats: adminProcedure.query(async () => getAdminMaterialStats()),

  get: adminProcedure
    .input(z.object({ materialId: z.string() }))
    .query(async ({ input }) => {
      const result = await getAdminMaterialWithBatches(input.materialId);
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Material not found" });
      }
      return result;
    }),

  createDraft: adminProcedure
    .input(
      z.object({
        fileName: z.string().min(1),
        fileKey: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        category: z.string().optional(),
        difficulty: z.enum(["easy", "medium", "hard"]).optional(),
        language: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await assertJobCreationAllowed(ctx.user.id, "admin_materials");
      } catch (error) {
        if (error instanceof RateLimitedError) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message });
        }
        throw error;
      }
      const material = await createAdminMaterialDraft(ctx.user.id, input);
      return { materialId: material.id };
    }),

  startProcessing: adminProcedure
    .input(z.object({ materialId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const started = await startAdminMaterialProcessing(
        input.materialId,
        ctx.user.id
      );
      if (!started) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Material is not in draft state",
        });
      }
      try {
        await publishMessage(
          { type: "extract_admin_material", materialId: input.materialId },
          {
            flowControl: {
              key: `admin-material-extract-${input.materialId}`,
              parallelism: 1,
            },
          }
        );
      } catch (error) {
        console.error("[AdminMaterials] Failed to enqueue extraction", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "تعذر بدء المعالجة. حاول مرة أخرى.",
        });
      }
      return { success: true } as const;
    }),

  retryBatch: adminProcedure
    .input(z.object({ batchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const batch = await getAdminMaterialBatchById(input.batchId);
      if (!batch) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      }
      if (batch.status !== "failed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only a failed batch can be retried",
        });
      }
      await resetAdminMaterialBatchForRetry(input.batchId);
      await publishMessage({
        type: "generate_admin_material_batch",
        batchId: input.batchId,
        materialId: batch.materialId,
      });
      await writeAdminMaterialAuditLog(batch.materialId, ctx.user.id, "retry_batch", {
        metadata: { batchId: input.batchId },
      });
      return { success: true } as const;
    }),

  publish: adminProcedure
    .input(z.object({ materialId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await publishAdminMaterial(input.materialId, ctx.user.id);
      if (!ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Material is not ready for review",
        });
      }
      return { success: true } as const;
    }),

  archive: adminProcedure
    .input(z.object({ materialId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await archiveAdminMaterial(input.materialId, ctx.user.id);
      if (!ok) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Material not found" });
      }
      return { success: true } as const;
    }),

  delete: adminProcedure
    .input(z.object({ materialId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await deleteAdminMaterial(input.materialId, ctx.user.id);
      if (!ok) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Material not found" });
      }
      return { success: true } as const;
    }),

  cardsForReview: adminProcedure
    .input(
      z.object({
        materialId: z.string(),
        search: z.string().optional(),
        reviewStatus: z.enum(["pending", "approved", "needs_review"]).optional(),
        confidence: z.enum(["high", "medium", "low"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const { materialId, ...filters } = input;
      return getAdminMaterialCardsForReview(materialId, filters);
    }),

  updateCard: adminProcedure
    .input(
      z.object({
        cardId: z.string(),
        questionEn: z.string().optional(),
        questionAr: z.string().optional(),
        answerEn: z.string().optional(),
        answerAr: z.string().optional(),
        explanationEn: z.string().optional(),
        explanationAr: z.string().optional(),
        keyIdeaEn: z.string().optional(),
        keyIdeaAr: z.string().optional(),
        keywordEn: z.string().optional(),
        keywordAr: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { cardId, ...fields } = input;
      await updateAdminMaterialCard(cardId, fields);
      await writeAdminMaterialAuditLog(null, ctx.user.id, "edit_card", {
        metadata: { cardId },
      });
      return { success: true } as const;
    }),

  deleteCard: adminProcedure
    .input(z.object({ cardId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await deleteAdminMaterialCard(input.cardId);
      await writeAdminMaterialAuditLog(null, ctx.user.id, "delete_card", {
        metadata: { cardId: input.cardId },
      });
      return { success: true } as const;
    }),

  bulkApproveCards: adminProcedure
    .input(z.object({ cardIds: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await bulkApproveAdminMaterialCards(input.cardIds);
      await writeAdminMaterialAuditLog(null, ctx.user.id, "approve_card", {
        metadata: { cardIds: input.cardIds },
      });
      return { success: true } as const;
    }),

  bulkDeleteCards: adminProcedure
    .input(z.object({ cardIds: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await bulkDeleteAdminMaterialCards(input.cardIds);
      await writeAdminMaterialAuditLog(null, ctx.user.id, "delete_card", {
        metadata: { cardIds: input.cardIds },
      });
      return { success: true } as const;
    }),
});
