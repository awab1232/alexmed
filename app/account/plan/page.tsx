"use client";

// 💳 "باقتي" — everything about the student's plan in one place: what plan,
// until when, today's and this month's usage and what's left, the file
// size limit, what's included, payment details, request status, and how
// to upgrade. All from billing.mine (server-resolved).
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import {
  FEATURE_LABELS_AR,
  FEATURES,
  PAYMENT_STATUS_AR,
  SUBSCRIPTION_STATUS_AR,
  formatPrice,
  planHasFeature,
} from "@/lib/billing/catalog";
import PlanCards from "@/components/billing/PlanCards";
import {
  PlanBadge,
  UsageMeter,
  formatDateAr,
  useDisplayCountry,
} from "@/components/billing/BillingBits";
import { usePlanActions } from "@/components/billing/usePlanActions";

const VISIBLE_FEATURES = FEATURES.filter(
  feature =>
    feature !== "BOOK_UPLOAD" &&
    feature !== "QUESTION_UPLOAD" &&
    feature !== "ASSISTANT"
);

export default function AccountPlanPage() {
  const { status } = useSession();
  const utils = trpc.useUtils();
  const mine = trpc.billing.mine.useQuery();
  const catalog = trpc.billing.plans.useQuery();
  const cancelRequest = trpc.billing.cancelRequest.useMutation({
    onSuccess: () => utils.billing.mine.invalidate(),
  });
  const country = useDisplayCountry(mine.data?.phone);
  const { actionFor, dialog } = usePlanActions({
    catalog: catalog.data,
    signedIn: status === "authenticated",
    currentPlanId: mine.data?.plan.id ?? null,
    pendingPlanId: mine.data?.pendingRequest?.planId ?? null,
    country,
  });

  if (mine.isLoading) {
    return (
      <section className="upload-view billing-page">
        <div
          className="billing-skeleton"
          aria-busy="true"
          aria-label="جاري التحميل"
        >
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  }
  if (mine.error || !mine.data) {
    return (
      <section className="upload-view billing-page">
        <p className="billing-error" role="alert">
          تعذّر تحميل معلومات باقتك.
        </p>
        <button
          type="button"
          className="secondary-button"
          onClick={() => mine.refetch()}
        >
          <RotateCcw size={15} /> إعادة المحاولة
        </button>
      </section>
    );
  }

  const data = mine.data;
  const { plan, subscription } = data;
  const free = !subscription;
  const planName = (id: string) =>
    catalog.data?.plans.find(p => p.id === id)?.name ?? id;
  const tomorrow = "يتجدد الاستخدام غدًا";
  const nextMonth = "يتجدد أول الشهر القادم";
  const topPlan =
    !!catalog.data?.plans.length &&
    plan.sortOrder >=
      Math.max(...catalog.data.plans.map(candidate => candidate.sortOrder));

  return (
    <section className="upload-view billing-page">
      <Link href="/account" className="billing-back">
        <ArrowRight size={16} aria-hidden="true" /> حسابي
      </Link>

      <div className={`billing-hero is-${plan.id}`}>
        <div className="billing-hero-head">
          <span className="billing-hero-label">الباقة الحالية</span>
          <PlanBadge planId={plan.id} name={plan.name} size="lg" />
        </div>
        {free ? (
          <>
            <h1>الباقة المجانية</h1>
            <p>
              أنت تستخدم NiroLearn مجانًا — كل أدوات الدراسة متاحة لك ضمن حدود
              يومية.
            </p>
          </>
        ) : (
          <>
            <h1>
              {plan.name}{" "}
              <span className="billing-status">
                {SUBSCRIPTION_STATUS_AR[subscription.status] ??
                  subscription.status}
              </span>
            </h1>
            <p>
              فترة الاشتراك: {formatDateAr(subscription.startDate)} ←{" "}
              {subscription.endDate
                ? formatDateAr(subscription.endDate)
                : "بدون تاريخ انتهاء"}
            </p>
            {subscription.endDate && (
              <p className="billing-hero-strong">
                فعّالة حتى {formatDateAr(subscription.endDate)}
              </p>
            )}
            <p className="billing-hero-muted">
              لا يوجد تجديد تلقائي. عند انتهاء المدة ترجع إلى الباقة المجانية
              وتبقى كل ملفاتك كما هي.
            </p>
          </>
        )}
      </div>

      {data.pendingRequest && (
        <div className="billing-pending" role="status">
          <div>
            <strong>طلب الترقية قيد المراجعة</strong>
            <p>
              {planName(data.pendingRequest.planId)} ·{" "}
              <bdi dir="ltr">
                {formatPrice(
                  data.pendingRequest.amountCents,
                  data.pendingRequest.currency
                )}
              </bdi>{" "}
              · {formatDateAr(data.pendingRequest.createdAt)}
            </p>
          </div>
          <button
            type="button"
            className="secondary-button"
            disabled={cancelRequest.isPending}
            onClick={() =>
              cancelRequest.mutate({ requestId: data.pendingRequest!.id })
            }
          >
            إلغاء الطلب
          </button>
        </div>
      )}

      <h2 className="billing-section-title">استخدامك</h2>
      <div className="billing-usage-grid">
        <div className="billing-usage-card">
          <h3>مساعد Niro</h3>
          <UsageMeter
            label="الرسائل اليوم"
            used={data.assistant.used}
            limit={data.assistant.limit}
            period="اليوم"
            resetHint={tomorrow}
          />
        </div>
        <div className="billing-usage-card">
          <h3>ملفات الدراسة</h3>
          <UsageMeter
            group="ملفات الدراسة"
            label="اليوم"
            used={data.books.daily.used}
            limit={data.books.daily.limit}
            period="اليوم"
            resetHint={tomorrow}
          />
          <UsageMeter
            group="ملفات الدراسة"
            label="هذا الشهر"
            used={data.books.monthly.used}
            limit={data.books.monthly.limit}
            period="هذا الشهر"
            resetHint={nextMonth}
          />
        </div>
        <div className="billing-usage-card">
          <h3>ملفات الأسئلة</h3>
          <UsageMeter
            group="ملفات الأسئلة"
            label="اليوم"
            used={data.questions.daily.used}
            limit={data.questions.daily.limit}
            period="اليوم"
            resetHint={tomorrow}
          />
          <UsageMeter
            group="ملفات الأسئلة"
            label="هذا الشهر"
            used={data.questions.monthly.used}
            limit={data.questions.monthly.limit}
            period="هذا الشهر"
            resetHint={nextMonth}
          />
        </div>
        <div className="billing-usage-card is-static">
          <h3>حجم الملف</h3>
          <p className="billing-big">
            <bdi dir="ltr">{data.maxFileSizeMb}MB</bdi>
          </p>
          <small>الحد الأقصى لحجم الملف الواحد في باقتك</small>
        </div>
      </div>

      <h2 className="billing-section-title">ما تتضمنه باقتك</h2>
      <ul className="billing-features">
        {VISIBLE_FEATURES.map(feature => {
          const included = planHasFeature(plan, feature);
          return (
            <li key={feature} className={included ? "is-on" : "is-off"}>
              <span aria-hidden="true">{included ? "✓" : "—"}</span>
              {FEATURE_LABELS_AR[feature]}
              <span className="sr-only">{included ? "متاح" : "غير متاح"}</span>
            </li>
          );
        })}
      </ul>

      {subscription && (
        <>
          <h2 className="billing-section-title">تفاصيل الاشتراك</h2>
          <dl className="billing-details">
            <div>
              <dt>الحالة</dt>
              <dd>
                {SUBSCRIPTION_STATUS_AR[subscription.status] ??
                  subscription.status}
              </dd>
            </div>
            <div>
              <dt>تاريخ البدء</dt>
              <dd>{formatDateAr(subscription.startDate)}</dd>
            </div>
            <div>
              <dt>تاريخ الانتهاء</dt>
              <dd>
                {subscription.endDate
                  ? formatDateAr(subscription.endDate)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>طريقة الدفع</dt>
              <dd>
                {!subscription.paymentMethod ||
                subscription.paymentMethod === "manual"
                  ? "تحويل يدوي"
                  : `تحويل يدوي · ${subscription.paymentMethod}`}
              </dd>
            </div>
            {subscription.paymentReference && (
              <div>
                <dt>المرجع</dt>
                <dd dir="auto">{subscription.paymentReference}</dd>
              </div>
            )}
          </dl>
        </>
      )}

      {!!data.requests.length && (
        <>
          <h2 className="billing-section-title">طلبات الترقية</h2>
          <ul className="billing-requests">
            {data.requests.map(request => (
              <li key={request.id}>
                <span>
                  {planName(request.planId)} · {formatDateAr(request.createdAt)}
                </span>
                <span className={`billing-request-status is-${request.status}`}>
                  {PAYMENT_STATUS_AR[request.status] ?? request.status}
                </span>
                {request.adminNote && (
                  <small dir="auto">{request.adminNote}</small>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {catalog.data && !topPlan && (
        <>
          <h2 className="billing-section-title">
            {free ? "تحتاج مساحة أكبر؟" : "باقات أخرى"}
          </h2>
          <PlanCards
            plans={catalog.data.plans}
            country={country}
            currencyRates={catalog.data.currencyRates}
            actionFor={actionFor}
          />
        </>
      )}
      <p className="billing-footer-link">
        <Link href="/pricing">مقارنة كل الباقات ←</Link>
      </p>
      {dialog}
    </section>
  );
}
