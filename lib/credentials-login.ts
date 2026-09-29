// The phone/email + password check, shared by the web's Credentials provider
// (lib/auth.ts) and the mobile app's login endpoint
// (app/api/mobile/auth/login) — one implementation, so both clients get
// the same rate limit, the same suspended-account rule and the same
// password comparison.
import bcrypt from "bcryptjs";
import { getUserByEmail, getUserByPhone, touchLastSignedIn } from "./db";
import { looksLikePhone, parsePhone } from "./phone";
import {
  LoginRateLimitedError,
  assertLoginAllowed,
  recordFailedLogin,
} from "./auth-rate-limit";

export type VerifiedUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
};

export type CredentialsResult =
  | { ok: true; user: VerifiedUser }
  // Wrong identifier/password, unparseable phone, Google-only account —
  // deliberately indistinguishable to the caller.
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "suspended" }
  | { ok: false; reason: "too_many_attempts" };

export async function verifyCredentials(input: {
  identifier: string;
  password: string;
}): Promise<CredentialsResult> {
  const raw = input.identifier;
  const password = input.password;
  if (!raw.trim() || !password) return { ok: false, reason: "invalid" };

  // The rate-limit key is the normalized identifier (E.164 number or
  // lower-cased email), so "079…" and "+96279…" share one budget.
  let key: string;
  let byPhone = false;
  if (looksLikePhone(raw)) {
    const phone = parsePhone(raw);
    if (!phone.ok) return { ok: false, reason: "invalid" };
    key = phone.e164;
    byPhone = true;
  } else {
    key = raw.toLowerCase().trim();
  }

  try {
    await assertLoginAllowed(key);
  } catch (error) {
    if (error instanceof LoginRateLimitedError) {
      return { ok: false, reason: "too_many_attempts" };
    }
    throw error;
  }

  const user = byPhone ? await getUserByPhone(key) : await getUserByEmail(key);
  // Google-only accounts have no password to compare against.
  if (!user || !user.passwordHash) {
    await recordFailedLogin(key);
    return { ok: false, reason: "invalid" };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await recordFailedLogin(key);
    return { ok: false, reason: "invalid" };
  }

  // Checked only after the password matched, so it can't be used to probe
  // which accounts exist.
  if (user.suspendedAt) return { ok: false, reason: "suspended" };

  await touchLastSignedIn(user.id);

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      role: user.role,
    },
  };
}
