import { signOut } from "../auth";
import { publicProcedure, router } from "./trpc";
import { systemRouter } from "./systemRouter";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(async () => {
      await signOut({ redirect: false });
      return { success: true } as const;
    }),
  }),

  // TODO: add feature routers here (decks, cards) in a later wave.
});

export type AppRouter = typeof appRouter;
