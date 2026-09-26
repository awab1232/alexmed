"use client";

// 💳 Plan cards + comparison, shared by /pricing and /account/plan. Every
// number comes from the plans table (billing.plans) — nothing hard-coded.
// Pro is the visually leading card (plans.highlighted); prices are USD
// with the student's local equivalent shown for reference only.
import Link from "next/link";
import { Check, Minus, Sparkles } from "lucide-react";
import {
  formatPrice,
  localEquivalent,
  planHasFeature,
  type PlanConfig,
} from "@/lib/billing/catalog";

function withMonthly(daily: string, monthly: number | null) {
  return monthly === null ? daily : `${daily} · ${monthly} شهريًا`;
}

export function planHighlights(plan: PlanConfig, fastest: number): string[] {
  const lines = [
    `${plan.assistantDailyLimit} رسالة لمساعد Niro يوميًا`,
    withMonthly(
      `${plan.booksDailyLimit} ملفات دراسة يوميًا`,
      plan.booksMonthlyLimit
    ),
    withMonthly(
      `${plan.questionsDailyLimit} ملفات أسئلة يوميًا`,
      plan.questionsMonthlyLimit
    ),
    `ملفات حتى ${plan.maxFileSizeMb}MB`,
    !planHasFeature(plan, "PRIORITY_PROCESSING")
      ? "معالجة قياسية"
      : plan.processingConcurrency >= fastest
        ? "Priority Processing — أعلى أولوية"
        : "Priority Processing — معالجة أسرع",
    "Exam Focus · Cards · Quiz · Summary · Mind Map",
  ];
  return lines;
}

export type PlanCardAction =
  | { kind: "link"; href: string; label: string }
  | { kind: "button"; label: string; onClick: () => void }
  | { kind: "current"; label: string }
  | { kind: "none" };

export default function PlanCards({
  plans,
  country,
  currencyRates,
  actionFor,
}: {
  plans: PlanConfig[];
  country: string | null;
  currencyRates: Record<string, number>;
  actionFor: (plan: PlanConfig) => PlanCardAction;
}) {
  const fastest = Math.max(...plans.map(plan => plan.processingConcurrency));
  return (
    <div className="plan-cards">
      {plans.map(plan => {
        const action = actionFor(plan);
        const free = plan.priceMonthlyCents <= 0;
        const local = localEquivalent(
          plan.priceMonthlyCents,
          country,
          currencyRates
        );
        const buttonClass = plan.highlighted
          ? "primary-button"
          : "secondary-button";
        return (
          <article
            key={plan.id}
            className={`plan-card is-${plan.id}${plan.highlighted ? " is-highlighted" : ""}`}
            aria-labelledby={`plan-${plan.id}-name`}
          >
            {plan.highlighted && (
              <span className="plan-card-ribbon">
                <Sparkles size={13} aria-hidden="true" /> الأكثر استخدامًا
              </span>
            )}
            <header>
              <h3 id={`plan-${plan.id}-name`}>{plan.name}</h3>
              <p className="plan-card-tagline">{plan.tagline}</p>
            </header>
            <div className="plan-card-price">
              {free ? (
                <>
                  <strong>مجانًا</strong>
                  <span>بدون اشتراك</span>
                </>
              ) : (
                <>
                  <strong dir="ltr">
                    {formatPrice(plan.priceMonthlyCents, plan.currency)}
                  </strong>
                  <span>/ شهريًا</span>
                </>
              )}
            </div>
            <p className="plan-card-local">
              {local ? `${local} تقريبًا` : " "}
            </p>
            <p className="plan-card-description">{plan.description}</p>
            {action.kind === "link" && (
              <Link href={action.href} className={buttonClass}>
                {action.label}
              </Link>
            )}
            {action.kind === "button" && (
              <button
                type="button"
                className={buttonClass}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            )}
            {action.kind === "current" && (
              <span className="plan-card-current">{action.label}</span>
            )}
            <ul className="plan-card-list">
              {planHighlights(plan, fastest).map(line => (
                <li key={line}>
                  <Check size={15} aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}

// Only meaningful differences, grouped; scrolls inside its own box on
// small screens (the page itself never scrolls sideways).
export function PlanComparison({ plans }: { plans: PlanConfig[] }) {
  const fastest = Math.max(...plans.map(plan => plan.processingConcurrency));
  const monthly = (value: number | null) =>
    value === null ? "بدون حد شهري" : `${value} شهريًا`;
  const groups: {
    title: string;
    rows: { label: string; value: (plan: PlanConfig) => string | boolean }[];
  }[] = [
    {
      title: "AI Assistant",
      rows: [
        {
          label: "رسائل مساعد Niro",
          value: plan => `${plan.assistantDailyLimit} يوميًا`,
        },
      ],
    },
    {
      title: "ملفات الدراسة",
      rows: [
        {
          label: "ملفات الدراسة",
          value: plan =>
            `${plan.booksDailyLimit} يوميًا · ${monthly(plan.booksMonthlyLimit)}`,
        },
        {
          label: "ملفات الأسئلة",
          value: plan =>
            `${plan.questionsDailyLimit} يوميًا · ${monthly(plan.questionsMonthlyLimit)}`,
        },
        {
          label: "أقصى حجم للملف",
          value: plan => `${plan.maxFileSizeMb}MB`,
        },
      ],
    },
    {
      title: "المعالجة",
      rows: [
        {
          label: "Priority Processing",
          value: plan =>
            !planHasFeature(plan, "PRIORITY_PROCESSING")
              ? "قياسية"
              : plan.processingConcurrency >= fastest
                ? "الأعلى"
                : "أسرع",
        },
      ],
    },
    {
      title: "أدوات الدراسة",
      rows: [
        {
          label: "Exam Focus",
          value: plan => planHasFeature(plan, "EXAM_FOCUS"),
        },
        {
          label: "Cards · Quiz · Summary",
          value: plan =>
            planHasFeature(plan, "CARDS") &&
            planHasFeature(plan, "QUIZ") &&
            planHasFeature(plan, "SUMMARY"),
        },
        { label: "Mind Map", value: plan => planHasFeature(plan, "MIND_MAP") },
      ],
    },
    {
      title: "السجل",
      rows: [
        {
          label: "حفظ سجل المحادثات",
          value: plan => planHasFeature(plan, "CHAT_HISTORY"),
        },
      ],
    },
  ];
  return (
    <div
      className="plan-compare"
      role="region"
      aria-label="مقارنة الباقات"
      tabIndex={0}
    >
      <table>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">الميزة</span>
            </th>
            {plans.map(plan => (
              <th
                key={plan.id}
                scope="col"
                className={plan.highlighted ? "is-highlighted" : undefined}
              >
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map(group => (
          <tbody key={group.title}>
            <tr className="plan-compare-group">
              <th scope="rowgroup" colSpan={plans.length + 1}>
                {group.title}
              </th>
            </tr>
            {group.rows.map(row => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {plans.map(plan => {
                  const value = row.value(plan);
                  return (
                    <td
                      key={plan.id}
                      className={
                        plan.highlighted ? "is-highlighted" : undefined
                      }
                    >
                      {value === true ? (
                        <>
                          <Check size={16} aria-hidden="true" />
                          <span className="sr-only">متاح</span>
                        </>
                      ) : value === false ? (
                        <>
                          <Minus size={16} aria-hidden="true" />
                          <span className="sr-only">غير متاح</span>
                        </>
                      ) : (
                        value
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
