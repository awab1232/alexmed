import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  MARK_FIELDS,
  MAX_HIGHLIGHTS,
  MAX_POINTS_PER_STROKE,
  MAX_STROKES,
} from "../card-marks";
import { getCardMarks, saveCardMarks } from "../db-card-marks";
import { protectedProcedure, router } from "./trpc";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const highlightInput = z.object({
  id: z.string().min(1).max(40),
  field: z.enum(MARK_FIELDS),
  start: z.number().int().min(0).max(100_000),
  end: z.number().int().min(0).max(100_000),
  color: hexColor,
});

const strokeInput = z.object({
  id: z.string().min(1).max(40),
  color: hexColor,
  width: z.number().min(0.0005).max(0.05),
  points: z
    .array(z.tuple([z.number().min(-1).max(10), z.number().min(-1).max(100)]))
    .min(1)
    .max(MAX_POINTS_PER_STROKE),
});

export const cardMarksRouter = router({
  get: protectedProcedure
    .input(z.object({ cardId: z.string() }))
    .query(async ({ ctx, input }) => {
      return getCardMarks(ctx.user.id, input.cardId);
    }),

  // Replaces the whole set for one card — the client edits highlights and
  // strokes as a unit and debounces its saves, so a whole-document write is
  // simpler and idempotent compared to per-mark create/delete calls.
  save: protectedProcedure
    .input(
      z.object({
        cardId: z.string(),
        highlights: z.array(highlightInput).max(MAX_HIGHLIGHTS),
        strokes: z.array(strokeInput).max(MAX_STROKES),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { cardId, ...marks } = input;
      const ok = await saveCardMarks(ctx.user.id, cardId, marks);
      if (!ok) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      }
      return { success: true } as const;
    }),
});
