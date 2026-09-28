// 🔒 Admin moderation for Protected Doctor Question Sets — part of the
// existing admin surface (adminProcedure + app/admin/*), gated by the
// feature flag as well. Admins act through the same data functions and the
// same access rule as everyone else (role "admin" in
// lib/question-set-access.ts), and every action is audited.
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { listDoctorsForAdmin, reviewDoctor } from "../db-doctors";
import { readQuestionFileContent } from "../db-question-files";
import { recordQuestionSetEvent } from "../db-question-set-audit";
import {
  archiveQuestionSet,
  disableQuestionSet,
  enableQuestionSet,
  listQuestionSetsForAdmin,
  listSetAudit,
} from "../db-question-sets";
import { requireDb } from "../db";
import {
  getQuestionSetAccess,
  questionSetImageUrl,
} from "../question-set-access";
import { adminDoctorSetsProcedure, router } from "./trpc";

const id = z.string().uuid();

function notFound(): never {
  throw new TRPCError({ code: "NOT_FOUND", message: "غير موجود." });
}

export const adminDoctorsRouter = router({
  list: adminDoctorSetsProcedure
    .input(
      z
        .object({
          status: z
            .enum(["pending", "approved", "rejected", "suspended"])
            .optional(),
        })
        .optional()
    )
    .query(({ input }) => listDoctorsForAdmin(input?.status)),

  review: adminDoctorSetsProcedure
    .input(
      z.object({
        userId: id,
        action: z.enum(["approve", "reject", "suspend", "reinstate"]),
        reason: z.string().trim().max(500).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ok = await reviewDoctor(
        ctx.user.id,
        input.userId,
        input.action,
        input.reason
      );
      if (!ok) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "لا يمكن تطبيق هذا الإجراء على حالة الطلب الحالية.",
        });
      }
      return { success: true } as const;
    }),
});

export const adminQuestionSetsRouter = router({
  list: adminDoctorSetsProcedure.query(() => listQuestionSetsForAdmin()),

  // Inspecting a set's content is itself an audited event.
  preview: adminDoctorSetsProcedure
    .input(z.object({ setId: id }))
    .query(async ({ ctx, input }) => {
      const access = await getQuestionSetAccess(
        { id: ctx.user.id, role: "admin" },
        input.setId
      );
      if (!access) notFound();
      await recordQuestionSetEvent(requireDb(), {
        setId: input.setId,
        actorId: ctx.user.id,
        event: "admin_viewed",
      });
      return readQuestionFileContent(access.bookId, image =>
        questionSetImageUrl(input.setId, image.imageId)
      );
    }),

  disable: adminDoctorSetsProcedure
    .input(z.object({ setId: id }))
    .mutation(async ({ ctx, input }) => {
      if (
        !(await disableQuestionSet(
          { id: ctx.user.id, role: "admin" },
          input.setId
        ))
      )
        notFound();
      return { success: true } as const;
    }),

  enable: adminDoctorSetsProcedure
    .input(z.object({ setId: id }))
    .mutation(async ({ ctx, input }) => {
      if (
        !(await enableQuestionSet(
          { id: ctx.user.id, role: "admin" },
          input.setId
        ))
      )
        notFound();
      return { success: true } as const;
    }),

  archive: adminDoctorSetsProcedure
    .input(z.object({ setId: id }))
    .mutation(async ({ ctx, input }) => {
      if (
        !(await archiveQuestionSet(
          { id: ctx.user.id, role: "admin" },
          input.setId
        ))
      )
        notFound();
      return { success: true } as const;
    }),

  audit: adminDoctorSetsProcedure
    .input(z.object({ setId: id }))
    .query(({ input }) => listSetAudit(null, input.setId)),
});
