"use client";

// 💳 Contextual upgrade prompts. `PlanLimitError` carries the structured
// error the API returns ({ code, details } — lib/billing/http.ts) so a
// page can tell a plan limit from any other failure; <UpgradePrompt> shows
// the matching message with a way forward. Only the resource that hit its
// limit is blocked — nothing else in the app.
import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { BillingErrorDetails } from "@/lib/billing/catalog";

export class PlanLimitError extends Error {
  constructor(
    message: string,
    public readonly details: BillingErrorDetails
  ) {
    super(message);
    this.name = "PlanLimitError";
  }
}

// For fetch() callers: turn a failed response body into the right error.
export function errorFromResponseBody(
  body: { error?: string; code?: string; details?: BillingErrorDetails } | null,
  fallback: string
): Error {
  if (body?.details && body.code) {
    return new PlanLimitError(body.error || fallback, body.details);
  }
  return new Error(body?.error || fallback);
}

export function UpgradePrompt({
  details,
  message,
}: {
  details: BillingErrorDetails;
  message: string;
}) {
  const title =
    details.code === "FILE_SIZE_LIMIT"
      ? "الملف أكبر من حد باقتك"
      : details.code === "MONTHLY_LIMIT_REACHED"
        ? "وصلت للحد الشهري"
        : details.code === "PLAN_LIMIT_REACHED"
          ? "وصلت للحد اليومي"
          : "غير متاح في باقتك";
  return (
    <div className="upgrade-prompt" role="alert">
      <Sparkles size={18} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
        <div className="upgrade-prompt-actions">
          <Link href="/pricing" className="primary-button">
            {details.upgradePlanName
              ? `الترقية إلى ${details.upgradePlanName}`
              : "عرض الباقات"}
          </Link>
          <Link href="/account/plan" className="upgrade-prompt-link">
            استخدامي
          </Link>
        </div>
      </div>
    </div>
  );
}

// A quiet "almost out" line (≤ 20% left) — never alarming, never blocking.
export function RemainingHint({
  remaining,
  limit,
  noun,
}: {
  remaining: number | null | undefined;
  limit: number | null | undefined;
  noun: string;
}) {
  if (remaining == null || limit == null || limit <= 0) return null;
  if (remaining === 0 || remaining / limit > 0.2) return null;
  return (
    <p className="remaining-hint">
      باقي لك {remaining} {noun} اليوم ·{" "}
      <Link href="/pricing">احصل على المزيد</Link>
    </p>
  );
}
