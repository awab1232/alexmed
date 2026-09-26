// Real-Postgres tests of the billing engine: plan resolution, daily and
// monthly limits (0 → 1, limit-1 → ok, limit → refused), concurrency (many
// simultaneous requests can't pass the limit), file size, subscription
// lifecycle (activate / change / extend / cancel / expire, automatic expiry
// → Free) with audit rows, and the manual payment-request flow.
// Skipped unless LIVE_DB=1. Uses throwaway billing-qa+… users and deletes
// them (cascade) at the end.
//
//   LIVE_DB=1 npx vitest run lib/billing/billing.integration.test.ts
import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const live = process.env.LIVE_DB === "1";
if (live) loadEnv();

describe.skipIf(!live)(
  "billing engine — real database",
  { timeout: 120_000 },
  () => {
    const stamp = Date.now();
    const ids: Record<"student" | "admin" | "other", string> = {
      student: "",
      admin: "",
      other: "",
    };
    let db: ReturnType<typeof import("../db").requireDb>;
    let schema: typeof import("../../drizzle/schema");
    let orm: typeof import("drizzle-orm");
    let usage: typeof import("./usage");
    let subs: typeof import("./subscriptions");
    let entitlement: typeof import("./entitlement");
    let plans: typeof import("./plans");

    beforeAll(async () => {
      db = (await import("../db")).requireDb();
      schema = await import("../../drizzle/schema");
      orm = await import("drizzle-orm");
      usage = await import("./usage");
      subs = await import("./subscriptions");
      entitlement = await import("./entitlement");
      plans = await import("./plans");
      for (const key of Object.keys(ids) as (keyof typeof ids)[]) {
        const [row] = await db
          .insert(schema.users)
          .values({
            email: `billing-qa+${stamp}-${key}@example.invalid`,
            name: `Billing QA ${key}`,
            role: key === "admin" ? "admin" : "user",
          })
          .returning({ id: schema.users.id });
        ids[key] = row.id;
      }
    });

    afterAll(async () => {
      for (const id of Object.values(ids)) {
        if (id) {
          await db.delete(schema.users).where(orm.eq(schema.users.id, id));
        }
      }
    });

    const auditActions = async (userId: string) =>
      (
        await db
          .select({ action: schema.subscriptionAuditLogs.action })
          .from(schema.subscriptionAuditLogs)
          .where(orm.eq(schema.subscriptionAuditLogs.userId, userId))
      ).map(row => row.action);

    it("everyone without a subscription is on Free", async () => {
      const { plan, subscription } = await entitlement.resolveEntitlement(
        ids.student
      );
      expect(plan.id).toBe("free");
      expect(subscription).toBeNull();
    });

    it("daily limit: 0→1 … limit-1 ok, limit and limit+1 refused", async () => {
      const free = await plans.getFreePlan();
      const limit = free.booksDailyLimit;
      for (let i = 1; i <= limit; i++) {
        const receipt = await usage.consumeUsage(ids.student, "BOOK_FILE");
        expect(receipt.dailyUsed).toBe(i);
      }
      for (let i = 0; i < 2; i++) {
        await expect(
          usage.consumeUsage(ids.student, "BOOK_FILE")
        ).rejects.toMatchObject({
          details: { code: "PLAN_LIMIT_REACHED", upgradePlanId: "pro" },
        });
      }
      const summary = await usage.getUsageSummary(ids.student);
      expect(summary.books.daily).toEqual({
        used: limit,
        limit,
        remaining: 0,
      });
      expect(summary.books.monthly.used).toBe(limit);
    });

    it("release gives a unit back (failed processing costs nothing)", async () => {
      const receipt = await usage.consumeUsage(ids.other, "QUESTION_FILE");
      await usage.releaseUsage(receipt);
      const summary = await usage.getUsageSummary(ids.other);
      expect(summary.questions.daily.used).toBe(0);
      expect(summary.questions.monthly.used).toBe(0);
    });

    it("concurrent requests can't pass the daily limit", async () => {
      const free = await plans.getFreePlan();
      const limit = free.assistantDailyLimit;
      const results = await Promise.allSettled(
        Array.from({ length: limit + 15 }, () =>
          usage.consumeUsage(ids.other, "ASSISTANT_MESSAGE")
        )
      );
      const ok = results.filter(r => r.status === "fulfilled").length;
      expect(ok).toBe(limit);
      const summary = await usage.getUsageSummary(ids.other);
      expect(summary.assistant.used).toBe(limit);
    });

    it("monthly limit refuses even when today is free, without charging today", async () => {
      const free = await plans.getFreePlan();
      const { month } = (await import("./periods")).periodKeys();
      await db
        .insert(schema.usageMonthly)
        .values({
          userId: ids.admin,
          month,
          questionFiles: free.questionsMonthlyLimit!,
        })
        .onConflictDoUpdate({
          target: [schema.usageMonthly.userId, schema.usageMonthly.month],
          set: { questionFiles: free.questionsMonthlyLimit! },
        });
      await expect(
        usage.consumeUsage(ids.admin, "QUESTION_FILE")
      ).rejects.toMatchObject({ details: { code: "MONTHLY_LIMIT_REACHED" } });
      const summary = await usage.getUsageSummary(ids.admin);
      // The daily +1 was rolled back with the monthly refusal.
      expect(summary.questions.daily.used).toBe(0);
    });

    it("file size: below / exactly / above the plan maximum", async () => {
      const free = await plans.getFreePlan();
      const max = free.maxFileSizeMb * 1024 * 1024;
      await expect(
        usage.assertFileSizeAllowed(ids.student, max - 1)
      ).resolves.toMatchObject({ id: "free" });
      await expect(
        usage.assertFileSizeAllowed(ids.student, max)
      ).resolves.toMatchObject({ id: "free" });
      await expect(
        usage.assertFileSizeAllowed(ids.student, max + 1)
      ).rejects.toMatchObject({
        details: {
          code: "FILE_SIZE_LIMIT",
          maxFileSizeMb: free.maxFileSizeMb,
          upgradePlanId: "pro",
        },
      });
    });

    it("subscription lifecycle with audit trail", async () => {
      // Activate Pro → Pro's limits apply immediately.
      await subs.adminActivatePlan({
        userId: ids.student,
        planId: "pro",
        months: 1,
        adminId: ids.admin,
      });
      let ent = await entitlement.resolveEntitlement(ids.student);
      expect(ent.plan.id).toBe("pro");
      const receipt = await usage.consumeUsage(ids.student, "BOOK_FILE");
      expect(receipt.dailyLimit).toBe(ent.plan.booksDailyLimit);

      // Extend by 10 days from the current end.
      const before = ent.subscription!.endDate!;
      const extended = await subs.adminExtendSubscription({
        userId: ids.student,
        days: 10,
        adminId: ids.admin,
      });
      expect(extended.endDate!.getTime() - before.getTime()).toBe(
        10 * 86_400_000
      );

      // Upgrade keeps the end date; so does the downgrade back.
      await subs.adminChangePlan({
        userId: ids.student,
        planId: "ultimate",
        adminId: ids.admin,
      });
      ent = await entitlement.resolveEntitlement(ids.student);
      expect(ent.plan.id).toBe("ultimate");
      expect(ent.subscription!.endDate!.getTime()).toBe(
        extended.endDate!.getTime()
      );
      await subs.adminChangePlan({
        userId: ids.student,
        planId: "pro",
        adminId: ids.admin,
      });
      expect((await entitlement.resolveEntitlement(ids.student)).plan.id).toBe(
        "pro"
      );

      // Only ever ONE active row; history is kept.
      const rows = await db
        .select({ status: schema.subscriptions.status })
        .from(schema.subscriptions)
        .where(orm.eq(schema.subscriptions.userId, ids.student));
      expect(rows.filter(r => r.status === "active")).toHaveLength(1);
      expect(rows.length).toBe(3);

      // Cancel → Free.
      await subs.adminCancelSubscription({
        userId: ids.student,
        adminId: ids.admin,
      });
      expect((await entitlement.resolveEntitlement(ids.student)).plan.id).toBe(
        "free"
      );

      // Automatic expiry at read time → Free, audited, record kept.
      await subs.adminActivatePlan({
        userId: ids.student,
        planId: "pro",
        months: 1,
        adminId: ids.admin,
      });
      await db
        .update(schema.subscriptions)
        .set({ endDate: new Date(Date.now() - 1000) })
        .where(
          orm.and(
            orm.eq(schema.subscriptions.userId, ids.student),
            orm.eq(schema.subscriptions.status, "active")
          )
        );
      ent = await entitlement.resolveEntitlement(ids.student);
      expect(ent.plan.id).toBe("free");
      const statuses = (
        await db
          .select({ status: schema.subscriptions.status })
          .from(schema.subscriptions)
          .where(orm.eq(schema.subscriptions.userId, ids.student))
      ).map(r => r.status);
      expect(statuses).toContain("expired");

      // Admin "expire now".
      await subs.adminActivatePlan({
        userId: ids.student,
        planId: "pro",
        months: 1,
        adminId: ids.admin,
      });
      await subs.adminExpireSubscription({
        userId: ids.student,
        adminId: ids.admin,
      });
      expect((await entitlement.resolveEntitlement(ids.student)).plan.id).toBe(
        "free"
      );

      const actions = await auditActions(ids.student);
      for (const action of [
        "ADMIN_ACTIVATED_PLAN",
        "ADMIN_EXTENDED_SUBSCRIPTION",
        "ADMIN_CHANGED_PLAN",
        "ADMIN_CANCELLED_SUBSCRIPTION",
        "SUBSCRIPTION_EXPIRED",
        "ADMIN_EXPIRED_SUBSCRIPTION",
      ]) {
        expect(actions, action).toContain(action);
      }
    });

    it("manual payment requests: one pending, server price, approve and reject", async () => {
      const pro = (await plans.getPlan("pro"))!;
      const request = await subs.createPaymentRequest({
        userId: ids.other,
        planId: "pro",
        paymentMethod: "تحويل بنكي",
        reference: "TX-123",
      });
      expect(request.amountCents).toBe(pro.priceMonthlyCents);
      expect(request.currency).toBe(pro.currency);
      await expect(
        subs.createPaymentRequest({
          userId: ids.other,
          planId: "ultimate",
          paymentMethod: "x",
        })
      ).rejects.toMatchObject({ details: { code: "PAYMENT_REQUEST_PENDING" } });
      // Free can't be "bought".
      await expect(
        subs.createPaymentRequest({
          userId: ids.admin,
          planId: "free",
          paymentMethod: "x",
        })
      ).rejects.toMatchObject({ reason: "PLAN_NOT_FOUND" });

      // Two admins approving at once: exactly one wins.
      const approvals = await Promise.allSettled([
        subs.approvePaymentRequest({
          requestId: request.id,
          adminId: ids.admin,
        }),
        subs.approvePaymentRequest({
          requestId: request.id,
          adminId: ids.admin,
        }),
      ]);
      expect(approvals.filter(a => a.status === "fulfilled")).toHaveLength(1);
      const ent = await entitlement.resolveEntitlement(ids.other);
      expect(ent.plan.id).toBe("pro");
      expect(ent.subscription?.paymentReference).toBe("TX-123");

      // Renewing the same plan extends from the current end date.
      const endBefore = ent.subscription!.endDate!;
      const renewal = await subs.createPaymentRequest({
        userId: ids.other,
        planId: "pro",
        paymentMethod: "تحويل بنكي",
      });
      const { endDate } = await subs.approvePaymentRequest({
        requestId: renewal.id,
        adminId: ids.admin,
      });
      expect(endDate.getTime()).toBeGreaterThan(endBefore.getTime());

      // Reject path.
      const rejected = await subs.createPaymentRequest({
        userId: ids.other,
        planId: "ultimate",
        paymentMethod: "محفظة إلكترونية",
      });
      await subs.rejectPaymentRequest({
        requestId: rejected.id,
        adminId: ids.admin,
        adminNote: "لم يصل التحويل",
      });
      await expect(
        subs.approvePaymentRequest({
          requestId: rejected.id,
          adminId: ids.admin,
        })
      ).rejects.toMatchObject({ reason: "REQUEST_NOT_PENDING" });
      const actions = await auditActions(ids.other);
      expect(actions).toContain("PAYMENT_REQUEST_APPROVED");
      expect(actions).toContain("PAYMENT_REQUEST_REJECTED");

      const notes = await db
        .select({ type: schema.notifications.type })
        .from(schema.notifications)
        .where(orm.eq(schema.notifications.userId, ids.other));
      expect(notes.some(n => n.type === "billing")).toBe(true);
    });
  }
);
