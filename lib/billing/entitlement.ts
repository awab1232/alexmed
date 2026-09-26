// 💳 What a student is entitled to right now — the ONE place that answers
// "which plan applies". Effective plan = the plan of their active,
// unexpired subscription, else Free. A subscription past its endDate is
// marked expired here, at read time (with an audit entry), so expiry never
// depends on a cron job having run.
import { and, eq } from "drizzle-orm";
import { subscriptionAuditLogs, subscriptions } from "../../drizzle/schema";
import { requireDb } from "../db";
import { planHasFeature, type Feature, type PlanConfig } from "./catalog";
import { getFreePlan, getPlan } from "./plans";

export type SubscriptionRow = typeof subscriptions.$inferSelect;

export type Entitlement = {
  plan: PlanConfig;
  subscription: SubscriptionRow | null;
};

export async function resolveEntitlement(
  userId: string,
  now = new Date()
): Promise<Entitlement> {
  const db = requireDb();
  const [active] = await db
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))
    )
    .limit(1);

  if (active?.endDate && active.endDate <= now) {
    // Conditional update: only the first concurrent reader expires it and
    // writes the audit entry.
    const [expired] = await db
      .update(subscriptions)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(eq(subscriptions.id, active.id), eq(subscriptions.status, "active"))
      )
      .returning({ id: subscriptions.id });
    if (expired) {
      await db.insert(subscriptionAuditLogs).values({
        userId,
        subscriptionId: active.id,
        action: "SUBSCRIPTION_EXPIRED",
        previousPlan: active.planId,
        newPlan: "free",
        previousStatus: "active",
        newStatus: "expired",
        previousEndDate: active.endDate,
        newEndDate: active.endDate,
        metadata: { automatic: true },
      });
    }
    return { plan: await getFreePlan(), subscription: null };
  }

  if (active) {
    const plan = await getPlan(active.planId);
    if (plan) return { plan, subscription: active };
  }
  return { plan: await getFreePlan(), subscription: null };
}

export async function getUserPlan(userId: string): Promise<PlanConfig> {
  return (await resolveEntitlement(userId)).plan;
}

export async function canUseFeature(
  userId: string,
  feature: Feature
): Promise<boolean> {
  return planHasFeature(await getUserPlan(userId), feature);
}
