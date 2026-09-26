"use client";

// 💳 Small shared billing UI: the plan badge, the usage meter, and the
// student's display country (for the local-currency equivalent). One of
// each for every billing page — no per-page copies.
import { useEffect, useState } from "react";
import { guessCountry } from "@/lib/billing/catalog";

export function PlanBadge({
  planId,
  name,
  size = "sm",
}: {
  planId: string;
  name: string;
  size?: "sm" | "lg";
}) {
  return (
    <span
      className={`plan-badge is-${planId} is-${size}`}
      aria-label={`الباقة: ${name}`}
    >
      {name.toUpperCase()}
    </span>
  );
}

export function formatDateAr(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ar-EG-u-nu-latn", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Usage meter: "43 / 100" + remaining, with text for every state (never
// colour alone) and a real progressbar role for screen readers.
export function UsageMeter({
  label,
  used,
  limit,
  period,
  resetHint,
  compact = false,
  group,
}: {
  label: string;
  used: number;
  limit: number | null;
  period: "اليوم" | "هذا الشهر";
  resetHint: string;
  compact?: boolean;
  // Section the meter sits in ("ملفات الدراسة"), for screen readers when
  // the visible label is only the period.
  group?: string;
}) {
  if (limit === null) {
    return (
      <div
        className={`usage-meter is-unlimited${compact ? " is-compact" : ""}`}
      >
        <div className="usage-meter-head">
          <span>{label}</span>
          <b>
            <bdi>{used}</bdi> {period}
          </b>
        </div>
        <small>
          بدون حد {period === "هذا الشهر" ? "شهري" : "يومي"} في باقتك
        </small>
      </div>
    );
  }
  const accessibleName = [
    group,
    label.includes(period) ? label : `${label} ${period}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const ratio = limit > 0 ? used / limit : 1;
  const remaining = Math.max(0, limit - used);
  const state = ratio >= 1 ? "full" : ratio >= 0.8 ? "warn" : "ok";
  const note =
    state === "full"
      ? period === "اليوم"
        ? `لقد وصلت إلى الحد اليومي · ${resetHint}`
        : `لقد وصلت إلى الحد الشهري · ${resetHint}`
      : state === "warn"
        ? `باقي ${remaining} فقط ${period}`
        : `متبقي ${remaining} ${period}`;
  return (
    <div className={`usage-meter is-${state}${compact ? " is-compact" : ""}`}>
      <div className="usage-meter-head">
        <span>{label}</span>
        <b dir="ltr">
          {used} / {limit}
        </b>
      </div>
      <div
        className="usage-meter-track"
        role="progressbar"
        aria-label={accessibleName}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        aria-valuetext={`${used} من ${limit} ${period}`}
      >
        <i style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
      <small>{note}</small>
    </div>
  );
}

// The student's country for the display currency: their verified phone
// number when known, else the device timezone. Resolved after mount so the
// server render and the first client render match.
export function useDisplayCountry(phone?: string | null): string | null {
  const [country, setCountry] = useState<string | null>(null);
  useEffect(() => {
    let timeZone: string | null = null;
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // ignore
    }
    setCountry(guessCountry({ phone, timeZone }));
  }, [phone]);
  return country;
}
