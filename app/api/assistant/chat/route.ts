import { auth } from "@/lib/auth";
import { streamFastAnswer } from "@/lib/fast-answer-stream";
import {
  buildGeneralAssistantMessages,
  isValidImageDataUrl,
  MAX_HISTORY_TURNS,
  MAX_IMAGE_DATA_URL_LENGTH,
} from "@/lib/general-assistant";
import { DEFAULT_VISION_MODEL } from "@/lib/llm";
import { allowSelectionAssistantRequest } from "@/lib/selection-assistant";
import { NextResponse } from "next/server";
import { z } from "zod";

// The general مساعد AI chat (app/assistant/page.tsx): an open, ChatGPT-style
// assistant for any question, optionally with a photo the student uploads.
// Streamed as plain text so the reply starts showing within seconds: the
// fast text model for text, the vision model when a photo is involved (with
// the regular chain as fallback either way).
export const maxDuration = 120;

const imageField = z
  .string()
  .max(MAX_IMAGE_DATA_URL_LENGTH)
  .refine(isValidImageDataUrl, "صورة غير صالحة.");

const bodySchema = z
  .object({
    message: z.string().trim().max(4000).default(""),
    image: imageField.optional(),
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().max(8000),
          image: imageField.optional(),
        })
      )
      .max(MAX_HISTORY_TURNS)
      .default([]),
  })
  .refine(body => body.message.length > 0 || !!body.image, {
    message: "اكتب سؤالك أو أرفق صورة.",
  })
  // The client only re-sends the latest earlier photo.
  .refine(body => body.history.filter(turn => turn.image).length <= 1, {
    message: "صور كثيرة في طلب واحد.",
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
    const imageIssue = parsed.error.issues.find(issue =>
      issue.path.includes("image")
    );
    return NextResponse.json(
      {
        error: imageIssue
          ? "تعذر قراءة الصورة — جرّب صورة JPG أو PNG أصغر."
          : (parsed.error.issues[0]?.message ?? "طلب غير صالح."),
      },
      { status: 400 }
    );
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
  const { message, image, history } = parsed.data;
  const hasImage = !!image || history.some(turn => turn.image);
  const messages = buildGeneralAssistantMessages({
    studentName: session.user.name?.split(" ")[0],
    history,
    message,
    image,
  });
  return streamFastAnswer(messages, {
    logTag: "assistant-chat",
    maxTokens: 4000,
    ...(hasImage ? { model: DEFAULT_VISION_MODEL } : {}),
  });
}
