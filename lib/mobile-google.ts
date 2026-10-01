import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { Adapter } from "next-auth/adapters";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "../drizzle/schema";
import type { VerifiedUser } from "./credentials-login";
import { getUserByEmail, getUserById, requireDb } from "./db";
import type { GoogleIdClaims } from "./google-id-token";

// Google sign-in for the native app, with the SAME account rules as the
// web's Auth.js Google provider (lib/auth.ts → @auth/core handle-login):
//  1. a Google account already linked → that user;
//  2. otherwise, an existing account with the same email → refused
//     ("OAuthAccountNotLinked": the web never links by email either, so a
//     Google login can't take over a password account);
//  3. otherwise → a new user + its Google account, created through the same
//     Drizzle adapter the web uses (same columns, emailVerified null).
// A suspended account is refused first, as the web's signIn callback does.
// One addition for new accounts only: Google must say the email is verified.

export type GoogleSignInResult =
  | { ok: true; user: VerifiedUser; created: boolean }
  | { ok: false; reason: "suspended" | "not_linked" | "unverified_email" };

type Deps = {
  adapter: Pick<Adapter, "getUserByAccount" | "createUser" | "linkAccount">;
  getUserByEmail: typeof getUserByEmail;
  getUserById: typeof getUserById;
};

let defaultDeps: Deps | null = null;
function deps(): Deps {
  defaultDeps ??= {
    adapter: DrizzleAdapter(requireDb(), {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    getUserByEmail,
    getUserById,
  };
  return defaultDeps;
}

function verified(row: {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
}): VerifiedUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role ?? "user",
  };
}

export async function signInWithGoogle(
  claims: GoogleIdClaims,
  injected?: Deps
): Promise<GoogleSignInResult> {
  const d = injected ?? deps();

  // The web's signIn callback: a suspended account is refused up front.
  const byEmail = await d.getUserByEmail(claims.email);
  if (byEmail?.suspendedAt) return { ok: false, reason: "suspended" };

  const linked = await d.adapter.getUserByAccount!({
    provider: "google",
    providerAccountId: claims.sub,
  });
  if (linked) {
    const row = await d.getUserById(linked.id);
    if (!row || row.suspendedAt) return { ok: false, reason: "suspended" };
    return { ok: true, user: verified(row), created: false };
  }

  if (byEmail) return { ok: false, reason: "not_linked" };
  if (!claims.emailVerified) return { ok: false, reason: "unverified_email" };

  // Same profile mapping as Auth.js' Google provider (name, email, image).
  const created = await d.adapter.createUser!({
    id: crypto.randomUUID(),
    name: claims.name,
    email: claims.email,
    image: claims.picture,
    emailVerified: null,
  });
  await d.adapter.linkAccount!({
    userId: created.id,
    type: "oidc",
    provider: "google",
    providerAccountId: claims.sub,
  });
  const row = await d.getUserById(created.id);
  return {
    ok: true,
    user: verified(
      row ?? {
        id: created.id,
        email: created.email,
        name: created.name ?? null,
        role: "user",
      }
    ),
    created: true,
  };
}
