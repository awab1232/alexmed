// 💳 Student-facing billing: the public plan catalogue (pricing page), the
// signed-in student's plan + usage, and the manual upgrade request. The
// student's identity always comes from the session; prices, plan and usage
// always from the database — never from the request.
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getUserProfileForAccount } from "../db";
import { getPaymentProvider } from "../billing/payment-provider";
import { getBillingSettings, getPlan, getPublicPlans } from "../billing/plans";
import { toTrpcError } from "../billing/http";
import {
  cancelOwnPaymentRequest,
  listOwnPaymentRequests,
} from "../billing/subscriptions";
import { getUsageSummary } from "../billing/usage";
import { protectedProcedure, publicProcedure, router } from "./trpc";

export const billingRouter = router({
  // Public (the pricing page works signed out).
  plans: publicProcedure.query(async () => {
    const [plans, settings] = await Promise.all([
      getPublicPlans(),
      getBillingSettings(),
    ]);
    return {
      plans,
      currencyRates: settings.currencyRates,
      paymentMethods: settings.paymentMethods,
      paymentInstructions: settings.paymentInstructions,
      supportContact: settings.supportContact,
    };
  }),

  // Everything /account and /account/plan show, in one call.
  mine: protectedProcedure.query(async ({ ctx }) => {
    const [summary, requests, profile] = await Promise.all([
      getUsageSummary(ctx.user.id),
      listOwnPaymentRequests(ctx.user.id, 5),
      getUserProfileForAccount(ctx.user.id),
    ]);
    const subscription = summary.subscription
      ? {
          planId: summary.subscription.planId,
          status: summary.subscription.status,
          billingPeriod: summary.subscription.billingPeriod,
          startDate: summary.subscription.startDate,
          endDate: summary.subscription.endDate,
          paymentMethod: summary.subscription.paymentMethod,
          paymentReference: summary.subscription.paymentReference,
        }
      : null;
    return {
      ...summary,
      subscription,
      requests,
      pendingRequest: requests.find(r => r.status === "pending") ?? null,
      phone: profile?.phone ?? null,
    };
  }),

  requestUpgrade: protectedProcedure
    .input(
      z.object({
        planId: z.string().min(1).max(32),
        paymentMethod: z.string().trim().min(1).max(60),
        reference: z.string().trim().max(120).optional(),
        note: z.string().trim().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [plan, settings] = await Promise.all([
        getPlan(input.planId),
        getBillingSettings(),
      ]);
      if (!plan || !plan.active || plan.priceMonthlyCents <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "الباقة غير متاحة للترقية.",
        });
      }
      if (!settings.paymentMethods.includes(input.paymentMethod)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "اختر طريقة دفع من القائمة.",
        });
      }
      try {
        return await getPaymentProvider().createCheckout({
          userId: ctx.user.id,
          plan,
          paymentMethod: input.paymentMethod,
          reference: input.reference,
          note: input.note,
        });
      } catch (error) {
        toTrpcError(error);
      }
    }),

  cancelRequest: protectedProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => ({
      cancelled: await cancelOwnPaymentRequest(ctx.user.id, input.requestId),
    })),
});
