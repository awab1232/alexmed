// 💳 Plan catalogue + billing settings, read from the database (the single
// source of truth for prices and limits — editable in /admin/billing).
// Cached in memory for a short time: every upload / assistant request needs
// the plan, and plans change rarely; an admin edit clears the cache.
import { asc, eq } from "drizzle-orm";
import { appSettings, plans } from "../../drizzle/schema";
import { requireDb } from "../db";
import {
  DEFAULT_BILLING_SETTINGS,
  DEFAULT_PLAN_ID,
  type BillingSettings,
  type PlanConfig,
} from "./catalog";

const CACHE_MS = 30_000;
let planCache: { at: number; plans: PlanConfig[] } | null = null;
let settingsCache: { at: number; value: BillingSettings } | null = null;

export function clearBillingCache() {
  planCache = null;
  settingsCache = null;
}

function toConfig(row: typeof plans.$inferSelect): PlanConfig {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    priceMonthlyCents: row.priceMonthlyCents,
    priceYearlyCents: row.priceYearlyCents,
    currency: row.currency,
    assistantDailyLimit: row.assistantDailyLimit,
    assistantTokenDailyLimit: row.assistantTokenDailyLimit,
    questionsDailyLimit: row.questionsDailyLimit,
    questionsMonthlyLimit: row.questionsMonthlyLimit,
    booksDailyLimit: row.booksDailyLimit,
    booksMonthlyLimit: row.booksMonthlyLimit,
    maxFileSizeMb: row.maxFileSizeMb,
    processingConcurrency: row.processingConcurrency,
    features: row.features ?? {},
    highlighted: row.highlighted,
    active: row.active,
    sortOrder: row.sortOrder,
  };
}

// All plans (inactive included — an existing subscriber keeps their plan
// even if it's no longer sold), in display order.
export async function getAllPlans(): Promise<PlanConfig[]> {
  if (planCache && Date.now() - planCache.at < CACHE_MS) return planCache.plans;
  const rows = await requireDb()
    .select()
    .from(plans)
    .orderBy(asc(plans.sortOrder));
  const list = rows.map(toConfig);
  planCache = { at: Date.now(), plans: list };
  return list;
}

export async function getPublicPlans(): Promise<PlanConfig[]> {
  return (await getAllPlans()).filter(plan => plan.active);
}

export async function getPlan(id: string): Promise<PlanConfig | null> {
  return (await getAllPlans()).find(plan => plan.id === id) ?? null;
}

// The free plan must always exist (migration 0038 seeds it); this is the
// fallback entitlement for everyone without an active subscription.
export async function getFreePlan(): Promise<PlanConfig> {
  const free = await getPlan(DEFAULT_PLAN_ID);
  if (!free) throw new Error("The free plan is missing from the plans table");
  return free;
}

// The next plan up (by display order) whose value for `pick` is higher —
// what an upgrade prompt offers. null from `pick` means "no cap".
export async function nextPlanUp(
  current: PlanConfig,
  pick: (plan: PlanConfig) => number | null
): Promise<PlanConfig | null> {
  const currentValue = pick(current);
  if (currentValue === null) return null;
  const candidates = (await getPublicPlans()).filter(
    plan => plan.sortOrder > current.sortOrder
  );
  return (
    candidates.find(plan => {
      const value = pick(plan);
      return value === null || value > currentValue;
    }) ?? null
  );
}

export type PlanUpdate = Partial<Omit<PlanConfig, "id">>;

export async function updatePlan(id: string, update: PlanUpdate) {
  const [row] = await requireDb()
    .update(plans)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(plans.id, id))
    .returning();
  clearBillingCache();
  return row ? toConfig(row) : null;
}

export async function getBillingSettings(): Promise<BillingSettings> {
  if (settingsCache && Date.now() - settingsCache.at < CACHE_MS) {
    return settingsCache.value;
  }
  const [row] = await requireDb()
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, "billing"))
    .limit(1);
  const value = {
    ...DEFAULT_BILLING_SETTINGS,
    ...((row?.value ?? {}) as Partial<BillingSettings>),
  };
  settingsCache = { at: Date.now(), value };
  return value;
}

export async function updateBillingSettings(
  value: BillingSettings,
  adminId: string
) {
  await requireDb()
    .insert(appSettings)
    .values({ key: "billing", value, updatedBy: adminId })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedBy: adminId, updatedAt: new Date() },
    });
  clearBillingCache();
}
