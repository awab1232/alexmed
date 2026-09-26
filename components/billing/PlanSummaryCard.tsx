"use client";

// 💳 The account page's plan card: current plan, until when, today's usage
// at a glance, and the way to manage / upgrade — full details live on
// /account/plan.
import Link from "next/link";
import { trpc } from "@/lib/trpc-client";
import { PlanBadge, UsageMeter, formatDateAr } from "./BillingBits";

export default function PlanSummaryCard() {
  const mine = trpc.billing.mine.useQuery();
  if (mine.isLoading) {
    return (
      <div className="plan-summary is-loading" aria-busy="true">
        <span />
        <span />
      </div>
    );
  }
  if (!mine.data) return null;
  const { plan, subscription, assistant, books, questions } = mine.data;
  const free = !subscription;
  const tomorrow = "يتجدد غدًا";
  return (
    <section
      className={`plan-summary is-${plan.id}`}
      aria-labelledby="plan-summary-title"
    >
      <header>
        <div>
          <h2 id="plan-summary-title">باقتك في NiroLearn</h2>
          <p>
            {free
              ? "أنت تستخدم الباقة المجانية."
              : subscription.endDate
                ? `فعّالة حتى ${formatDateAr(subscription.endDate)}`
                : "فعّالة"}
          </p>
        </div>
        <PlanBadge planId={plan.id} name={plan.name} />
      </header>
      <div className="plan-summary-meters">
        <UsageMeter
          compact
          label="مساعد Niro"
          used={assistant.used}
          limit={assistant.limit}
          period="اليوم"
          resetHint={tomorrow}
        />
        <UsageMeter
          compact
          label="ملفات الأسئلة"
          used={questions.daily.used}
          limit={questions.daily.limit}
          period="اليوم"
          resetHint={tomorrow}
        />
        <UsageMeter
          compact
          label="ملفات الدراسة"
          used={books.daily.used}
          limit={books.daily.limit}
          period="اليوم"
          resetHint={tomorrow}
        />
      </div>
      <div className="plan-summary-actions">
        <Link href="/account/plan" className="secondary-button">
          {free ? "عرض الاستخدام الكامل" : "إدارة الباقة"}
        </Link>
        {free && (
          <Link href="/pricing" className="primary-button">
            الترقية إلى Pro
          </Link>
        )}
      </div>
    </section>
  );
}
