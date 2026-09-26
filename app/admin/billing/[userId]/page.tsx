"use client";

// 💳 Admin: one student's billing — current plan + usage, the actions
// (activate / change / extend / cancel / expire / reset usage), and the
// full history: subscriptions, payment requests and the audit log.
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc-client";
import {
  PAYMENT_STATUS_AR,
  SUBSCRIPTION_STATUS_AR,
  formatPrice,
} from "@/lib/billing/catalog";
import {
  PlanBadge,
  UsageMeter,
  formatDateAr,
} from "@/components/billing/BillingBits";

const ACTION_AR: Record<string, string> = {
  ADMIN_ACTIVATED_PLAN: "تفعيل باقة",
  ADMIN_CHANGED_PLAN: "تغيير الباقة",
  ADMIN_EXTENDED_SUBSCRIPTION: "تمديد الاشتراك",
  ADMIN_CANCELLED_SUBSCRIPTION: "إلغاء الاشتراك",
  ADMIN_EXPIRED_SUBSCRIPTION: "إنهاء الاشتراك",
  ADMIN_RESET_USAGE: "إعادة ضبط الاستخدام",
  PAYMENT_REQUEST_APPROVED: "موافقة على طلب دفع",
  PAYMENT_REQUEST_REJECTED: "رفض طلب دفع",
  SUBSCRIPTION_EXPIRED: "انتهاء تلقائي",
};

export default function AdminBillingUserPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const utils = trpc.useUtils();
  const detail = trpc.adminBilling.user.useQuery({ userId });
  const plans = trpc.adminBilling.plans.useQuery();
  const refresh = () => {
    utils.adminBilling.user.invalidate({ userId });
    utils.adminBilling.users.invalidate();
    utils.adminBilling.overview.invalidate();
  };
  const activate = trpc.adminBilling.activate.useMutation({
    onSuccess: refresh,
  });
  const changePlan = trpc.adminBilling.changePlan.useMutation({
    onSuccess: refresh,
  });
  const extend = trpc.adminBilling.extend.useMutation({ onSuccess: refresh });
  const cancel = trpc.adminBilling.cancel.useMutation({ onSuccess: refresh });
  const expire = trpc.adminBilling.expire.useMutation({ onSuccess: refresh });
  const resetUsage = trpc.adminBilling.resetUsage.useMutation({
    onSuccess: refresh,
  });

  const [planId, setPlanId] = useState("pro");
  const [months, setMonths] = useState(1);
  const [reference, setReference] = useState("");
  const [extendDays, setExtendDays] = useState(0);
  const [extendMonths, setExtendMonths] = useState(1);

  if (detail.isLoading) return <Loader2 className="animate-spin" size={22} />;
  if (!detail.data) {
    return <p className="text-sm text-muted-foreground">المستخدم غير موجود.</p>;
  }
  const { user, summary, history, audit, requests } = detail.data;
  const planName = (id: string | null) =>
    id ? (plans.data?.find(plan => plan.id === id)?.name ?? id) : "—";
  const active = summary.subscription;
  const mutationError =
    activate.error ??
    changePlan.error ??
    extend.error ??
    cancel.error ??
    expire.error ??
    resetUsage.error;
  const busy =
    activate.isPending ||
    changePlan.isPending ||
    extend.isPending ||
    cancel.isPending ||
    expire.isPending ||
    resetUsage.isPending;
  const confirmThen = (message: string, run: () => void) => {
    if (window.confirm(message)) run();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/admin/billing"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronRight size={14} /> الاشتراكات والمدفوعات
      </Link>

      <div className="admin-plan-editor">
        <div className="admin-plan-head">
          <div>
            <h1 className="text-xl font-bold">{user.name || "بدون اسم"}</h1>
            <p className="text-sm text-muted-foreground" dir="ltr">
              {user.email ?? user.phone ?? ""}
              {user.username ? ` · @${user.username}` : ""}
            </p>
          </div>
          <PlanBadge
            planId={summary.plan.id}
            name={summary.plan.name}
            size="lg"
          />
        </div>
        <p className="text-sm">
          {active
            ? `${SUBSCRIPTION_STATUS_AR[active.status]} · من ${formatDateAr(active.startDate)} حتى ${
                active.endDate ? formatDateAr(active.endDate) : "بدون انتهاء"
              }`
            : "الباقة المجانية (بدون اشتراك فعّال)"}
        </p>
        <div className="admin-billing-meters">
          <UsageMeter
            compact
            label="مساعد Niro"
            used={summary.assistant.used}
            limit={summary.assistant.limit}
            period="اليوم"
            resetHint="غدًا"
          />
          <UsageMeter
            compact
            label="ملفات الدراسة (اليوم)"
            used={summary.books.daily.used}
            limit={summary.books.daily.limit}
            period="اليوم"
            resetHint="غدًا"
          />
          <UsageMeter
            compact
            label="ملفات الأسئلة (اليوم)"
            used={summary.questions.daily.used}
            limit={summary.questions.daily.limit}
            period="اليوم"
            resetHint="غدًا"
          />
          <UsageMeter
            compact
            label="ملفات الدراسة (الشهر)"
            used={summary.books.monthly.used}
            limit={summary.books.monthly.limit}
            period="هذا الشهر"
            resetHint="أول الشهر"
          />
          <UsageMeter
            compact
            label="ملفات الأسئلة (الشهر)"
            used={summary.questions.monthly.used}
            limit={summary.questions.monthly.limit}
            period="هذا الشهر"
            resetHint="أول الشهر"
          />
        </div>
      </div>

      {mutationError && (
        <p className="billing-error" role="alert">
          {mutationError.message}
        </p>
      )}

      <section className="admin-plan-editor">
        <h2 className="text-lg font-semibold">تفعيل / تغيير الباقة</h2>
        <div className="admin-plan-grid">
          <label className="admin-plan-field">
            <span>الباقة</span>
            <select
              value={planId}
              onChange={event => setPlanId(event.target.value)}
            >
              {plans.data
                ?.filter(plan => plan.priceMonthlyCents > 0)
                .map(plan => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="admin-plan-field">
            <span>المدة (أشهر)</span>
            <Input
              type="number"
              min={1}
              max={36}
              value={months}
              onChange={event => setMonths(Number(event.target.value))}
            />
          </label>
          <label className="admin-plan-field">
            <span>مرجع الدفع (اختياري)</span>
            <Input
              value={reference}
              onChange={event => setReference(event.target.value)}
            />
          </label>
        </div>
        <div className="admin-billing-actions">
          <Button
            disabled={busy}
            onClick={() =>
              confirmThen(
                `تفعيل ${planName(planId)} لمدة ${months} شهر تبدأ الآن؟`,
                () =>
                  activate.mutate({
                    userId,
                    planId,
                    months,
                    paymentReference: reference.trim() || undefined,
                  })
              )
            }
          >
            تفعيل لمدة {months} شهر
          </Button>
          {active && active.planId !== planId && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                confirmThen(
                  `تغيير الباقة إلى ${planName(planId)} مع الإبقاء على تاريخ الانتهاء الحالي؟`,
                  () => changePlan.mutate({ userId, planId })
                )
              }
            >
              تغيير إلى {planName(planId)} (نفس تاريخ الانتهاء)
            </Button>
          )}
        </div>
      </section>

      {active && (
        <section className="admin-plan-editor">
          <h2 className="text-lg font-semibold">الاشتراك الحالي</h2>
          <div className="admin-plan-grid">
            <label className="admin-plan-field">
              <span>تمديد (أشهر)</span>
              <Input
                type="number"
                min={0}
                max={36}
                value={extendMonths}
                onChange={event => setExtendMonths(Number(event.target.value))}
              />
            </label>
            <label className="admin-plan-field">
              <span>+ أيام</span>
              <Input
                type="number"
                min={0}
                max={366}
                value={extendDays}
                onChange={event => setExtendDays(Number(event.target.value))}
              />
            </label>
          </div>
          <div className="admin-billing-actions">
            <Button
              disabled={busy || extendMonths + extendDays === 0}
              onClick={() =>
                extend.mutate({
                  userId,
                  months: extendMonths,
                  days: extendDays,
                })
              }
            >
              تمديد
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                confirmThen(
                  "إلغاء الاشتراك؟ سيعود الطالب للباقة المجانية فورًا.",
                  () => cancel.mutate({ userId })
                )
              }
            >
              إلغاء الاشتراك
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                confirmThen("إنهاء الاشتراك الآن (Expired)؟", () =>
                  expire.mutate({ userId })
                )
              }
            >
              إنهاء الآن
            </Button>
          </div>
        </section>
      )}

      <section className="admin-plan-editor">
        <h2 className="text-lg font-semibold">الاستخدام</h2>
        <p className="text-sm text-muted-foreground">
          يعيد عدّادات اليوم وعدّادات الملفات لهذا الشهر إلى الصفر (يُسجَّل في
          سجل التدقيق).
        </p>
        <div>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              confirmThen("إعادة ضبط استخدام هذا الطالب؟", () =>
                resetUsage.mutate({ userId })
              )
            }
          >
            إعادة ضبط الاستخدام
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">سجل الاشتراكات</h2>
        {!history.length ? (
          <p className="text-sm text-muted-foreground">لا توجد اشتراكات.</p>
        ) : (
          <div className="admin-billing-table">
            <table>
              <thead>
                <tr>
                  <th>الباقة</th>
                  <th>الحالة</th>
                  <th>البدء</th>
                  <th>الانتهاء</th>
                  <th>الدفع</th>
                </tr>
              </thead>
              <tbody>
                {history.map(row => (
                  <tr key={row.id}>
                    <td>{planName(row.planId)}</td>
                    <td>{SUBSCRIPTION_STATUS_AR[row.status]}</td>
                    <td>{formatDateAr(row.startDate)}</td>
                    <td>{row.endDate ? formatDateAr(row.endDate) : "—"}</td>
                    <td dir="auto">
                      {row.paymentMethod ?? "—"}
                      {row.paymentReference ? ` · ${row.paymentReference}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!!requests.length && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">طلبات الدفع</h2>
          <div className="admin-billing-table">
            <table>
              <thead>
                <tr>
                  <th>الباقة</th>
                  <th>المبلغ</th>
                  <th>الطريقة / المرجع</th>
                  <th>الحالة</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(row => (
                  <tr key={row.id}>
                    <td>{planName(row.planId)}</td>
                    <td dir="ltr">
                      {formatPrice(row.amountCents, row.currency)}
                    </td>
                    <td dir="auto">
                      {row.paymentMethod}
                      {row.reference ? ` · ${row.reference}` : ""}
                    </td>
                    <td>{PAYMENT_STATUS_AR[row.status]}</td>
                    <td>{formatDateAr(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">سجل التدقيق</h2>
        {!audit.length ? (
          <p className="text-sm text-muted-foreground">لا توجد عمليات.</p>
        ) : (
          <ul className="admin-billing-audit">
            {audit.map(entry => (
              <li key={entry.id}>
                <strong>{ACTION_AR[entry.action] ?? entry.action}</strong>
                <span>
                  من {planName(entry.previousPlan)} إلى{" "}
                  {planName(entry.newPlan)}
                  {entry.newEndDate
                    ? ` · حتى ${formatDateAr(entry.newEndDate)}`
                    : ""}
                </span>
                <small>
                  {entry.adminName || entry.adminEmail || "تلقائي"} ·{" "}
                  {new Date(entry.createdAt).toLocaleString("ar-EG-u-nu-latn")}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
