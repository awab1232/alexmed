"use client";

// 💳 What each plan card's button does, for /pricing and /account/plan:
// signed out → sign up; current plan → "your plan"; a paid plan → the
// manual upgrade dialog (or "request under review" while one is pending).
import { useState, type ReactNode } from "react";
import type { PlanConfig } from "@/lib/billing/catalog";
import type { PlanCardAction } from "./PlanCards";
import UpgradeDialog from "./UpgradeDialog";

type Catalog = {
  plans: PlanConfig[];
  currencyRates: Record<string, number>;
  paymentMethods: string[];
  paymentInstructions: string;
  supportContact: { label: string; url: string };
};

export function usePlanActions(input: {
  catalog: Catalog | undefined;
  signedIn: boolean;
  currentPlanId: string | null;
  pendingPlanId: string | null;
  country: string | null;
}): { actionFor: (plan: PlanConfig) => PlanCardAction; dialog: ReactNode } {
  const [upgrading, setUpgrading] = useState<PlanConfig | null>(null);
  const current = input.catalog?.plans.find(p => p.id === input.currentPlanId);

  function actionFor(plan: PlanConfig): PlanCardAction {
    const paid = plan.priceMonthlyCents > 0;
    if (!input.signedIn) {
      return {
        kind: "link",
        href: "/register",
        label: paid ? `ابدأ ثم رقِّ إلى ${plan.name}` : "ابدأ مجانًا",
      };
    }
    if (plan.id === input.currentPlanId) {
      return { kind: "current", label: "✓ باقتك الحالية" };
    }
    if (!paid) return { kind: "none" };
    if (input.pendingPlanId) {
      return {
        kind: "current",
        label:
          input.pendingPlanId === plan.id
            ? "طلبك قيد المراجعة"
            : "لديك طلب قيد المراجعة",
      };
    }
    const isUpgrade = !current || plan.sortOrder > current.sortOrder;
    return {
      kind: "button",
      label: isUpgrade
        ? `الترقية إلى ${plan.name}`
        : `التغيير إلى ${plan.name}`,
      onClick: () => setUpgrading(plan),
    };
  }

  const dialog =
    upgrading && input.catalog ? (
      <UpgradeDialog
        plan={upgrading}
        country={input.country}
        currencyRates={input.catalog.currencyRates}
        paymentMethods={input.catalog.paymentMethods}
        paymentInstructions={input.catalog.paymentInstructions}
        supportContact={input.catalog.supportContact}
        onClose={() => setUpgrading(null)}
      />
    ) : null;

  return { actionFor, dialog };
}
