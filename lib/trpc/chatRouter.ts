import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  appendChatMessage,
  createCardFromChatMessage,
  createNoteFromChatMessage,
  getChatSessionForUser,
  getOrCreateChatSession,
  listChatMessages,
  type ChatTarget,
} from "../db-chat";
import { invokeLLM } from "../llm";
import {
  assertChatMessageAllowed,
  ChatRateLimitedError,
} from "../queue/rateLimit";
import { citedPagesOf, prepareStudyChatTurn } from "../study-chat";
import { protectedProcedure, router } from "./trpc";

export const NO_ANSWER_MESSAGE_AR =
  "لم يصل رد من المساعد، حاول مرة أخرى 🙏";

const targetSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("page"), pageId: z.string() }),
  z.object({ scope: z.literal("chapter"), chapterId: z.string() }),
  z.object({ scope: z.literal("book"), bookId: z.string() }),
  z.object({ scope: z.literal("subject"), subjectId: z.string() }),
]);

export const chatRouter = router({
  getOrCreateSession: protectedProcedure
    .input(targetSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await getOrCreateChatSession(
        ctx.user.id,
        input as ChatTarget
      );
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Target not found" });
      }
      return session;
    }),

  listMessages: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      return listChatMessages(ctx.user.id, input.sessionId);
    }),

  // The core study-chat call (whole answer at once; the study sheets use the
  // streamed twin, app/api/chat/stream/route.ts — same lib/study-chat.ts).
  ask: protectedProcedure
    .input(
      z.object({ sessionId: z.string(), question: z.string().min(1).max(2000) })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await assertChatMessageAllowed(ctx.user.id);
      } catch (error) {
        if (error instanceof ChatRateLimitedError) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: error.message,
          });
        }
        throw error;
      }

      const session = await getChatSessionForUser(ctx.user.id, input.sessionId);
      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      const userMessage = await appendChatMessage(session.id, {
        role: "user",
        content: input.question,
      });

      // Always answers: the file's overview + best-matching pages ground it
      // when they're relevant, and the model's own knowledge (marked as
      // outside the file) covers the rest — see lib/rag.ts's prompt.
      const { messages, chunks } = await prepareStudyChatTurn(
        ctx.user.id,
        session,
        input.question
      );
      const response = await invokeLLM({ messages, max_tokens: 2500 });
      const answer =
        response.choices[0]?.message.content?.trim() || NO_ANSWER_MESSAGE_AR;
      const assistantMessage = await appendChatMessage(session.id, {
        role: "assistant",
        content: answer,
        citedPages: citedPagesOf(chunks),
      });

      return { userMessage, assistantMessage };
    }),

  createNoteFromMessage: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const note = await createNoteFromChatMessage(
        ctx.user.id,
        input.messageId
      );
      if (!note) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot create a note from this message",
        });
      }
      return note;
    }),

  createCardFromMessage: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const card = await createCardFromChatMessage(
        ctx.user.id,
        input.messageId
      );
      if (!card) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot create a card from this message",
        });
      }
      return card;
    }),
});
