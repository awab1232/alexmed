import { signOut } from "../auth";
import { booksRouter } from "./booksRouter";
import { decksRouter } from "./decksRouter";
import { mirrorRouter } from "./mirrorRouter";
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
  decks: decksRouter,
  books: booksRouter,
  mirror: mirrorRouter,
});

export type AppRouter = typeof appRouter;
