// 💳 Every change to a student's entitlement goes through here — admin
// actions and payment-request approval — each in ONE transaction that locks
// the student's user row (so two admins / double clicks serialize), keeps
// history (old subscriptions are ended, never deleted), and writes an audit
// entry: who, what, when, before, after.
import { and, desc, eq, sql } from "drizzle-orm";
import {
  notifications,
  paymentRequests,
  subscriptionAuditLogs,
  subscriptions,
} from "../../drizzle/schema";
import { requireDb } from "../db";
import { isUniqueViolation } from "../db-errors";
import { DEFAULT_PLAN_ID, formatPrice } from "./catalog";
import { getPlan } from "./plans";
import { BillingError, resetUsage } from "./usage";

type Tx = Parameters<
  Parameters<ReturnType<typeof requireDb>["transaction"]>[0]
>[0];

export type AuditAction =
  | "ADMIN_ACTIVATED_PLAN"
  | "ADMIN_CHANGED_PLAN"
  | "ADMIN_EXTENDED_SUBSCRIPTION"
  | "ADMIN_CANCELLED_SUBSCRIPTION"
  | "ADMIN_EXPIRED_SUBSCRIPTION"
  | "ADMIN_RESET_USAGE"
  | "PAYMENT_REQUEST_APPROVED"
  | "PAYMENT_REQUEST_REJECTED"
  | "SUBSCRIPTION_EXPIRED";

export class SubscriptionError extends Error {
  constructor(
    public readonly reason:
      | "PLAN_NOT_FOUND"
      | "NO_ACTIVE_SUBSCRIPTION"
      | "REQUEST_NOT_PENDING"
      | "INVALID_DURATION",
    message: string
  ) {
    super(message);
    this.name = "SubscriptionError";
  }
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCMonth(result.getUTCMonth() + months);
  // 31 Jan + 1 month → last day of Feb, not 3 Mar.
  if (result.getUTCDate() < day) result.setUTCDate(0);
  return result;
}

async function lockUser(tx: Tx, userId: string) {
  await tx.execute(
    sql`SELECT 1 FROM "users" WHERE "id" = ${userId} FOR UPDATE`
  );
}

async function currentActive(tx: Tx, userId: string) {
  const [row] = await tx
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))
    )
    .limit(1);
  // An active row already past its end is expired for every purpose.
  if (row?.endDate && row.endDate <= new Date()) {
    await tx
      .update(subscriptions)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(subscriptions.id, row.id));
    return null;
  }
  return row ?? null;
}

async function audit(
  tx: Tx,
  entry: {
    userId: string;
    adminId: string | null;
    action: AuditAction;
    subscriptionId?: string | null;
    previousPlan?: string | null;
    newPlan?: string | null;
    previousStatus?: string | null;
    newStatus?: string | null;
    previousEndDate?: Date | null;
    newEndDate?: Date | null;
    metadata?: Record<string, unknown>;
  }
) {
  await tx.insert(subscriptionAuditLogs).values({
    userId: entry.userId,
    adminId: entry.adminId,
    action: entry.action,
    subscriptionId: entry.subscriptionId ?? null,
    previousPlan: entry.previousPlan ?? null,
    newPlan: entry.newPlan ?? null,
    previousStatus: entry.previousStatus ?? null,
    newStatus: entry.newStatus ?? null,
    previousEndDate: entry.previousEndDate ?? null,
    newEndDate: entry.newEndDate ?? null,
    metadata: entry.metadata ?? null,
  });
}

// Shown in the student's notifications (app/shared, generic `text`).
async function notify(
  tx: Tx,
  userId: string,
  adminId: string | null,
  text: string
) {
  await tx.insert(notifications).values({
    userId,
    type: "billing",
    actorId: adminId,
    data: { text },
  });
}

const dateAr = (date: Date) =>
  date.toLocaleDateString("ar-EG-u-nu-latn", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

// Starts a paid plan now (ending whatever was active — history kept).
async function startSubscription(
  tx: Tx,
  input: {
    userId: string;
    planId: string;
    endDate: Date | null;
    adminId: string | null;
    paymentMethod?: string | null;
    paymentReference?: string | null;
    paymentRequestId?: string | null;
    billingPeriod?: "monthly" | "yearly";
  }
) {
  const previous = await currentActive(tx, input.userId);
  if (previous) {
    await tx
      .update(subscriptions)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, previous.id));
  }
  const [created] = await tx
    .insert(subscriptions)
    .values({
      userId: input.userId,
      planId: input.planId,
      status: "active",
      billingPeriod: input.billingPeriod ?? "monthly",
      startDate: new Date(),
      endDate: input.endDate,
      paymentMethod: input.paymentMethod ?? null,
      paymentReference: input.paymentReference ?? null,
      paymentRequestId: input.paymentRequestId ?? null,
      activatedBy: input.adminId,
    })
    .returning();
  return { previous, created };
}

async function requirePlan(planId: string) {
  const plan = await getPlan(planId);
  if (!plan) {
    throw new SubscriptionError("PLAN_NOT_FOUND", "الباقة غير موجودة.");
  }
  return plan;
}

// ── Admin actions ────────────────────────────────────────────────────────
export async function adminActivatePlan(input: {
  userId: string;
  planId: string;
  months: number;
  adminId: string;
  paymentMethod?: string | null;
  paymentReference?: string | null;
}) {
  if (
    !Number.isInteger(input.months) ||
    input.months < 1 ||
    input.months > 36
  ) {
    throw new SubscriptionError("INVALID_DURATION", "مدة غير صالحة.");
  }
  const plan = await requirePlan(input.planId);
  if (plan.id === DEFAULT_PLAN_ID) return adminCancelSubscription(input);
  return requireDb().transaction(async tx => {
    await lockUser(tx, input.userId);
    const endDate = addMonths(new Date(), input.months);
    const { previous, created } = await startSubscription(tx, {
      userId: input.userId,
      planId: plan.id,
      endDate,
      adminId: input.adminId,
      paymentMethod: input.paymentMethod ?? "manual",
      paymentReference: input.paymentReference,
    });
    await audit(tx, {
      userId: input.userId,
      adminId: input.adminId,
      action: previous ? "ADMIN_CHANGED_PLAN" : "ADMIN_ACTIVATED_PLAN",
      subscriptionId: created.id,
      previousPlan: previous?.planId ?? DEFAULT_PLAN_ID,
      newPlan: plan.id,
      previousStatus: previous?.status ?? null,
      newStatus: "active",
      previousEndDate: previous?.endDate ?? null,
      newEndDate: endDate,
      metadata: { months: input.months },
    });
    await notify(
      tx,
      input.userId,
      input.adminId,
      `تم تفعيل باقة ${plan.name} لحسابك حتى ${dateAr(endDate)} 🎉`
    );
    return created;
  });
}

// Switch plan, keeping the current period's end date (or one month when
// there was no paid period). Switching to Free ends the paid plan.
export async function adminChangePlan(input: {
  userId: string;
  planId: string;
  adminId: string;
}) {
  const plan = await requirePlan(input.planId);
  if (plan.id === DEFAULT_PLAN_ID) return adminCancelSubscription(input);
  return requireDb().transaction(async tx => {
    await lockUser(tx, input.userId);
    const current = await currentActive(tx, input.userId);
    const endDate = current?.endDate ?? addMonths(new Date(), 1);
    const { previous, created } = await startSubscription(tx, {
      userId: input.userId,
      planId: plan.id,
      endDate,
      adminId: input.adminId,
      paymentMethod: current?.paymentMethod ?? "manual",
      paymentReference: current?.paymentReference,
    });
    await audit(tx, {
      userId: input.userId,
      adminId: input.adminId,
      action: "ADMIN_CHANGED_PLAN",
      subscriptionId: created.id,
      previousPlan: previous?.planId ?? DEFAULT_PLAN_ID,
      newPlan: plan.id,
      previousStatus: previous?.status ?? null,
      newStatus: "active",
      previousEndDate: previous?.endDate ?? null,
      newEndDate: endDate,
    });
    return created;
  });
}

export async function adminExtendSubscription(input: {
  userId: string;
  months?: number;
  days?: number;
  adminId: string;
}) {
  const months = input.months ?? 0;
  const days = input.days ?? 0;
  if (
    months < 0 ||
    days < 0 ||
    months + days === 0 ||
    months > 36 ||
    days > 366
  ) {
    throw new SubscriptionError("INVALID_DURATION", "مدة غير صالحة.");
  }
  return requireDb().transaction(async tx => {
    await lockUser(tx, input.userId);
    const current = await currentActive(tx, input.userId);
    if (!current) {
      throw new SubscriptionError(
        "NO_ACTIVE_SUBSCRIPTION",
        "لا يوجد اشتراك فعّال لتمديده."
      );
    }
    const from =
      current.endDate && current.endDate > new Date()
        ? current.endDate
        : new Date();
    const endDate = new Date(
      addMonths(from, months).getTime() + days * 86_400_000
    );
    await tx
      .update(subscriptions)
      .set({ endDate, updatedAt: new Date() })
      .where(eq(subscriptions.id, current.id));
    await audit(tx, {
      userId: input.userId,
      adminId: input.adminId,
      action: "ADMIN_EXTENDED_SUBSCRIPTION",
      subscriptionId: current.id,
      previousPlan: current.planId,
      newPlan: current.planId,
      previousStatus: "active",
      newStatus: "active",
      previousEndDate: current.endDate,
      newEndDate: endDate,
      metadata: { months, days },
    });
    await notify(
      tx,
      input.userId,
      input.adminId,
      `تم تمديد اشتراكك حتى ${dateAr(endDate)}.`
    );
    return { ...current, endDate };
  });
}

async function endActive(
  input: { userId: string; adminId: string; reason?: string },
  status: "cancelled" | "expired"
) {
  return requireDb().transaction(async tx => {
    await lockUser(tx, input.userId);
    const current = await currentActive(tx, input.userId);
    if (!current) {
      throw new SubscriptionError(
        "NO_ACTIVE_SUBSCRIPTION",
        "لا يوجد اشتراك فعّال."
      );
    }
    const now = new Date();
    await tx
      .update(subscriptions)
      .set(
        status === "cancelled"
          ? { status, cancelledAt: now, updatedAt: now }
          : { status, endDate: now, updatedAt: now }
      )
      .where(eq(subscriptions.id, current.id));
    await audit(tx, {
      userId: input.userId,
      adminId: input.adminId,
      action:
        status === "cancelled"
          ? "ADMIN_CANCELLED_SUBSCRIPTION"
          : "ADMIN_EXPIRED_SUBSCRIPTION",
      subscriptionId: current.id,
      previousPlan: current.planId,
      newPlan: DEFAULT_PLAN_ID,
      previousStatus: "active",
      newStatus: status,
      previousEndDate: current.endDate,
      newEndDate: status === "expired" ? now : current.endDate,
      metadata: input.reason ? { reason: input.reason } : undefined,
    });
    return { ...current, status };
  });
}

export function adminCancelSubscription(input: {
  userId: string;
  adminId: string;
  reason?: string;
}) {
  return endActive(input, "cancelled");
}

export function adminExpireSubscription(input: {
  userId: string;
  adminId: string;
  reason?: string;
}) {
  return endActive(input, "expired");
}

export async function adminResetUsage(input: {
  userId: string;
  adminId: string;
  reason?: string;
}) {
  const periods = await resetUsage(input.userId);
  await requireDb().transaction(tx =>
    audit(tx, {
      userId: input.userId,
      adminId: input.adminId,
      action: "ADMIN_RESET_USAGE",
      metadata: { ...periods, reason: input.reason ?? null },
    })
  );
  return periods;
}

// ── Payment requests (manual payment flow) ───────────────────────────────
export async function createPaymentRequest(input: {
  userId: string;
  planId: string;
  paymentMethod: string;
  reference?: string | null;
  note?: string | null;
}) {
  const plan = await getPlan(input.planId);
  if (!plan || !plan.active || plan.priceMonthlyCents <= 0) {
    throw new SubscriptionError("PLAN_NOT_FOUND", "الباقة غير متاحة للترقية.");
  }
  try {
    const [row] = await requireDb()
      .insert(paymentRequests)
      .values({
        userId: input.userId,
        planId: plan.id,
        billingPeriod: "monthly",
        durationMonths: 1,
        // Server price, never a client value.
        amountCents: plan.priceMonthlyCents,
        currency: plan.currency,
        paymentMethod: input.paymentMethod,
        reference: input.reference || null,
        note: input.note || null,
      })
      .returning();
    return row;
  } catch (error) {
    if (isUniqueViolation(error, "payment_requests_one_pending_per_user")) {
      throw new BillingError(
        {
          code: "PAYMENT_REQUEST_PENDING",
          planId: plan.id,
          planName: plan.name,
        },
        "لديك طلب ترقية قيد المراجعة بالفعل. سنراجعه قريبًا."
      );
    }
    throw error;
  }
}

export async function cancelOwnPaymentRequest(
  userId: string,
  requestId: string
) {
  const [row] = await requireDb()
    .update(paymentRequests)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(paymentRequests.id, requestId),
        eq(paymentRequests.userId, userId),
        eq(paymentRequests.status, "pending")
      )
    )
    .returning({ id: paymentRequests.id });
  return !!row;
}

export async function listOwnPaymentRequests(userId: string, limit = 10) {
  return requireDb()
    .select({
      id: paymentRequests.id,
      planId: paymentRequests.planId,
      amountCents: paymentRequests.amountCents,
      currency: paymentRequests.currency,
      paymentMethod: paymentRequests.paymentMethod,
      reference: paymentRequests.reference,
      status: paymentRequests.status,
      adminNote: paymentRequests.adminNote,
      createdAt: paymentRequests.createdAt,
      reviewedAt: paymentRequests.reviewedAt,
    })
    .from(paymentRequests)
    .where(eq(paymentRequests.userId, userId))
    .orderBy(desc(paymentRequests.createdAt))
    .limit(limit);
}

async function lockPendingRequest(tx: Tx, requestId: string) {
  await tx.execute(
    sql`SELECT 1 FROM "payment_requests" WHERE "id" = ${requestId} FOR UPDATE`
  );
  const [row] = await tx
    .select()
    .from(paymentRequests)
    .where(eq(paymentRequests.id, requestId))
    .limit(1);
  if (!row || row.status !== "pending") {
    throw new SubscriptionError(
      "REQUEST_NOT_PENDING",
      "هذا الطلب لم يعد قيد المراجعة."
    );
  }
  return row;
}

// Approve: start (or, for the same plan, extend) the subscription for the
// paid duration, mark the request approved, audit, notify — all or nothing.
export async function approvePaymentRequest(input: {
  requestId: string;
  adminId: string;
  adminNote?: string | null;
}) {
  return requireDb().transaction(async tx => {
    const request = await lockPendingRequest(tx, input.requestId);
    await lockUser(tx, request.userId);
    const plan = await requirePlan(request.planId);

    const current = await currentActive(tx, request.userId);
    let subscriptionId: string;
    let endDate: Date;
    if (current && current.planId === plan.id) {
      // Renewal of the same plan: add the paid months to the current end.
      const from =
        current.endDate && current.endDate > new Date()
          ? current.endDate
          : new Date();
      endDate = addMonths(from, request.durationMonths);
      await tx
        .update(subscriptions)
        .set({
          endDate,
          paymentMethod: request.paymentMethod,
          paymentReference: request.reference,
          paymentRequestId: request.id,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, current.id));
      subscriptionId = current.id;
    } else {
      endDate = addMonths(new Date(), request.durationMonths);
      const { created } = await startSubscription(tx, {
        userId: request.userId,
        planId: plan.id,
        endDate,
        adminId: input.adminId,
        paymentMethod: request.paymentMethod,
        paymentReference: request.reference,
        paymentRequestId: request.id,
        billingPeriod: request.billingPeriod,
      });
      subscriptionId = created.id;
    }

    await tx
      .update(paymentRequests)
      .set({
        status: "approved",
        reviewedBy: input.adminId,
        reviewedAt: new Date(),
        adminNote: input.adminNote || null,
        subscriptionId,
        updatedAt: new Date(),
      })
      .where(eq(paymentRequests.id, request.id));
    await audit(tx, {
      userId: request.userId,
      adminId: input.adminId,
      action: "PAYMENT_REQUEST_APPROVED",
      subscriptionId,
      previousPlan: current?.planId ?? DEFAULT_PLAN_ID,
      newPlan: plan.id,
      previousStatus: current?.status ?? null,
      newStatus: "active",
      previousEndDate: current?.endDate ?? null,
      newEndDate: endDate,
      metadata: {
        paymentRequestId: request.id,
        amount: formatPrice(request.amountCents, request.currency),
        paymentMethod: request.paymentMethod,
      },
    });
    await notify(
      tx,
      request.userId,
      input.adminId,
      `تم تفعيل باقة ${plan.name} لحسابك حتى ${dateAr(endDate)} 🎉`
    );
    return { subscriptionId, endDate };
  });
}

export async function rejectPaymentRequest(input: {
  requestId: string;
  adminId: string;
  adminNote?: string | null;
}) {
  return requireDb().transaction(async tx => {
    const request = await lockPendingRequest(tx, input.requestId);
    await tx
      .update(paymentRequests)
      .set({
        status: "rejected",
        reviewedBy: input.adminId,
        reviewedAt: new Date(),
        adminNote: input.adminNote || null,
        updatedAt: new Date(),
      })
      .where(eq(paymentRequests.id, request.id));
    await audit(tx, {
      userId: request.userId,
      adminId: input.adminId,
      action: "PAYMENT_REQUEST_REJECTED",
      newPlan: request.planId,
      metadata: {
        paymentRequestId: request.id,
        note: input.adminNote ?? null,
      },
    });
    await notify(
      tx,
      request.userId,
      input.adminId,
      input.adminNote
        ? `لم نتمكن من تأكيد طلب الترقية: ${input.adminNote}`
        : "لم نتمكن من تأكيد طلب الترقية. تواصل معنا إذا احتجت مساعدة."
    );
    return request;
  });
}
