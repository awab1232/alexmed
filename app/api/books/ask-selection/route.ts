import { auth } from "@/lib/auth";
import { getBookAccess } from "@/lib/book-access";
import { getBookPageForUser } from "@/lib/db-books";
import { streamFastAnswer } from "@/lib/fast-answer-stream";
import {
  allowSelectionAssistantRequest,
  buildSelectionAssistantMessages,
} from "@/lib/selection-assistant";
import { NextResponse } from "next/server";
import { z } from "zod";

// "اسأل AI" on text selected in the PDF reader
// (components/pdf/SelectionAssistant.tsx). Streams the answer as plain text
// so the student starts reading within seconds instead of waiting for the
// whole reply — the free fast models take ~15-30s to finish an answer
// through OmniRoute, but start writing almost immediately.
//
// Model: FAST_TEXT_MODEL (OMNIROUTE_FAST_TEXT_MODEL, e.g.
// grok-cli/grok-composer-2.5-fast). If it fails before writing anything,
// the same question goes through the regular chain (default model +
// OMNIROUTE_FALLBACK_MODELS) so the student still gets an answer.
export const maxDuration = 120;

const bodySchema = z.object({
  bookId: z.string(),
  pageNumber: z.number().int().positive(),
  // Empty = ask about the whole current page (toolbar button, no selection).
  selectedText: z.string().trim().max(4000).default(""),
  action: z.enum(["explain", "arabic", "exam", "summarize", "ask"]),
  question: z.string().max(1000).optional(),
  fileName: z.string().max(200).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(6000),
      })
    )
    .max(12)
    .optional(),
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
  const input = parsed.data;
  if (!allowSelectionAssistantRequest(session.user.id)) {
    return NextResponse.json(
      { error: "أسئلة كثيرة خلال وقت قصير، حاول بعد دقائق." },
      { status: 429 }
    );
  }
  // Access: the page must belong to a book this user owns or holds an
  // accepted share of (lib/book-access.ts).
  const access = await getBookAccess(session.user.id, input.bookId);
  const found = access
    ? await getBookPageForUser(access.ownerId, input.bookId, input.pageNumber)
    : null;
  if (!found) {
    return NextResponse.json({ error: "الصفحة غير موجودة." }, { status: 404 });
  }

  const messages = buildSelectionAssistantMessages({
    fileName: input.fileName ?? "PDF",
    pageNumber: input.pageNumber,
    pageText: found.page.extractedText ?? "",
    selectedText: input.selectedText,
    action: input.action,
    question: input.question,
    history: input.history,
  });

  return streamFastAnswer(messages, { logTag: "ask-selection" });
}
