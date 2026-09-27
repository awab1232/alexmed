// Unexpected server errors must not leak their internals (SQL, table names,
// provider details) to the browser; errors thrown on purpose keep their
// user-facing message.
import { TRPCError } from "@trpc/server";
import { getErrorShape } from "@trpc/server/unstable-core-do-not-import";
import { describe, expect, it } from "vitest";
import { AiRateLimitError } from "../ai/types";
import { INTERNAL_ERROR_MESSAGE, protectedProcedure, router } from "./trpc";

const testRouter = router({
  crash: protectedProcedure.query(() => {
    throw new Error('relation "users" does not exist at character 15');
  }),
  aiBusy: protectedProcedure.query(() => {
    throw new AiRateLimitError("upstream 429 from provider-x/model-y");
  }),
  onPurpose: protectedProcedure.query(() => {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "تعذر بدء المعالجة. حاول مرة أخرى.",
    });
  }),
  notFound: protectedProcedure.query(() => {
    throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
  }),
});

const caller = testRouter.createCaller({
  user: { id: "u1", role: "user" } as never,
});

// createCaller throws the raw TRPCError; the formatter runs when the error
// is serialized for a client, so apply it the same way the HTTP handler does.
async function clientShape(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    const shape = getErrorShape({
      config: testRouter._def._config,
      error: error as TRPCError,
      type: "query",
      path: "x",
      input: undefined,
      ctx: undefined,
    });
    return { message: shape.message, stack: shape.data.stack };
  }
  throw new Error("expected an error");
}

describe("tRPC error formatter", () => {
  it("hides the message of an unexpected exception", async () => {
    const out = await clientShape(() => caller.crash());
    expect(out.message).toBe(INTERNAL_ERROR_MESSAGE);
    expect(out.stack).toBeUndefined();
  });

  it("gives an AI rate limit a friendly message without provider details", async () => {
    const out = await clientShape(() => caller.aiBusy());
    expect(out.message).not.toContain("provider-x");
    expect(out.message).not.toBe(INTERNAL_ERROR_MESSAGE);
  });

  it("keeps messages thrown on purpose", async () => {
    expect((await clientShape(() => caller.onPurpose())).message).toBe(
      "تعذر بدء المعالجة. حاول مرة أخرى."
    );
    expect((await clientShape(() => caller.notFound())).message).toBe(
      "Book not found"
    );
  });
});
