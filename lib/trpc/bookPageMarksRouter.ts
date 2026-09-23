import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  MAX_PDF_HIGHLIGHTS,
  MAX_POINTS_PER_STROKE,
  MAX_RECTS_PER_HIGHLIGHT,
} from "../pdf-marks";
import { listBookPageMarks, saveBookPageMarks } from "../db-book-page-marks";
import { protectedProcedure, router } from "./trpc";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const rectInput = z.object({
  x: z.number().min(-1).max(2),
  y: z.number().min(-1).max(2),
  width: z.number().min(0).max(2),
  height: z.number().min(0).max(2),
});

const highlightInput = z.object({
  id: z.string().min(1).max(40),
  color: hexColor,
  rects: z.array(rectInput).min(1).max(MAX_RECTS_PER_HIGHLIGHT),
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

// كتبي's counterpart to cardMarksRouter — same shape, one page's worth of
// تضليل/قلم at a time instead of one card's.
export const bookPageMarksRouter = router({
  // Returns every page's marks for the book in one call (superjson carries
  // the Map through as-is) — the reader shows many pages at once, so a
  // per-page query on open would be an N+1.
  list: protectedProcedure
    .input(z.object({ bookId: z.string() }))
    .query(async ({ ctx, input }) => {
      return listBookPageMarks(ctx.user.id, input.bookId);
    }),

  // Replaces the whole set for one page — same idempotent whole-document
  // write reasoning as cardMarksRouter.save.
  save: protectedProcedure
    .input(
      z.object({
        bookId: z.string(),
        pageNumber: z.number().int().min(1),
        highlights: z.array(highlightInput).max(MAX_PDF_HIGHLIGHTS),
        strokes: z.array(strokeInput).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { bookId, pageNumber, ...marks } = input;
      const ok = await saveBookPageMarks(
        ctx.user.id,
        bookId,
        pageNumber,
        marks
      );
      if (!ok) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
      }
      return { success: true } as const;
    }),
});
