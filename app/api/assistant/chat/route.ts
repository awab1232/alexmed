import { auth } from "@/lib/auth";
import { streamFastAnswer } from "@/lib/fast-answer-stream";
import {
  buildGeneralAssistantMessages,
  MAX_HISTORY_TURNS,
} from "@/lib/general-assistant";
import { allowSelectionAssistantRequest } from "@/lib/selection-assistant";
import { NextResponse } from "next/server";
import { z } from "zod";

// The general مساعد AI chat (app/assistant/page.tsx): any question, friendly
// tone with emojis, streamed as plain text from the fast text model (with
// the regular chain as fallback) so the reply starts showing within seconds.
export const maxDuration = 120;

const bodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      })
    )
    .max(MAX_HISTORY_TURNS)
    .default([]),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "الرجاء تسجيل الدخول أولاً." },
      { status: 401 }
    );
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  // Same per-user budget as the PDF assistant, tracked separately.
  if (!allowSelectionAssistantRequest(`general:${session.user.id}`)) {
    return NextResponse.json(
      {
        error:
          "أسئلة كثيرة خلال وقت قصير، خذ استراحة صغيرة ☕ وارجع بعد دقائق.",
      },
      { status: 429 }
    );
  }
  const messages = buildGeneralAssistantMessages({
    studentName: session.user.name?.split(" ")[0],
    history: parsed.data.history,
    message: parsed.data.message,
  });
  return streamFastAnswer(messages, {
    logTag: "assistant-chat",
    maxTokens: 3000,
  });
}
