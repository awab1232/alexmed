// 💳 Plan check for one Niro Assistant message (the bottom-bar assistant,
// the study sheet and the PDF helper all call this). One message is
// consumed when the request is accepted for processing; it's given back if
// no AI model produced an answer, and the answer's size feeds the Free
// plan's daily token safety cap.
import { NextResponse } from "next/server";
import { billingErrorResponse } from "./http";
import {
  consumeUsage,
  estimateTokens,
  recordAssistantTokens,
  releaseUsage,
  type UsageReceipt,
} from "./usage";

export type AdmittedMessage = {
  receipt: UsageReceipt;
  // → streamFastAnswer's onNoAnswer
  refund: () => Promise<void>;
  // → from streamFastAnswer's onComplete
  recordAnswer: (answer: string) => Promise<void>;
};

export async function admitAssistantMessage(
  userId: string
): Promise<AdmittedMessage | NextResponse> {
  try {
    const receipt = await consumeUsage(userId, "ASSISTANT_MESSAGE");
    return {
      receipt,
      refund: () => releaseUsage(receipt),
      recordAnswer: answer =>
        recordAssistantTokens(receipt, estimateTokens(answer)).catch(error =>
          console.error("[Billing] Failed to record assistant tokens", error)
        ),
    };
  } catch (error) {
    const response = billingErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
