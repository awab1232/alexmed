// 💳 Plan checks for a file a student asks to process (books, question
// files, مِرآة). Called by the *-and-plan routes after the request is
// validated and before anything is created:
//   1. the uploaded object's REAL size (storage HEAD) vs the plan maximum,
//   2. one unit of the daily / monthly quota, consumed atomically.
// The route calls `release()` if it then fails to start processing, so a
// failed upload never costs the student a file.
import { NextResponse } from "next/server";
import { storageObjectSize } from "../storage";
import type { Resource } from "./catalog";
import { billingErrorResponse } from "./http";
import {
  assertFileSizeAllowed,
  consumeUsage,
  releaseUsage,
  type UsageReceipt,
} from "./usage";

export type AdmittedUpload = {
  receipt: UsageReceipt;
  release: () => Promise<void>;
};

export async function admitUpload(
  userId: string,
  key: string,
  resource: Extract<Resource, "BOOK_FILE" | "QUESTION_FILE">
): Promise<AdmittedUpload | NextResponse> {
  const size = await storageObjectSize(key);
  if (size === null) {
    return NextResponse.json(
      { error: "لم يكتمل رفع الملف. ارفعه مرة ثانية." },
      { status: 400 }
    );
  }
  try {
    await assertFileSizeAllowed(userId, size);
    const receipt = await consumeUsage(userId, resource);
    return {
      receipt,
      release: () =>
        releaseUsage(receipt).catch(error =>
          console.error("[Billing] Failed to release usage", error)
        ),
    };
  } catch (error) {
    const response = billingErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
