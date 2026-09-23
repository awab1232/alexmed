// Per-email rate limit on failed Credentials sign-in attempts — same
// DB-backed reasoning as lib/queue/rateLimit.ts's assertJobCreationAllowed
// (infrequent check, no need for a separate Redis dependency), applied to
// authentication instead of job creation. Before this, lib/auth.ts's
// authorize() had zero throttling: any known student email could be
// brute-forced against with unlimited password guesses.
import { and, count, eq, gte } from "drizzle-orm";
import { loginAttempts } from "../drizzle/schema";
import { getDb } from "./db";

export class LoginRateLimitedError extends Error {
  constructor(message = "محاولات دخول كثيرة. حاول بعد شوي.") {
    super(message);
    this.name = "LoginRateLimitedError";
  }
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Read lazily (not at module-load time) so tests can set process.env first,
// and so a missing var falls back rather than crashing import.
export function getLoginRateLimitMax(): number {
  return readIntEnv("LOGIN_RATE_LIMIT_MAX", 8);
}

export function getLoginRateLimitWindowMinutes(): number {
  return readIntEnv("LOGIN_RATE_LIMIT_WINDOW_MINUTES", 15);
}

// Throws when this email has already hit the failed-attempt ceiling within
// the window — called BEFORE bcrypt.compare, so a locked-out attacker can't
// keep burning compute on guesses either.
export async function assertLoginAllowed(email: string): Promise<void> {
  const db = getDb();
  if (!db) return; // no DB configured (local tooling) — nothing to enforce

  const windowStart = new Date(
    Date.now() - getLoginRateLimitWindowMinutes() * 60_000
  );
  const [row] = await db
    .select({ c: count() })
    .from(loginAttempts)
    .where(
      and(eq(loginAttempts.email, email), gte(loginAttempts.createdAt, windowStart))
    );

  if (Number(row?.c ?? 0) >= getLoginRateLimitMax()) {
    throw new LoginRateLimitedError();
  }
}

// Only failed attempts are recorded — a successful login never counts
// against the window, so a student who mistypes a few times then gets it
// right isn't left sitting near the ceiling.
export async function recordFailedLogin(email: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.insert(loginAttempts).values({ email });
}
