// 💳 The usage engine — the ONLY place limits are checked and consumed.
// Routes call consumeUsage() when a request is accepted for processing and
// releaseUsage() if it then fails before the student got anything.
//
// Atomicity: each increment is ONE statement,
//   INSERT … ON CONFLICT (userId, period) DO UPDATE SET n = n + 1
//   WHERE n < limit RETURNING n
// which takes the row lock, so concurrent requests (5 tabs at once) queue
// on the row and at most `limit` of them get a row back. Daily + monthly
// run in one transaction: hitting the monthly cap rolls back the daily +1.
import { and, eq, sql } from "drizzle-orm";
import { usageDaily, usageMonthly } from "../../drizzle/schema";
import { requireDb } from "../db";
import {
  maxFileSizeBytes,
  planHasFeature,
  type BillingErrorCode,
  type BillingErrorDetails,
  type Feature,
  type PlanConfig,
  type Resource,
} from "./catalog";
import { resolveEntitlement, type Entitlement } from "./entitlement";
import { periodKeys } from "./periods";
import { getPublicPlans, nextPlanUp } from "./plans";

export class BillingError extends Error {
  constructor(
    public readonly details: BillingErrorDetails,
    message: string
  ) {
    super(message);
    this.name = "BillingError";
  }
  get code(): BillingErrorCode {
    return this.details.code;
  }
}

type Column = "assistantMessages" | "questionFiles" | "bookFiles";

const RESOURCE_SPEC: Record<
  Resource,
  {
    column: Column;
    feature: Feature;
    daily: (plan: PlanConfig) => number;
    monthly: (plan: PlanConfig) => number | null;
    noun: string;
  }
> = {
  ASSISTANT_MESSAGE: {
    column: "assistantMessages",
    feature: "ASSISTANT",
    daily: plan => plan.assistantDailyLimit,
    monthly: () => null,
    noun: "رسائل مساعد Niro",
  },
  QUESTION_FILE: {
    column: "questionFiles",
    feature: "QUESTION_UPLOAD",
    daily: plan => plan.questionsDailyLimit,
    monthly: plan => plan.questionsMonthlyLimit,
    noun: "ملفات الأسئلة",
  },
  BOOK_FILE: {
    column: "bookFiles",
    feature: "BOOK_UPLOAD",
    daily: plan => plan.booksDailyLimit,
    monthly: plan => plan.booksMonthlyLimit,
    noun: "الملفات",
  },
};

async function upgradeHint(
  plan: PlanConfig,
  pick: (plan: PlanConfig) => number | null
) {
  const next = await nextPlanUp(plan, pick);
  return next
    ? {
        upgradePlanId: next.id,
        upgradePlanName: next.name,
        upgradeValue: pick(next) ?? undefined,
      }
    : {};
}

async function limitError(
  code: "PLAN_LIMIT_REACHED" | "MONTHLY_LIMIT_REACHED",
  resource: Resource,
  plan: PlanConfig,
  limit: number
): Promise<BillingError> {
  const spec = RESOURCE_SPEC[resource];
  const pick = code === "MONTHLY_LIMIT_REACHED" ? spec.monthly : spec.daily;
  const hint = await upgradeHint(plan, pick);
  const message =
    code === "MONTHLY_LIMIT_REACHED"
      ? `وصلت للحد الشهري من ${spec.noun} في باقة ${plan.name} (${limit}). يتجدد الاستخدام أول الشهر القادم.`
      : `وصلت للحد اليومي من ${spec.noun} في باقة ${plan.name} (${limit}). يتجدد الاستخدام غدًا.`;
  return new BillingError(
    {
      code,
      resource,
      planId: plan.id,
      planName: plan.name,
      limit,
      used: limit,
      ...hint,
    },
    hint.upgradePlanName
      ? `${message} للمزيد رقِّ باقتك إلى ${hint.upgradePlanName}.`
      : message
  );
}

function featureError(plan: PlanConfig, feature: Feature): BillingError {
  return new BillingError(
    {
      code: "FEATURE_NOT_AVAILABLE",
      feature,
      planId: plan.id,
      planName: plan.name,
    },
    `هذه الميزة غير متاحة في باقة ${plan.name}.`
  );
}

export async function assertFeature(
  userId: string,
  feature: Feature
): Promise<Entitlement> {
  const entitlement = await resolveEntitlement(userId);
  if (!planHasFeature(entitlement.plan, feature)) {
    throw featureError(entitlement.plan, feature);
  }
  return entitlement;
}

export type UsageReceipt = {
  userId: string;
  resource: Resource;
  day: string;
  month: string;
  plan: PlanConfig;
  dailyUsed: number;
  dailyLimit: number;
};

// Atomic "check and +1" on one period row. Returns the new count, or null
// when the row is already at `limit`. Table/column names come only from the
// constant maps above, never from input.
async function incrementIfBelow(
  executor: Pick<ReturnType<typeof requireDb>, "execute">,
  table: "usage_daily" | "usage_monthly",
  keyColumn: "day" | "month",
  userId: string,
  key: string,
  column: Column,
  limit: number
): Promise<number | null> {
  const col = sql.raw(`"${column}"`);
  const tbl = sql.raw(`"${table}"`);
  const keyCol = sql.raw(`"${keyColumn}"`);
  const rows = (await executor.execute(sql`
    INSERT INTO ${tbl} ("userId", ${keyCol}, ${col})
    VALUES (${userId}, ${key}, 1)
    ON CONFLICT ("userId", ${keyCol}) DO UPDATE
      SET ${col} = ${tbl}.${col} + 1, "updatedAt" = now()
      WHERE ${tbl}.${col} < ${limit}
    RETURNING ${col} AS n
  `)) as unknown as { n: number }[];
  return rows.length ? Number(rows[0].n) : null;
}

class MonthlyLimitHit extends Error {}

export async function consumeUsage(
  userId: string,
  resource: Resource,
  now = new Date()
): Promise<UsageReceipt> {
  const { plan } = await resolveEntitlement(userId, now);
  const spec = RESOURCE_SPEC[resource];
  if (!planHasFeature(plan, spec.feature)) {
    throw featureError(plan, spec.feature);
  }
  const { day, month } = periodKeys(now);
  const dailyLimit = spec.daily(plan);
  const monthlyLimit = spec.monthly(plan);
  if (dailyLimit <= 0) {
    throw await limitError("PLAN_LIMIT_REACHED", resource, plan, dailyLimit);
  }
  if (monthlyLimit !== null && monthlyLimit <= 0) {
    throw await limitError(
      "MONTHLY_LIMIT_REACHED",
      resource,
      plan,
      monthlyLimit
    );
  }

  // The assistant's optional output-token safety cap (Free).
  if (resource === "ASSISTANT_MESSAGE" && plan.assistantTokenDailyLimit) {
    const [row] = await requireDb()
      .select({ tokens: usageDaily.assistantTokens })
      .from(usageDaily)
      .where(and(eq(usageDaily.userId, userId), eq(usageDaily.day, day)))
      .limit(1);
    if ((row?.tokens ?? 0) >= plan.assistantTokenDailyLimit) {
      const hint = await upgradeHint(plan, p => p.assistantTokenDailyLimit);
      throw new BillingError(
        {
          code: "PLAN_LIMIT_REACHED",
          resource,
          planId: plan.id,
          planName: plan.name,
          limit: plan.assistantTokenDailyLimit,
          used: row?.tokens ?? 0,
          ...hint,
        },
        `وصلت للحد اليومي من استخدام مساعد Niro في باقة ${plan.name}. يتجدد الاستخدام غدًا.`
      );
    }
  }

  let dailyUsed: number | null;
  try {
    dailyUsed = await requireDb().transaction(async tx => {
      const used = await incrementIfBelow(
        tx,
        "usage_daily",
        "day",
        userId,
        day,
        spec.column,
        dailyLimit
      );
      if (used === null) return null;
      if (monthlyLimit !== null) {
        const monthlyUsed = await incrementIfBelow(
          tx,
          "usage_monthly",
          "month",
          userId,
          month,
          spec.column as Exclude<Column, "assistantMessages">,
          monthlyLimit
        );
        // Throwing rolls back this transaction's daily +1 as well.
        if (monthlyUsed === null) throw new MonthlyLimitHit();
      }
      return used;
    });
  } catch (error) {
    if (error instanceof MonthlyLimitHit) {
      throw await limitError(
        "MONTHLY_LIMIT_REACHED",
        resource,
        plan,
        monthlyLimit!
      );
    }
    throw error;
  }
  if (dailyUsed === null) {
    throw await limitError("PLAN_LIMIT_REACHED", resource, plan, dailyLimit);
  }
  return { userId, resource, day, month, plan, dailyUsed, dailyLimit };
}

// Gives back one unit taken by `receipt` (the request failed before the
// student got anything — e.g. every AI model failed, or the upload could
// not be queued). Never goes below zero.
export async function releaseUsage(receipt: UsageReceipt): Promise<void> {
  const spec = RESOURCE_SPEC[receipt.resource];
  const col = sql.raw(`"${spec.column}"`);
  const db = requireDb();
  await db.execute(sql`
    UPDATE "usage_daily" SET ${col} = GREATEST(${col} - 1, 0), "updatedAt" = now()
    WHERE "userId" = ${receipt.userId} AND "day" = ${receipt.day}
  `);
  if (spec.monthly(receipt.plan) !== null) {
    await db.execute(sql`
      UPDATE "usage_monthly" SET ${col} = GREATEST(${col} - 1, 0), "updatedAt" = now()
      WHERE "userId" = ${receipt.userId} AND "month" = ${receipt.month}
    `);
  }
}

// Output tokens of an answer the student received (estimated from its
// length when the provider doesn't report usage) — feeds the Free plan's
// daily token safety cap.
export async function recordAssistantTokens(
  receipt: UsageReceipt,
  tokens: number
): Promise<void> {
  if (tokens <= 0) return;
  await requireDb()
    .update(usageDaily)
    .set({
      assistantTokens: sql`${usageDaily.assistantTokens} + ${Math.round(tokens)}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(usageDaily.userId, receipt.userId),
        eq(usageDaily.day, receipt.day)
      )
    );
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

// Server-side file size check against the plan (the upload URL route asks
// before signing; the processing route checks the stored object's real
// size). Throws FILE_SIZE_LIMIT naming the smallest plan that would fit.
export async function assertFileSizeAllowed(
  userId: string,
  bytes: number
): Promise<PlanConfig> {
  const { plan } = await resolveEntitlement(userId);
  if (bytes <= maxFileSizeBytes(plan)) return plan;
  const actualMb = Math.round((bytes / (1024 * 1024)) * 10) / 10;
  const fits = (await getPublicPlans()).find(
    candidate =>
      candidate.sortOrder > plan.sortOrder &&
      maxFileSizeBytes(candidate) >= bytes
  );
  throw new BillingError(
    {
      code: "FILE_SIZE_LIMIT",
      planId: plan.id,
      planName: plan.name,
      maxFileSizeMb: plan.maxFileSizeMb,
      actualFileSizeMb: actualMb,
      ...(fits
        ? {
            upgradePlanId: fits.id,
            upgradePlanName: fits.name,
            upgradeValue: fits.maxFileSizeMb,
          }
        : {}),
    },
    fits
      ? `باقة ${plan.name} تدعم ملفات حتى ${plan.maxFileSizeMb}MB، وملفك ${actualMb}MB. رقِّ إلى ${fits.name} لملفات حتى ${fits.maxFileSizeMb}MB.`
      : `الحد الأقصى لحجم الملف في باقتك هو ${plan.maxFileSizeMb}MB، وملفك ${actualMb}MB.`
  );
}

export type UsageMeter = {
  used: number;
  limit: number | null;
  remaining: number | null;
};

function meter(used: number, limit: number | null): UsageMeter {
  return {
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
  };
}

// Everything the account / plan pages show, in two small indexed reads.
export async function getUsageSummary(userId: string, now = new Date()) {
  const entitlement = await resolveEntitlement(userId, now);
  const { plan } = entitlement;
  const { day, month, dayResetsAt, monthResetsAt } = periodKeys(now);
  const db = requireDb();
  const [[daily], [monthly]] = await Promise.all([
    db
      .select()
      .from(usageDaily)
      .where(and(eq(usageDaily.userId, userId), eq(usageDaily.day, day)))
      .limit(1),
    db
      .select()
      .from(usageMonthly)
      .where(
        and(eq(usageMonthly.userId, userId), eq(usageMonthly.month, month))
      )
      .limit(1),
  ]);
  return {
    plan,
    subscription: entitlement.subscription,
    day,
    month,
    dayResetsAt,
    monthResetsAt,
    assistant: meter(daily?.assistantMessages ?? 0, plan.assistantDailyLimit),
    assistantTokens: meter(
      daily?.assistantTokens ?? 0,
      plan.assistantTokenDailyLimit
    ),
    questions: {
      daily: meter(daily?.questionFiles ?? 0, plan.questionsDailyLimit),
      monthly: meter(monthly?.questionFiles ?? 0, plan.questionsMonthlyLimit),
    },
    books: {
      daily: meter(daily?.bookFiles ?? 0, plan.booksDailyLimit),
      monthly: meter(monthly?.bookFiles ?? 0, plan.booksMonthlyLimit),
    },
    maxFileSizeMb: plan.maxFileSizeMb,
  };
}

export type UsageSummary = Awaited<ReturnType<typeof getUsageSummary>>;

// Admin "reset usage" — today's counters (and this month's file counters)
// back to zero for one student; audited by the caller.
export async function resetUsage(userId: string, now = new Date()) {
  const { day, month } = periodKeys(now);
  const db = requireDb();
  await db
    .update(usageDaily)
    .set({
      assistantMessages: 0,
      assistantTokens: 0,
      questionFiles: 0,
      bookFiles: 0,
      updatedAt: new Date(),
    })
    .where(and(eq(usageDaily.userId, userId), eq(usageDaily.day, day)));
  await db
    .update(usageMonthly)
    .set({ questionFiles: 0, bookFiles: 0, updatedAt: new Date() })
    .where(and(eq(usageMonthly.userId, userId), eq(usageMonthly.month, month)));
  return { day, month };
}
