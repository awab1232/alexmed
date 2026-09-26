"use client";

// 💳 Admin: payment requests (approve / reject), subscribers (search →
// manage), and the plan catalogue + payment settings (prices and limits
// change here, no deploy). Every action is an audited server mutation.
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc-client";
import {
  FEATURE_LABELS_AR,
  FEATURES,
  PAYMENT_STATUS_AR,
  SUBSCRIPTION_STATUS_AR,
  formatPrice,
  type Feature,
  type PlanConfig,
} from "@/lib/billing/catalog";
import { PlanBadge, formatDateAr } from "@/components/billing/BillingBits";

type Tab = "requests" | "subscribers" | "plans";
type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export default function AdminBillingPage() {
  const [tab, setTab] = useState<Tab>("requests");
  const overview = trpc.adminBilling.overview.useQuery();
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">الاشتراكات والمدفوعات</h1>
        <p className="text-sm text-muted-foreground">
          كل تغيير هنا يُسجَّل في سجل التدقيق باسمك.
        </p>
      </div>

      {overview.data && (
        <div className="admin-billing-stats">
          <div>
            <span>طلبات بانتظار المراجعة</span>
            <strong>{overview.data.pendingRequests}</strong>
          </div>
          <div>
            <span>مشتركو Pro</span>
            <strong>{overview.data.activeByPlan.pro ?? 0}</strong>
          </div>
          <div>
            <span>مشتركو Ultimate</span>
            <strong>{overview.data.activeByPlan.ultimate ?? 0}</strong>
          </div>
        </div>
      )}

      <div className="admin-billing-tabs" role="tablist">
        {(
          [
            ["requests", "طلبات الدفع"],
            ["subscribers", "المشتركون"],
            ["plans", "الباقات والإعدادات"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "is-active" : undefined}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "requests" && !!overview.data?.pendingRequests && (
              <span className="admin-billing-count">
                {overview.data.pendingRequests}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "requests" && <RequestsTab />}
      {tab === "subscribers" && <SubscribersTab />}
      {tab === "plans" && <PlansTab />}
    </div>
  );
}

function RequestsTab() {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<RequestStatus>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const plans = trpc.adminBilling.plans.useQuery();
  const requests = trpc.adminBilling.paymentRequests.useQuery({ status });
  const refresh = () => {
    utils.adminBilling.paymentRequests.invalidate();
    utils.adminBilling.overview.invalidate();
  };
  const approve = trpc.adminBilling.approve.useMutation({ onSuccess: refresh });
  const reject = trpc.adminBilling.reject.useMutation({ onSuccess: refresh });
  const planName = (id: string) =>
    plans.data?.find(plan => plan.id === id)?.name ?? id;
  const busy = approve.isPending || reject.isPending;

  return (
    <section className="space-y-4">
      <label className="admin-billing-filter">
        الحالة:
        <select
          value={status}
          onChange={event => setStatus(event.target.value as RequestStatus)}
        >
          {(["pending", "approved", "rejected", "cancelled"] as const).map(
            value => (
              <option key={value} value={value}>
                {PAYMENT_STATUS_AR[value]}
              </option>
            )
          )}
        </select>
      </label>
      {(approve.error || reject.error) && (
        <p className="billing-error" role="alert">
          {(approve.error ?? reject.error)?.message}
        </p>
      )}
      {requests.isLoading ? (
        <Loader2 className="animate-spin" size={20} />
      ) : !requests.data?.length ? (
        <p className="text-sm text-muted-foreground">لا توجد طلبات.</p>
      ) : (
        <ul className="admin-billing-list">
          {requests.data.map(request => (
            <li key={request.id} className="admin-billing-request">
              <div className="admin-billing-request-head">
                <div>
                  <Link
                    href={`/admin/billing/${request.userId}`}
                    className="font-semibold hover:underline"
                  >
                    {request.userName || "بدون اسم"}
                  </Link>
                  <div className="text-xs text-muted-foreground" dir="ltr">
                    {request.userEmail ?? request.userPhone ?? ""}
                    {request.username ? ` · @${request.username}` : ""}
                  </div>
                </div>
                <PlanBadge
                  planId={request.planId}
                  name={planName(request.planId)}
                />
              </div>
              <dl className="admin-billing-request-grid">
                <div>
                  <dt>المبلغ</dt>
                  <dd dir="ltr">
                    {formatPrice(request.amountCents, request.currency)}
                  </dd>
                </div>
                <div>
                  <dt>المدة</dt>
                  <dd>{request.durationMonths} شهر</dd>
                </div>
                <div>
                  <dt>طريقة الدفع</dt>
                  <dd>{request.paymentMethod}</dd>
                </div>
                <div>
                  <dt>المرجع</dt>
                  <dd dir="auto">{request.reference || "—"}</dd>
                </div>
                <div>
                  <dt>التاريخ</dt>
                  <dd>{formatDateAr(request.createdAt)}</dd>
                </div>
                <div>
                  <dt>الحالة</dt>
                  <dd>{PAYMENT_STATUS_AR[request.status]}</dd>
                </div>
              </dl>
              {request.proofUrl && (
                <a
                  href={request.proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline"
                >
                  إثبات الدفع
                </a>
              )}
              {request.note && (
                <p className="text-sm" dir="auto">
                  ملاحظة الطالب: {request.note}
                </p>
              )}
              {request.adminNote && (
                <p className="text-sm text-muted-foreground" dir="auto">
                  ملاحظة الأدمن: {request.adminNote}
                </p>
              )}
              {request.status === "pending" && (
                <div className="admin-billing-actions">
                  <Input
                    placeholder="ملاحظة (اختياري، تظهر للطالب)"
                    value={notes[request.id] ?? ""}
                    onChange={event =>
                      setNotes(current => ({
                        ...current,
                        [request.id]: event.target.value,
                      }))
                    }
                  />
                  <Button
                    disabled={busy}
                    onClick={() =>
                      approve.mutate({
                        requestId: request.id,
                        adminNote: notes[request.id] || undefined,
                      })
                    }
                  >
                    <CheckCircle2 size={15} /> موافقة وتفعيل
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      reject.mutate({
                        requestId: request.id,
                        adminNote: notes[request.id] || undefined,
                      })
                    }
                  >
                    <XCircle size={15} /> رفض
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SubscribersTab() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const users = trpc.adminBilling.users.useQuery({
    search: query || undefined,
  });
  const plans = trpc.adminBilling.plans.useQuery();
  const planName = (id: string) =>
    plans.data?.find(plan => plan.id === id)?.name ?? id;

  return (
    <section className="space-y-4">
      <div className="admin-billing-search">
        <Search size={16} aria-hidden="true" />
        <Input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="ابحث بالاسم أو البريد أو الهاتف أو اسم المستخدم"
          aria-label="بحث"
        />
      </div>
      {users.isLoading ? (
        <Loader2 className="animate-spin" size={20} />
      ) : !users.data?.length ? (
        <p className="text-sm text-muted-foreground">لا يوجد مستخدمون.</p>
      ) : (
        <div className="admin-billing-table">
          <table>
            <thead>
              <tr>
                <th>المستخدم</th>
                <th>الباقة</th>
                <th>ينتهي</th>
                <th>اليوم (AI / ملفات / أسئلة)</th>
                <th>الشهر (ملفات / أسئلة)</th>
              </tr>
            </thead>
            <tbody>
              {users.data.map(user => {
                const planId = user.planId ?? "free";
                return (
                  <tr key={user.id}>
                    <td>
                      <Link
                        href={`/admin/billing/${user.id}`}
                        className="font-medium hover:underline"
                      >
                        {user.name || "بدون اسم"}
                      </Link>
                      <div className="text-xs text-muted-foreground" dir="ltr">
                        {user.email ?? user.phone ?? ""}
                      </div>
                    </td>
                    <td>
                      <PlanBadge planId={planId} name={planName(planId)} />
                      {user.status && (
                        <div className="text-xs text-muted-foreground">
                          {SUBSCRIPTION_STATUS_AR[user.status]}
                        </div>
                      )}
                    </td>
                    <td>{user.endDate ? formatDateAr(user.endDate) : "—"}</td>
                    <td dir="ltr">
                      {user.assistantToday ?? 0} / {user.booksToday ?? 0} /{" "}
                      {user.questionsToday ?? 0}
                    </td>
                    <td dir="ltr">
                      {user.booksMonth ?? 0} / {user.questionsMonth ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PlansTab() {
  const plans = trpc.adminBilling.plans.useQuery();
  return (
    <section className="space-y-6">
      {plans.isLoading && <Loader2 className="animate-spin" size={20} />}
      {plans.data?.map(plan => (
        <PlanEditor key={plan.id} plan={plan} />
      ))}
      <SettingsEditor />
    </section>
  );
}

function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

type NumberKey =
  | "assistantDailyLimit"
  | "questionsDailyLimit"
  | "booksDailyLimit"
  | "maxFileSizeMb"
  | "processingConcurrency";
type NullableKey =
  | "assistantTokenDailyLimit"
  | "questionsMonthlyLimit"
  | "booksMonthlyLimit";

function PlanEditor({ plan }: { plan: PlanConfig }) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<PlanConfig>(plan);
  const [priceUsd, setPriceUsd] = useState(
    String(plan.priceMonthlyCents / 100)
  );
  const save = trpc.adminBilling.updatePlan.useMutation({
    onSuccess: () => {
      utils.adminBilling.plans.invalidate();
      utils.billing.plans.invalidate();
    },
  });
  const set = <K extends keyof PlanConfig>(key: K, value: PlanConfig[K]) =>
    setDraft(current => ({ ...current, [key]: value }));
  const numberField = (key: NumberKey, label: string) => (
    <label className="admin-plan-field">
      <span>{label}</span>
      <Input
        type="number"
        min={0}
        value={draft[key]}
        onChange={event => set(key, Number(event.target.value))}
      />
    </label>
  );
  const nullableField = (key: NullableKey, label: string) => (
    <label className="admin-plan-field">
      <span>{label}</span>
      <Input
        type="number"
        min={0}
        placeholder="بدون حد"
        value={draft[key] ?? ""}
        onChange={event => set(key, numberOrNull(event.target.value))}
      />
    </label>
  );

  return (
    <form
      className="admin-plan-editor"
      onSubmit={event => {
        event.preventDefault();
        const cents = Math.round(Number(priceUsd) * 100);
        save.mutate({
          id: plan.id,
          name: draft.name,
          tagline: draft.tagline,
          description: draft.description,
          priceMonthlyCents: Number.isFinite(cents) && cents >= 0 ? cents : 0,
          priceYearlyCents: draft.priceYearlyCents,
          assistantDailyLimit: draft.assistantDailyLimit,
          assistantTokenDailyLimit: draft.assistantTokenDailyLimit,
          questionsDailyLimit: draft.questionsDailyLimit,
          questionsMonthlyLimit: draft.questionsMonthlyLimit,
          booksDailyLimit: draft.booksDailyLimit,
          booksMonthlyLimit: draft.booksMonthlyLimit,
          maxFileSizeMb: draft.maxFileSizeMb,
          processingConcurrency: draft.processingConcurrency,
          features: Object.fromEntries(
            FEATURES.map(feature => [feature, draft.features[feature] === true])
          ) as Record<Feature, boolean>,
          highlighted: draft.highlighted,
          active: draft.active,
        });
      }}
    >
      <div className="admin-plan-head">
        <PlanBadge planId={plan.id} name={draft.name} />
        <label className="admin-plan-toggle">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={event => set("active", event.target.checked)}
          />
          معروضة للبيع
        </label>
        <label className="admin-plan-toggle">
          <input
            type="checkbox"
            checked={draft.highlighted}
            onChange={event => set("highlighted", event.target.checked)}
          />
          «الأكثر استخدامًا»
        </label>
      </div>
      <div className="admin-plan-grid">
        <label className="admin-plan-field">
          <span>الاسم</span>
          <Input
            value={draft.name}
            onChange={event => set("name", event.target.value)}
          />
        </label>
        <label className="admin-plan-field">
          <span>السطر القصير</span>
          <Input
            value={draft.tagline}
            onChange={event => set("tagline", event.target.value)}
          />
        </label>
        <label className="admin-plan-field is-wide">
          <span>الوصف</span>
          <Input
            value={draft.description}
            onChange={event => set("description", event.target.value)}
          />
        </label>
        <label className="admin-plan-field">
          <span>السعر الشهري (USD)</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={priceUsd}
            onChange={event => setPriceUsd(event.target.value)}
          />
        </label>
        {numberField("assistantDailyLimit", "رسائل المساعد / يوم")}
        {nullableField("assistantTokenDailyLimit", "حد التوكنات / يوم")}
        {numberField("booksDailyLimit", "ملفات / يوم")}
        {nullableField("booksMonthlyLimit", "ملفات / شهر")}
        {numberField("questionsDailyLimit", "ملفات أسئلة / يوم")}
        {nullableField("questionsMonthlyLimit", "ملفات أسئلة / شهر")}
        {numberField("maxFileSizeMb", "أقصى حجم (MB)")}
        {numberField("processingConcurrency", "ملفات تُعالج بالتوازي")}
      </div>
      <fieldset className="admin-plan-features">
        <legend>الميزات</legend>
        {FEATURES.map(feature => (
          <label key={feature}>
            <input
              type="checkbox"
              checked={draft.features[feature] === true}
              onChange={event =>
                set("features", {
                  ...draft.features,
                  [feature]: event.target.checked,
                })
              }
            />
            {FEATURE_LABELS_AR[feature]}
          </label>
        ))}
      </fieldset>
      {save.error && (
        <p className="billing-error" role="alert">
          {save.error.message}
        </p>
      )}
      <Button type="submit" disabled={save.isPending}>
        {save.isPending
          ? "جاري الحفظ…"
          : save.isSuccess
            ? "تم الحفظ ✓"
            : "حفظ الباقة"}
      </Button>
    </form>
  );
}

type SettingsDraft = {
  paymentInstructions: string;
  supportLabel: string;
  supportUrl: string;
  methods: string;
  rates: string;
};

function SettingsEditor() {
  const utils = trpc.useUtils();
  const settings = trpc.adminBilling.settings.useQuery();
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  useEffect(() => {
    if (!settings.data || draft) return;
    setDraft({
      paymentInstructions: settings.data.paymentInstructions,
      supportLabel: settings.data.supportContact.label,
      supportUrl: settings.data.supportContact.url,
      methods: settings.data.paymentMethods.join("\n"),
      rates: Object.entries(settings.data.currencyRates)
        .map(([code, rate]) => `${code}=${rate}`)
        .join("\n"),
    });
  }, [settings.data, draft]);
  const save = trpc.adminBilling.updateSettings.useMutation({
    onSuccess: () => {
      utils.adminBilling.settings.invalidate();
      utils.billing.plans.invalidate();
    },
  });
  if (!draft) return null;

  return (
    <form
      className="admin-plan-editor"
      onSubmit={event => {
        event.preventDefault();
        const currencyRates = Object.fromEntries(
          draft.rates
            .split(/\n/)
            .map(line => line.split("=").map(part => part.trim()))
            .filter(
              ([code, rate]) =>
                /^[A-Z]{3}$/.test(code ?? "") && Number(rate) > 0
            )
            .map(([code, rate]) => [code, Number(rate)])
        );
        save.mutate({
          paymentInstructions: draft.paymentInstructions,
          supportContact: { label: draft.supportLabel, url: draft.supportUrl },
          paymentMethods: draft.methods
            .split(/\n/)
            .map(line => line.trim())
            .filter(Boolean),
          currencyRates,
        });
      }}
    >
      <h2 className="text-lg font-semibold">إعدادات الدفع</h2>
      <label className="admin-plan-field is-wide">
        <span>تعليمات الدفع (تظهر للطالب عند الترقية)</span>
        <textarea
          rows={4}
          value={draft.paymentInstructions}
          onChange={event =>
            setDraft({ ...draft, paymentInstructions: event.target.value })
          }
        />
      </label>
      <div className="admin-plan-grid">
        <label className="admin-plan-field">
          <span>نص زر التواصل</span>
          <Input
            value={draft.supportLabel}
            onChange={event =>
              setDraft({ ...draft, supportLabel: event.target.value })
            }
          />
        </label>
        <label className="admin-plan-field">
          <span>رابط التواصل (واتساب / بريد)</span>
          <Input
            dir="ltr"
            placeholder="https://wa.me/9627… أو mailto:…"
            value={draft.supportUrl}
            onChange={event =>
              setDraft({ ...draft, supportUrl: event.target.value })
            }
          />
        </label>
      </div>
      <div className="admin-plan-grid">
        <label className="admin-plan-field">
          <span>طرق الدفع (سطر لكل طريقة)</span>
          <textarea
            rows={4}
            value={draft.methods}
            onChange={event =>
              setDraft({ ...draft, methods: event.target.value })
            }
          />
        </label>
        <label className="admin-plan-field">
          <span>أسعار العملات للعرض (مثال JOD=0.709)</span>
          <textarea
            rows={4}
            dir="ltr"
            value={draft.rates}
            onChange={event =>
              setDraft({ ...draft, rates: event.target.value })
            }
          />
        </label>
      </div>
      {save.error && (
        <p className="billing-error" role="alert">
          {save.error.message}
        </p>
      )}
      <Button type="submit" disabled={save.isPending}>
        {save.isPending
          ? "جاري الحفظ…"
          : save.isSuccess
            ? "تم الحفظ ✓"
            : "حفظ الإعدادات"}
      </Button>
    </form>
  );
}
