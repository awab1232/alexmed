import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  deleteBook,
  getBookForUser,
  getBookStatsForUser,
  getChapterContentForUser,
  getDueCardsForUser,
  listBooksForUser,
  listMcqsForUser,
  rateBookCard,
  submitMcqAttemptForUser,
} from "../db-books";
import { protectedProcedure, router } from "./trpc";

export const booksRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listBooksForUser(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await getBookForUser(ctx.user.id, input.id);
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
      }
      return result;
    }),

  getChapter: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await getChapterContentForUser(ctx.user.id, input.id);
      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chapter not found",
        });
      }
      return result;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await deleteBook(ctx.user.id, input.id);
      if (!ok) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
      }
      return { success: true } as const;
    }),

  dueCards: protectedProcedure.query(async ({ ctx }) => {
    return getDueCardsForUser(ctx.user.id);
  }),

  rateCard: protectedProcedure
    .input(
      z.object({
        cardId: z.string(),
        rating: z.enum(["hard", "good", "easy"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await rateBookCard(
        ctx.user.id,
        input.cardId,
        input.rating
      );
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      }
      return result;
    }),

  listMcqs: protectedProcedure.query(async ({ ctx }) => {
    return listMcqsForUser(ctx.user.id);
  }),

  submitMcqAttempt: protectedProcedure
    .input(z.object({ mcqId: z.string(), selectedIndex: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const result = await submitMcqAttemptForUser(
        ctx.user.id,
        input.mcqId,
        input.selectedIndex
      );
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "MCQ not found" });
      }
      return result;
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    return getBookStatsForUser(ctx.user.id);
  }),
});
