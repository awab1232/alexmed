// 💳 Admin subscription management (/admin/billing). Every procedure is
// adminProcedure (role checked server-side); every mutation goes through
// lib/billing/subscriptions.ts, which is transactional and audited with the
// acting admin's id.
import { z } from "zod";
import { FEATURES, type BillingSettings } from "../billing/catalog";
import {
  getBillingOverview,
  getBillingUserDetail,
  listPaymentRequests,
  searchBillingUsers,
} from "../billing/admin-queries";
import { toTrpcError } from "../billing/http";
import {
  getAllPlans,
  getBillingSettings,
  updateBillingSettings,
  updatePlan,
} from "../billing/plans";
import {
  adminActivatePlan,
  adminCancelSubscription,
  adminChangePlan,
  adminExpireSubscription,
  adminExtendSubscription,
  adminResetUsage,
  approvePaymentRequest,
  rejectPaymentRequest,
} from "../billing/subscriptions";
import { adminProcedure, router } from "./trpc";

const userInput = z.object({ userId: z.string().uuid() });
const reason = z.string().trim().max(300).optional();

async function run<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    return toTrpcError(error);
  }
}

const count = z.number().int().min(0).max(1_000_000);
const optionalCount = count.nullable();

export const adminBillingRouter = router({
  overview: adminProcedure.query(() => getBillingOverview()),

  users: adminProcedure
    .input(z.object({ search: z.string().max(200).optional() }))
    .query(({ input }) => searchBillingUsers({ search: input.search })),

  user: adminProcedure
    .input(userInput)
    .query(({ input }) => getBillingUserDetail(input.userId)),

  activate: adminProcedure
    .input(
      userInput.extend({
        planId: z.string().min(1).max(32),
        months: z.number().int().min(1).max(36),
        paymentMethod: z.string().trim().max(60).optional(),
        paymentReference: z.string().trim().max(120).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      run(() => adminActivatePlan({ ...input, adminId: ctx.user.id }))
    ),

  changePlan: adminProcedure
    .input(userInput.extend({ planId: z.string().min(1).max(32) }))
    .mutation(({ ctx, input }) =>
      run(() => adminChangePlan({ ...input, adminId: ctx.user.id }))
    ),

  extend: adminProcedure
    .input(
      userInput.extend({
        months: z.number().int().min(0).max(36).optional(),
        days: z.number().int().min(0).max(366).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      run(() => adminExtendSubscription({ ...input, adminId: ctx.user.id }))
    ),

  cancel: adminProcedure
    .input(userInput.extend({ reason }))
    .mutation(({ ctx, input }) =>
      run(() => adminCancelSubscription({ ...input, adminId: ctx.user.id }))
    ),

  expire: adminProcedure
    .input(userInput.extend({ reason }))
    .mutation(({ ctx, input }) =>
      run(() => adminExpireSubscription({ ...input, adminId: ctx.user.id }))
    ),

  resetUsage: adminProcedure
    .input(userInput.extend({ reason }))
    .mutation(({ ctx, input }) =>
      run(() => adminResetUsage({ ...input, adminId: ctx.user.id }))
    ),

  paymentRequests: adminProcedure
    .input(
      z.object({
        status: z
          .enum(["pending", "approved", "rejected", "cancelled"])
          .optional(),
      })
    )
    .query(({ input }) => listPaymentRequests({ status: input.status })),

  approve: adminProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        adminNote: z.string().trim().max(300).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      run(() => approvePaymentRequest({ ...input, adminId: ctx.user.id }))
    ),

  reject: adminProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        adminNote: z.string().trim().max(300).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      run(() => rejectPaymentRequest({ ...input, adminId: ctx.user.id }))
    ),

  // ── Plan catalogue & settings (no deploy needed to change a price) ──────
  plans: adminProcedure.query(() => getAllPlans()),

  updatePlan: adminProcedure
    .input(
      z.object({
        id: z.string().min(1).max(32),
        name: z.string().trim().min(1).max(40),
        tagline: z.string().trim().max(80),
        description: z.string().trim().max(300),
        priceMonthlyCents: count,
        priceYearlyCents: optionalCount,
        assistantDailyLimit: count,
        assistantTokenDailyLimit: optionalCount,
        questionsDailyLimit: count,
        questionsMonthlyLimit: optionalCount,
        booksDailyLimit: count,
        booksMonthlyLimit: optionalCount,
        maxFileSizeMb: z.number().int().min(1).max(2000),
        processingConcurrency: z.number().int().min(1).max(10),
        features: z.record(z.enum(FEATURES), z.boolean()),
        highlighted: z.boolean(),
        active: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...update } = input;
      return updatePlan(id, update);
    }),

  settings: adminProcedure.query(() => getBillingSettings()),

  updateSettings: adminProcedure
    .input(
      z.object({
        paymentInstructions: z.string().trim().min(1).max(2000),
        supportContact: z.object({
          label: z.string().trim().max(60),
          url: z
            .string()
            .trim()
            .max(300)
            .refine(
              value =>
                value === "" || /^(https?:\/\/|mailto:|tel:)/i.test(value),
              "رابط غير صالح (http/https/mailto/tel)."
            ),
        }),
        paymentMethods: z
          .array(z.string().trim().min(1).max(60))
          .min(1)
          .max(10),
        currencyRates: z.record(z.string().length(3), z.number().positive()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateBillingSettings(input as BillingSettings, ctx.user.id);
      return { ok: true };
    }),
});
