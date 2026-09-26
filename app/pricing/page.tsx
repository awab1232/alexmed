"use client";

// 💳 Public pricing page — plans, prices (USD + the student's local
// equivalent) and a short comparison, all from the plans table. Works
// signed out (buttons lead to sign-up) and signed in (the upgrade dialog).
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import NiroSpark from "@/components/niro/NiroSpark";
import PlanCards, { PlanComparison } from "@/components/billing/PlanCards";
import { useDisplayCountry } from "@/components/billing/BillingBits";
import { usePlanActions } from "@/components/billing/usePlanActions";

export default function PricingPage() {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const catalog = trpc.billing.plans.useQuery();
  const mine = trpc.billing.mine.useQuery(undefined, { enabled: signedIn });
  const country = useDisplayCountry(mine.data?.phone);
  const { actionFor, dialog } = usePlanActions({
    catalog: catalog.data,
    signedIn,
    currentPlanId: signedIn ? (mine.data?.plan.id ?? null) : null,
    pendingPlanId: mine.data?.pendingRequest?.planId ?? null,
    country,
  });

  return (
    <div className="pricing-page">
      <header className="pricing-top">
        <Link href={signedIn ? "/account" : "/"} className="pricing-back">
          <ArrowRight size={16} aria-hidden="true" />
          {signedIn ? "حسابي" : "الرئيسية"}
        </Link>
        <span className="pricing-brand" dir="ltr">
          <NiroSpark size={18} /> NiroLearn
        </span>
        {!signedIn && status !== "loading" ? (
          <Link href="/login" className="pricing-login">
            تسجيل الدخول
          </Link>
        ) : (
          <span />
        )}
      </header>

      <section className="pricing-hero">
        <h1>اختر الباقة التي تناسب وتيرة دراستك</h1>
        <p>
          ابدأ مجانًا واستخدم كل أدوات الدراسة، ورقِّ باقتك عندما تحتاج ملفات
          أكثر وأكبر، ومعالجة أسرع، واستخدامًا أعلى لمساعد Niro.
        </p>
      </section>

      {catalog.isLoading ? (
        <div className="pricing-loading" role="status">
          <Loader2 size={24} className="spin" /> جاري تحميل الباقات…
        </div>
      ) : catalog.error || !catalog.data ? (
        <p className="billing-error" role="alert">
          تعذّر تحميل الباقات. حدّث الصفحة وحاول مرة ثانية.
        </p>
      ) : (
        <>
          <PlanCards
            plans={catalog.data.plans}
            country={country}
            currencyRates={catalog.data.currencyRates}
            actionFor={actionFor}
          />
          <p className="pricing-note">
            الأسعار بالدولار الأمريكي، والسعر بعملتك تقريبي للتوضيح فقط. الدفع
            حاليًا يتم يدويًا، وتُفعَّل الباقة بعد تأكيد الدفع.
          </p>

          <section className="pricing-section" aria-labelledby="compare-title">
            <h2 id="compare-title">مقارنة سريعة</h2>
            <PlanComparison plans={catalog.data.plans} />
          </section>

          <section
            className="pricing-section pricing-faq"
            aria-labelledby="faq-title"
          >
            <h2 id="faq-title">أسئلة شائعة</h2>
            <details>
              <summary>ماذا يحدث عند انتهاء اشتراكي؟</summary>
              <p>
                ترجع تلقائيًا إلى الباقة المجانية. ملفاتك وبطاقاتك وملخصاتك وكل
                ما أنشأته يبقى كما هو، وتعود حدود الاستخدام إلى حدود الباقة
                المجانية.
              </p>
            </details>
            <details>
              <summary>هل يتجدد الاشتراك تلقائيًا؟</summary>
              <p>
                لا. الدفع حاليًا يدوي، فلن يُسحب منك أي مبلغ تلقائيًا. عند
                انتهاء المدة تقدر تجدّد بنفس الطريقة.
              </p>
            </details>
            <details>
              <summary>متى يتجدد الاستخدام اليومي؟</summary>
              <p>
                الحدود اليومية تبدأ من جديد كل يوم عند منتصف الليل (بتوقيت
                عمّان)، والحدود الشهرية أول كل شهر.
              </p>
            </details>
          </section>
        </>
      )}
      {dialog}
    </div>
  );
}
