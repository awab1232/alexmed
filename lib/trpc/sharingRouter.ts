import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createShareRequest,
  getSharingHomeSummary,
  getSharingProfile,
  listBlockedUsers,
  listIncomingRequests,
  listNotifications,
  listSharedWithMe,
  listSharesForBook,
  markNotificationsRead,
  removeSharedFromLibrary,
  respondToShare,
  revokeShare,
  searchStudents,
  setUsername,
  SharingError,
  unblockUser,
} from "../db-sharing";
import { protectedProcedure, router } from "./trpc";

// 📤 Study Pack sharing. Every procedure derives "who" from the session
// (ctx.user.id) — the client never supplies an owner or recipient identity
// for authorization, only the ids of the things it's acting on, which the
// data layer re-checks against the caller.
const CODE_MAP = {
  NOT_FOUND: "NOT_FOUND",
  SELF_SHARE: "BAD_REQUEST",
  ALREADY_PENDING: "CONFLICT",
  ALREADY_SHARED: "CONFLICT",
  RECENTLY_DECLINED: "TOO_MANY_REQUESTS",
  BLOCKED: "FORBIDDEN",
  NOT_READY: "PRECONDITION_FAILED",
  USERNAME_TAKEN: "CONFLICT",
  INVALID_USERNAME: "BAD_REQUEST",
  RATE_LIMITED: "TOO_MANY_REQUESTS",
} as const;

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof SharingError) {
      throw new TRPCError({
        code: CODE_MAP[error.code],
        message: error.message,
      });
    }
    throw error;
  }
}

export const sharingRouter = router({
  profile: protectedProcedure.query(({ ctx }) =>
    getSharingProfile(ctx.user.id)
  ),

  setUsername: protectedProcedure
    .input(z.object({ username: z.string().min(1).max(40) }))
    .mutation(({ ctx, input }) =>
      run(async () => ({
        username: await setUsername(ctx.user.id, input.username),
      }))
    ),

  searchUsers: protectedProcedure
    .input(
      z.object({
        query: z.string().max(64),
        offset: z.number().int().min(0).max(200).default(0),
      })
    )
    .query(({ ctx, input }) =>
      searchStudents(ctx.user.id, input.query, input.offset)
    ),

  sendRequest: protectedProcedure
    .input(
      z.object({ bookId: z.string().uuid(), recipientId: z.string().uuid() })
    )
    .mutation(({ ctx, input }) =>
      run(() =>
        createShareRequest(ctx.user.id, input.bookId, input.recipientId)
      )
    ),

  incoming: protectedProcedure.query(({ ctx }) =>
    listIncomingRequests(ctx.user.id)
  ),

  respond: protectedProcedure
    .input(
      z.object({
        shareId: z.string().uuid(),
        decision: z.enum(["accept", "decline"]),
        block: z.boolean().default(false),
      })
    )
    .mutation(({ ctx, input }) =>
      run(() =>
        respondToShare(ctx.user.id, input.shareId, input.decision, input.block)
      )
    ),

  sharedWithMe: protectedProcedure.query(({ ctx }) =>
    listSharedWithMe(ctx.user.id)
  ),

  sharesForBook: protectedProcedure
    .input(z.object({ bookId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await listSharesForBook(ctx.user.id, input.bookId);
      if (!rows) throw new TRPCError({ code: "NOT_FOUND" });
      return rows;
    }),

  revoke: protectedProcedure
    .input(z.object({ shareId: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      run(() => revokeShare(ctx.user.id, input.shareId))
    ),

  removeFromLibrary: protectedProcedure
    .input(z.object({ bookId: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      run(() => removeSharedFromLibrary(ctx.user.id, input.bookId))
    ),

  blocked: protectedProcedure.query(({ ctx }) =>
    listBlockedUsers(ctx.user.id)
  ),

  unblock: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await unblockUser(ctx.user.id, input.userId);
      return { success: true } as const;
    }),

  notifications: protectedProcedure.query(({ ctx }) =>
    listNotifications(ctx.user.id)
  ),

  markNotificationsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await markNotificationsRead(ctx.user.id);
    return { success: true } as const;
  }),

  homeSummary: protectedProcedure.query(({ ctx }) =>
    getSharingHomeSummary(ctx.user.id)
  ),
});
