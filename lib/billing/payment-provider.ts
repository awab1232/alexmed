// 💳 Payment providers. The subscription engine (lib/billing/subscriptions.ts)
// never talks to a gateway directly — a provider turns "student wants plan X"
// into a checkout and, once money is confirmed, the engine activates the
// subscription exactly as an approved manual request does. Today only the
// manual provider exists; Stripe / Paymob / a regional gateway would be a
// new class implementing this interface plus a webhook route calling
// handleWebhook() — no change to plans, usage or entitlement.
import type { PlanConfig } from "./catalog";
import { createPaymentRequest } from "./subscriptions";

export type CheckoutInput = {
  userId: string;
  plan: PlanConfig;
  paymentMethod: string;
  reference?: string | null;
  note?: string | null;
};

export type CheckoutResult =
  | { kind: "manual_request"; requestId: string }
  | { kind: "redirect"; url: string };

export type WebhookResult = {
  // Present when the event confirmed a payment for a known checkout.
  confirmed?: {
    userId: string;
    planId: string;
    months: number;
    reference: string;
  };
};

export interface PaymentProvider {
  readonly id: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  verifyPayment(reference: string): Promise<boolean>;
  handleWebhook(request: Request): Promise<WebhookResult>;
  refundPayment(reference: string, amountCents?: number): Promise<void>;
}

// Manual transfer: the "checkout" is a payment request an admin reviews.
// Verification is the admin's approval; there are no webhooks or refunds
// to automate.
export class ManualPaymentProvider implements PaymentProvider {
  readonly id = "manual";

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const request = await createPaymentRequest({
      userId: input.userId,
      planId: input.plan.id,
      paymentMethod: input.paymentMethod,
      reference: input.reference,
      note: input.note,
    });
    return { kind: "manual_request", requestId: request.id };
  }

  async verifyPayment(): Promise<boolean> {
    // Confirmed by an admin in /admin/billing, not by an API.
    return false;
  }

  async handleWebhook(): Promise<WebhookResult> {
    return {};
  }

  async refundPayment(): Promise<void> {
    throw new Error("Manual payments are refunded outside the app.");
  }
}

export function getPaymentProvider(): PaymentProvider {
  return new ManualPaymentProvider();
}
