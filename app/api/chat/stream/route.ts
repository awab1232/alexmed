import { auth } from "@/lib/auth";
import { appendChatMessage, getChatSessionForUser } from "@/lib/db-chat";
import { streamFastAnswer } from "@/lib/fast-answer-stream";
import {
  assertChatMessageAllowed,
  ChatRateLimitedError,
} from "@/lib/queue/rateLimit";
import { citedPagesOf, prepareStudyChatTurn } from "@/lib/study-chat";
import { NextResponse } from "next/server";
import { z } from "zod";

// The study sheets' "المساعد الذكي" (components/study/StudyAiSheet.tsx —
// summary, flashcards and quiz modes): the same study chat as chat.ask
// (lib/study-chat.ts — file overview + best-matching pages, answers beyond
// the file too), but streamed so the answer starts showing within seconds.
// The question and the finished answer are saved to the student's own chat
// session, so reopening the sheet shows the conversation.
export const maxDuration = 120;

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  question: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "الرجاء تسجيل الدخول أولاً." },
      { status: 401 }
    );
  }
  const userId = session.user.id;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  try {
    await assertChatMessageAllowed(userId);
  } catch (error) {
    if (error instanceof ChatRateLimitedError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }
  // Only the caller's own session (created after an owner-or-accepted-share
  // check in lib/db-chat.ts's getOrCreateChatSession).
  const chat = await getChatSessionForUser(userId, parsed.data.sessionId);
  if (!chat) {
    return NextResponse.json({ error: "المحادثة غير موجودة." }, { status: 404 });
  }

  await appendChatMessage(chat.id, {
    role: "user",
    content: parsed.data.question,
  });
  const { messages, chunks } = await prepareStudyChatTurn(
    userId,
    chat,
    parsed.data.question
  );
  return streamFastAnswer(messages, {
    logTag: "study-chat",
    maxTokens: 2500,
    onComplete: async answer => {
      if (!answer.trim()) return;
      await appendChatMessage(chat.id, {
        role: "assistant",
        content: answer.trim(),
        citedPages: citedPagesOf(chunks),
      });
    },
  });
}
