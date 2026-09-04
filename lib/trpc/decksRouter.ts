import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createDeckWithCards,
  deleteDeck,
  getDeckWithCards,
  listDecksForUser,
} from "../db";
import { protectedProcedure, router } from "./trpc";

const cardInput = z.object({
  question: z.string(),
  questionArabic: z.string(),
  answer: z.string(),
  answerArabic: z.string(),
  explanation: z.string(),
  explanationArabic: z.string(),
  keyIdea: z.string(),
  keyIdeaArabic: z.string(),
  keyword: z.string(),
  keywordArabic: z.string(),
  sourcePage: z.number().int(),
  status: z.enum(["complete", "needs_review"]),
  confidence: z.enum(["high", "medium", "low"]),
});

export const decksRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listDecksForUser(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await getDeckWithCards(ctx.user.id, input.id);
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deck not found" });
      }
      return result;
    }),

  create: protectedProcedure
    .input(
      z.object({
        fileName: z.string().min(1),
        fileKey: z.string().optional(),
        pageCount: z.number().int().min(0),
        depth: z.string(),
        cards: z.array(cardInput).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const deck = await createDeckWithCards(ctx.user.id, input);
      return { id: deck.id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await deleteDeck(ctx.user.id, input.id);
      if (!ok) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deck not found" });
      }
      return { success: true } as const;
    }),
});
