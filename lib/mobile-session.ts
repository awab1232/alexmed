// Sessions for the native app (docs/mobile/MOBILE_ARCHITECTURE_BLUEPRINT.md
// §9). The app gets exactly the token Auth.js keeps in the web's session
// cookie — same secret, same salt (the cookie name), same 30-day lifetime —
// and sends it back as that cookie. So every existing route and tRPC
// procedure authorises the app through the unchanged `auth()` call, with
// the same per-request database re-check (suspended / deleted / role) as
// the web. No second session system.
import { encode } from "next-auth/jwt";
import type { VerifiedUser } from "./credentials-login";

/** Auth.js' default session lifetime (@auth/core DEFAULT_MAX_AGE). */
export const MOBILE_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * The session cookie name `auth()` reads — Auth.js picks the `__Secure-`
 * name when its base URL is HTTPS (AUTH_URL, or the request itself with
 * trustHost). The encryption salt is this name, so it must match exactly.
 */
export function sessionCookieName(requestUrl: string): string {
  const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || requestUrl;
  let secure = false;
  try {
    secure = new URL(base).protocol === "https:";
  } catch {
    secure = false;
  }
  return secure ? "__Secure-authjs.session-token" : "authjs.session-token";
}

export type MobileSession = {
  token: string;
  /** ISO timestamp. */
  expiresAt: string;
  /** Cookie name the app must send the token under. */
  cookieName: string;
};

export async function issueMobileSession(
  user: VerifiedUser,
  requestUrl: string,
  now: Date = new Date()
): Promise<MobileSession> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  const cookieName = sessionCookieName(requestUrl);
  // The same claims the web's jwt() callback puts in the cookie (lib/auth.ts):
  // Auth.js' defaults (sub, name, email) plus our id + role. The role is
  // re-read from the database on every later request anyway.
  const token = await encode({
    token: {
      sub: user.id,
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    },
    secret,
    salt: cookieName,
    maxAge: MOBILE_SESSION_MAX_AGE_SECONDS,
  });
  const expiresAt = new Date(
    now.getTime() + MOBILE_SESSION_MAX_AGE_SECONDS * 1000
  ).toISOString();
  return { token, expiresAt, cookieName };
}
