// 💳 Read models for /admin/billing: searching students with their current
// plan, subscription and usage (one joined query, no N+1), one student's
// full billing picture, the payment-request queue and plan counts.
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  paymentRequests,
  subscriptionAuditLogs,
  subscriptions,
  usageDaily,
  usageMonthly,
  users,
} from "../../drizzle/schema";
import { requireDb } from "../db";
import { periodKeys } from "./periods";
import { getUsageSummary } from "./usage";

export async function searchBillingUsers(input: {
  search?: string;
  limit?: number;
}) {
  const db = requireDb();
  const { day, month } = periodKeys();
  const search = input.search?.trim();
  const where = search
    ? or(
        ilike(users.email, `%${search}%`),
        ilike(users.name, `%${search}%`),
        ilike(users.phone, `%${search.replace(/[\s-]/g, "")}%`),
        ilike(users.username, `%${search.toLowerCase()}%`)
      )
    : undefined;
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      username: users.username,
      role: users.role,
      planId: subscriptions.planId,
      status: subscriptions.status,
      startDate: subscriptions.startDate,
      endDate: subscriptions.endDate,
      assistantToday: usageDaily.assistantMessages,
      booksToday: usageDaily.bookFiles,
      questionsToday: usageDaily.questionFiles,
      booksMonth: usageMonthly.bookFiles,
      questionsMonth: usageMonthly.questionFiles,
    })
    .from(users)
    .leftJoin(
      subscriptions,
      and(
        eq(subscriptions.userId, users.id),
        eq(subscriptions.status, "active")
      )
    )
    .leftJoin(
      usageDaily,
      and(eq(usageDaily.userId, users.id), eq(usageDaily.day, day))
    )
    .leftJoin(
      usageMonthly,
      and(eq(usageMonthly.userId, users.id), eq(usageMonthly.month, month))
    )
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(Math.min(input.limit ?? 30, 100));
}

export async function getBillingUserDetail(userId: string) {
  const db = requireDb();
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;
  const [summary, history, audit, requests] = await Promise.all([
    getUsageSummary(userId),
    db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(20),
    db
      .select({
        id: subscriptionAuditLogs.id,
        action: subscriptionAuditLogs.action,
        previousPlan: subscriptionAuditLogs.previousPlan,
        newPlan: subscriptionAuditLogs.newPlan,
        previousEndDate: subscriptionAuditLogs.previousEndDate,
        newEndDate: subscriptionAuditLogs.newEndDate,
        metadata: subscriptionAuditLogs.metadata,
        createdAt: subscriptionAuditLogs.createdAt,
        adminName: users.name,
        adminEmail: users.email,
      })
      .from(subscriptionAuditLogs)
      .leftJoin(users, eq(users.id, subscriptionAuditLogs.adminId))
      .where(eq(subscriptionAuditLogs.userId, userId))
      .orderBy(desc(subscriptionAuditLogs.createdAt))
      .limit(30),
    db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.userId, userId))
      .orderBy(desc(paymentRequests.createdAt))
      .limit(20),
  ]);
  return { user, summary, history, audit, requests };
}

export async function listPaymentRequests(input: {
  status?: "pending" | "approved" | "rejected" | "cancelled";
  limit?: number;
}) {
  return requireDb()
    .select({
      id: paymentRequests.id,
      userId: paymentRequests.userId,
      userName: users.name,
      userEmail: users.email,
      userPhone: users.phone,
      username: users.username,
      planId: paymentRequests.planId,
      durationMonths: paymentRequests.durationMonths,
      amountCents: paymentRequests.amountCents,
      currency: paymentRequests.currency,
      paymentMethod: paymentRequests.paymentMethod,
      reference: paymentRequests.reference,
      proofUrl: paymentRequests.proofUrl,
      note: paymentRequests.note,
      status: paymentRequests.status,
      adminNote: paymentRequests.adminNote,
      reviewedAt: paymentRequests.reviewedAt,
      createdAt: paymentRequests.createdAt,
    })
    .from(paymentRequests)
    .innerJoin(users, eq(users.id, paymentRequests.userId))
    .where(input.status ? eq(paymentRequests.status, input.status) : undefined)
    .orderBy(desc(paymentRequests.createdAt))
    .limit(Math.min(input.limit ?? 50, 200));
}

export async function getBillingOverview() {
  const db = requireDb();
  const [byPlan, [pending]] = await Promise.all([
    db
      .select({ planId: subscriptions.planId, n: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, "active"),
          or(
            sql`${subscriptions.endDate} is null`,
            sql`${subscriptions.endDate} > now()`
          )
        )
      )
      .groupBy(subscriptions.planId),
    db
      .select({ n: count() })
      .from(paymentRequests)
      .where(eq(paymentRequests.status, "pending")),
  ]);
  return {
    activeByPlan: Object.fromEntries(
      byPlan.map(row => [row.planId, Number(row.n)])
    ) as Record<string, number>,
    pendingRequests: Number(pending?.n ?? 0),
  };
}
