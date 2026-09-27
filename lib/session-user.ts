// Sessions are stateless JWTs, so the user's current state has to be read
// back from the database: a suspended, deleted or demoted account must lose
// (or downgrade) its existing sessions, not only be refused at sign-in.
// lib/auth.ts's jwt callback calls this on every session read. The answer is
// cached per server instance for a short time so a page's many requests
// don't each pay a database round-trip; that also bounds how long a
// suspension takes to bite on another instance.
import { getUserById } from "./db";

const TTL_MS = 30_000;
const MAX_ENTRIES = 5_000;

export type SessionUserState = { role: "admin" | "user" };

const cache = new Map<string, { state: SessionUserState | null; at: number }>();

// null = the account is gone or suspended; the session must end.
export async function getSessionUserState(
  userId: string
): Promise<SessionUserState | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.state;

  const user = await getUserById(userId);
  const state: SessionUserState | null =
    user && !user.suspendedAt
      ? { role: user.role === "admin" ? "admin" : "user" }
      : null;
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(userId, { state, at: Date.now() });
  return state;
}

// Drop the cached state after an admin changes the account, so this
// instance applies the change on the very next request.
export function forgetSessionUserState(userId: string) {
  cache.delete(userId);
}
