import { createContext } from "@/lib/trpc/context";
import { appRouter } from "@/lib/trpc/router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

const handler = (request: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext,
    // The client only sees a generic message for unexpected failures
    // (lib/trpc/trpc.ts's errorFormatter) — keep the real one in the logs.
    onError({ error, path }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error(`[tRPC] ${path ?? "?"} failed`, error.cause ?? error);
      }
    },
  });

export { handler as GET, handler as POST };
