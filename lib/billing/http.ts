// Turns billing errors into the API's structured error shape — REST routes
// return { error, code, details } with a 429/413/403/409 status; tRPC
// procedures throw a TRPCError whose `cause` is the BillingError (surfaced
// to the client by the error formatter as `data.billing`).
import { TRPCError } from "@trpc/server";
import { NextResponse } from "next/server";
import { BillingError } from "./usage";
import { SubscriptionError } from "./subscriptions";

const STATUS: Record<BillingError["code"], number> = {
  PLAN_LIMIT_REACHED: 429,
  MONTHLY_LIMIT_REACHED: 429,
  FILE_SIZE_LIMIT: 413,
  FEATURE_NOT_AVAILABLE: 403,
  SUBSCRIPTION_EXPIRED: 402,
  PAYMENT_REQUEST_PENDING: 409,
};

export function billingErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof BillingError)) return null;
  return NextResponse.json(
    { error: error.message, code: error.code, details: error.details },
    { status: STATUS[error.code] }
  );
}

export function toTrpcError(error: unknown): never {
  if (error instanceof BillingError) {
    throw new TRPCError({
      code:
        error.code === "FEATURE_NOT_AVAILABLE"
          ? "FORBIDDEN"
          : error.code === "PAYMENT_REQUEST_PENDING"
            ? "CONFLICT"
            : "TOO_MANY_REQUESTS",
      message: error.message,
      cause: error,
    });
  }
  if (error instanceof SubscriptionError) {
    throw new TRPCError({
      code:
        error.reason === "PLAN_NOT_FOUND"
          ? "NOT_FOUND"
          : error.reason === "INVALID_DURATION"
            ? "BAD_REQUEST"
            : "CONFLICT",
      message: error.message,
      cause: error,
    });
  }
  throw error;
}
