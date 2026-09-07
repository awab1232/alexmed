import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getPublishedAdminMaterialCardsForStudent,
  getPublishedAdminMaterialForStudent,
  getStudentMaterialProgress,
  listPublishedAdminMaterialsForStudents,
  rateAdminMaterialCard,
  recordAdminMaterialView,
} from "../db-admin-materials";
import { protectedProcedure, router } from "./trpc";

// Student-facing مكتبة الأدمن router — protectedProcedure only (any logged
// -in user, not necessarily an admin). Every read goes through
// lib/db-admin-materials.ts functions that enforce status="published"
// themselves; no procedure here ever accepts a status/visibility flag from
// the client.
export const studentMaterialsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          category: z.string().optional(),
          difficulty: z.enum(["easy", "medium", "hard"]).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => listPublishedAdminMaterialsForStudents(input)),

  get: protectedProcedure
    .input(z.object({ materialId: z.string() }))
    .query(async ({ ctx, input }) => {
      const material = await getPublishedAdminMaterialForStudent(
        input.materialId
      );
      if (!material) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Material not found",
        });
      }
      const progress = await getStudentMaterialProgress(
        input.materialId,
        ctx.user.id
      );
      await recordAdminMaterialView(input.materialId, ctx.user.id);
      return { material, progress };
    }),

  cards: protectedProcedure
    .input(z.object({ materialId: z.string() }))
    .query(async ({ ctx, input }) =>
      getPublishedAdminMaterialCardsForStudent(input.materialId, ctx.user.id)
    ),

  rateCard: protectedProcedure
    .input(
      z.object({
        materialCardId: z.string(),
        rating: z.enum(["hard", "good", "easy"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await rateAdminMaterialCard(
        ctx.user.id,
        input.materialCardId,
        input.rating
      );
      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Card not found or material not published",
        });
      }
      return result;
    }),
});
