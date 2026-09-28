import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "../../drizzle/schema";
import { auth } from "../auth";
import { requestIp } from "../phone-signup-http";

export type TrpcContext = {
  user: User | null;
  // The requester's IP as our edge saw it (lib/phone-signup-http.ts's
  // requestIp) — only ever hashed before use (e.g. redeem rate limits).
  // Absent when a caller builds a context by hand (tests, server calls).
  ip?: string | null;
};

export async function createContext(
  opts?: FetchCreateContextFnOptions
): Promise<TrpcContext> {
  const session = await auth();
  const ip = opts?.req ? requestIp(opts.req) : null;

  if (!session?.user) {
    return { user: null, ip };
  }

  return {
    ip,
    user: {
      id: session.user.id,
      email: session.user.email ?? "",
      name: session.user.name ?? null,
      role:
        (session.user as { role?: string }).role === "admin" ? "admin" : "user",
      passwordHash: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: null,
    } as User,
  };
}
