import { auth } from "@/lib/auth";
import {
  acquireInteractiveSlot,
  INTERACTIVE_LIMIT_MESSAGE_AR,
} from "@/lib/ai/interactive-limit";
import { admitAssistantMessage } from "@/lib/billing/assistant-guard";
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
    return NextResponse.json(
      { error: "المحادثة غير موجودة." },
      { status: 404 }
    );
  }

  // Load guard across every replica (lib/ai/interactive-limit.ts) — taken
  // before the quota, so a refusal here costs the student nothing.
  const slot = await acquireInteractiveSlot(userId, "study_chat");
  if (!slot.ok) {
    return NextResponse.json(
      { error: INTERACTIVE_LIMIT_MESSAGE_AR[slot.reason] },
      { status: 429 }
    );
  }

  // 💳 One message from the plan's daily assistant quota — checked before
  // the question is saved, so a refused message leaves no trace.
  const admitted = await admitAssistantMessage(userId);
  if (admitted instanceof NextResponse) {
    await slot.release();
    return admitted;
  }

  let messages: Awaited<ReturnType<typeof prepareStudyChatTurn>>["messages"];
  let chunks: Awaited<ReturnType<typeof prepareStudyChatTurn>>["chunks"];
  try {
    await appendChatMessage(chat.id, {
      role: "user",
      content: parsed.data.question,
    });
    ({ messages, chunks } = await prepareStudyChatTurn(
      userId,
      chat,
      parsed.data.question
    ));
  } catch (error) {
    await slot.release();
    throw error;
  }
  return streamFastAnswer(messages, {
    logTag: "study-chat",
    maxTokens: 2500,
    onSettled: slot.release,
    onNoAnswer: admitted.refund,
    onComplete: async answer => {
      await admitted.recordAnswer(answer);
      if (!answer.trim()) return;
      await appendChatMessage(chat.id, {
        role: "assistant",
        content: answer.trim(),
        citedPages: citedPagesOf(chunks),
      });
    },
  });
}
