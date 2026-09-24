import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createExamFocusDeck,
  deleteExamFocusDeckForUser,
  findStalledExamFocusWork,
  getBookForExamFocus,
  getBookPagesForExamFocus,
  getExamFocusDeckForUser,
  listExamFocusCardsForUser,
  resetFailedExamFocusUnits,
  setExamFocusCardBookmark,
} from "../db-exam-focus";
import { planExamFocusUnits, withVisualDescriptions } from "../exam-focus";
import { EXAM_FOCUS_CATEGORIES } from "../exam-focus-categories";
import { publishMessage } from "../queue/client";
import { protectedProcedure, router } from "./trpc";

async function publishUnits(deckId: string, unitIds: string[]) {
  // Small waves so a 100-unit textbook doesn't open 100 sockets at once. A
  // publish that fails leaves its unit "pending"; resume re-queues it.
  for (let i = 0; i < unitIds.length; i += 20) {
    await Promise.all(
      unitIds
        .slice(i, i + 20)
        .map(unitId =>
          publishMessage({ type: "extract_exam_focus_unit", unitId, deckId })
        )
    );
  }
}

// Plans the WHOLE file into units and queues every one — or returns the
// existing deck untouched (opening Exam Focus never regenerates).
async function startDeck(userId: string, bookId: string) {
  const book = await getBookForExamFocus(userId, bookId);
  if (!book) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
  }
  if (book.sourceType === "question_file") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Exam Focus متاح لملفات الدراسة فقط.",
    });
  }
  if (book.status === "extracting" || book.status === "pending") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "الملف ما زال قيد القراءة — انتظر اكتمال قراءة الصفحات.",
    });
  }
  const { pages, visuals } = await getBookPagesForExamFocus(bookId);
  const units = planExamFocusUnits(withVisualDescriptions(pages, visuals));
  const result = await createExamFocusDeck({
    userId,
    bookId,
    totalPages: book.pageCount || pages.length,
    units,
  });
  if (result.created) await publishUnits(result.deckId, result.unitIds);
  return { created: result.created, units: units.length };
}

export const examFocusRouter = router({
  // Deck status + per-unit progress + filter counts (null = never started).
  get: protectedProcedure
    .input(z.object({ bookId: z.string() }))
    .query(async ({ ctx, input }) => {
      return getExamFocusDeckForUser(ctx.user.id, input.bookId);
    }),

  start: protectedProcedure
    .input(z.object({ bookId: z.string() }))
    .mutation(async ({ ctx, input }) => startDeck(ctx.user.id, input.bookId)),

  // Only on the student's explicit "إعادة التوليد" — drops the old deck
  // (cascade: units + cards) and plans the file again. Old in-flight queue
  // messages then find no unit and are skipped.
  regenerate: protectedProcedure
    .input(z.object({ bookId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const book = await getBookForExamFocus(ctx.user.id, input.bookId);
      if (!book) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
      }
      await deleteExamFocusDeckForUser(ctx.user.id, input.bookId);
      return startDeck(ctx.user.id, input.bookId);
    }),

  // Re-runs ONLY the units that failed (never the whole book).
  retryFailed: protectedProcedure
    .input(z.object({ bookId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const reset = await resetFailedExamFocusUnits(ctx.user.id, input.bookId);
      if (!reset) return { retried: 0 };
      await publishUnits(reset.deckId, reset.unitIds);
      return { retried: reset.unitIds.length };
    }),

  // Safety net the Exam Focus page calls while processing: re-queues units
  // whose message was lost / worker was killed, and a finalize that never
  // ran. Duplicates are harmless (atomic claims).
  resume: protectedProcedure
    .input(z.object({ bookId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const work = await findStalledExamFocusWork(ctx.user.id, input.bookId);
      if (!work) return { resumed: 0, finalize: false };
      await publishUnits(work.deckId, work.stalledUnitIds);
      if (work.needsFinalize) {
        await publishMessage({
          type: "finalize_exam_focus",
          deckId: work.deckId,
        });
      }
      return {
        resumed: work.stalledUnitIds.length,
        finalize: work.needsFinalize,
      };
    }),

  // Paginated, filtered and searched on the server over the whole deck.
  cards: protectedProcedure
    .input(
      z.object({
        bookId: z.string(),
        category: z.enum(EXAM_FOCUS_CATEGORIES).optional(),
        bookmarkedOnly: z.boolean().optional(),
        search: z.string().max(200).optional(),
        cursor: z.number().int().min(0).nullish(),
        limit: z.number().int().min(1).max(100).default(40),
      })
    )
    .query(async ({ ctx, input }) => {
      const offset = input.cursor ?? 0;
      const { items, total } = await listExamFocusCardsForUser({
        userId: ctx.user.id,
        bookId: input.bookId,
        category: input.category,
        bookmarkedOnly: input.bookmarkedOnly,
        search: input.search,
        offset,
        limit: input.limit,
      });
      const next = offset + items.length;
      return { items, total, nextCursor: next < total ? next : null };
    }),

  setBookmark: protectedProcedure
    .input(z.object({ cardId: z.string(), bookmarked: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await setExamFocusCardBookmark(
        ctx.user.id,
        input.cardId,
        input.bookmarked
      );
      if (!ok) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      }
      return { bookmarked: input.bookmarked };
    }),
});
