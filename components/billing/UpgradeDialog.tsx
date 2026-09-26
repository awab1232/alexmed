"use client";

// 💳 Manual upgrade: plan + price (USD, with the local equivalent for
// reference) + how to pay, then the student sends a payment request that an
// admin approves in /admin/billing. The price shown is the server's; the
// request carries only the plan id — the amount is recorded server-side.
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MessageCircle, X } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import {
  formatPrice,
  localEquivalent,
  type PlanConfig,
} from "@/lib/billing/catalog";

export default function UpgradeDialog({
  plan,
  country,
  currencyRates,
  paymentMethods,
  paymentInstructions,
  supportContact,
  onClose,
}: {
  plan: PlanConfig;
  country: string | null;
  currencyRates: Record<string, number>;
  paymentMethods: string[];
  paymentInstructions: string;
  supportContact: { label: string; url: string };
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [method, setMethod] = useState(paymentMethods[0] ?? "");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const request = trpc.billing.requestUpgrade.useMutation({
    onSuccess: () => utils.billing.mine.invalidate(),
  });
  const dialogRef = useRef<HTMLDivElement>(null);
  const price = formatPrice(plan.priceMonthlyCents, plan.currency);
  const local = localEquivalent(plan.priceMonthlyCents, country, currencyRates);

  // Esc closes; focus moves into the dialog and back out on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current
      ?.querySelector<HTMLElement>("select, input, button")
      ?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="billing-dialog-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="billing-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        onClick={event => event.stopPropagation()}
      >
        <button
          type="button"
          className="billing-dialog-close"
          onClick={onClose}
          aria-label="إغلاق"
        >
          <X size={18} />
        </button>

        {request.isSuccess ? (
          <div className="billing-dialog-done" role="status">
            <CheckCircle2 size={40} aria-hidden="true" />
            <h2 id="upgrade-title">وصلنا طلبك ✅</h2>
            <p>
              سنراجع الدفع ونفعّل باقة {plan.name} لحسابك في أقرب وقت. سيصلك
              إشعار عند التفعيل، وتقدر تتابع حالة الطلب من صفحة باقتك.
            </p>
            <button type="button" className="primary-button" onClick={onClose}>
              تمام
            </button>
          </div>
        ) : (
          <form
            onSubmit={event => {
              event.preventDefault();
              request.mutate({
                planId: plan.id,
                paymentMethod: method,
                reference: reference.trim() || undefined,
                note: note.trim() || undefined,
              });
            }}
          >
            <h2 id="upgrade-title">الترقية إلى {plan.name}</h2>
            <dl className="billing-dialog-summary">
              <div>
                <dt>الباقة</dt>
                <dd>{plan.name}</dd>
              </div>
              <div>
                <dt>السعر</dt>
                <dd>
                  <bdi dir="ltr">{price}</bdi> شهريًا
                  {local && <small> ({local})</small>}
                </dd>
              </div>
              <div>
                <dt>المدة</dt>
                <dd>شهر واحد</dd>
              </div>
            </dl>
            {local && (
              <p className="billing-dialog-hint">
                السعر بعملتك تقريبي للتوضيح فقط، والدفع يكون بما يعادل{" "}
                <bdi dir="ltr">{price}</bdi>.
              </p>
            )}

            <div className="billing-dialog-instructions">
              <strong>كيف أدفع؟</strong>
              <p>{paymentInstructions}</p>
              {supportContact.url && (
                <a
                  href={supportContact.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="secondary-button"
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  {supportContact.label || "تواصل مع الدعم"}
                </a>
              )}
            </div>

            <label className="billing-field">
              <span>طريقة الدفع</span>
              <select
                value={method}
                onChange={event => setMethod(event.target.value)}
                required
              >
                {paymentMethods.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="billing-field">
              <span>رقم العملية أو المرجع (بعد الدفع)</span>
              <input
                value={reference}
                onChange={event => setReference(event.target.value)}
                maxLength={120}
                dir="auto"
                placeholder="مثال: رقم الحوالة"
              />
            </label>
            <label className="billing-field">
              <span>ملاحظة (اختياري)</span>
              <textarea
                value={note}
                onChange={event => setNote(event.target.value)}
                maxLength={500}
                rows={2}
              />
            </label>

            {request.error && (
              <p className="billing-error" role="alert">
                {request.error.message}
              </p>
            )}
            <button
              type="submit"
              className="primary-button billing-dialog-submit"
              disabled={request.isPending || !method}
            >
              {request.isPending && <Loader2 size={16} className="spin" />}
              أكملت الدفع — أرسل الطلب
            </button>
            <p className="billing-dialog-hint">
              لا نطلب ولا نحفظ أي بيانات بطاقة. تُفعَّل الباقة بعد تأكيد الدفع
              من فريق NiroLearn.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
