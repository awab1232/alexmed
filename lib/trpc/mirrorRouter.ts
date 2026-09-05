import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  deleteMirrorJob,
  getMirrorJobForUser,
  listMirrorJobsForUser,
} from "../db-mirror";
import { protectedProcedure, router } from "./trpc";

export const mirrorRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listMirrorJobsForUser(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await getMirrorJobForUser(ctx.user.id, input.id);
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      }
      return result;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await deleteMirrorJob(ctx.user.id, input.id);
      if (!ok) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      }
      return { success: true } as const;
    }),
});
