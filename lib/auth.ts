import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "../drizzle/schema";
import { verifyCredentials } from "./credentials-login";
import { getUserByEmail, requireDb } from "./db";
import { getSessionUserState } from "./session-user";

// Distinct error code (rather than the generic "CredentialsSignin" from
// returning null) so LoginForm can show "حسابك معلّق" instead of "بيانات
// الدخول غير صحيحة" — a suspended student didn't mistype their password.
class AccountSuspendedError extends CredentialsSignin {
  code = "account_suspended";
}

// Same distinct-code pattern as AccountSuspendedError above — see
// lib/auth-rate-limit.ts for why this exists at all (no throttling
// previously existed on login attempts).
class TooManyAttemptsError extends CredentialsSignin {
  code = "too_many_attempts";
}

// Google only appears once real credentials are supplied — keeps this app
// fully functional on Credentials alone until then, no code change needed
// later beyond dropping the two env vars in.
const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Adapter persists users/accounts (so a Google sign-in creates/links a real
  // `users` row) even though sessions themselves stay JWT-based below — the
  // adapter's own session/verificationToken tables just go unused at runtime.
  adapter: DrizzleAdapter(requireDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      // One "identifier" field: a phone number (phone sign-up accounts,
      // typed locally or internationally) or an email (accounts created
      // before phone sign-up). `email` is still accepted from older clients.
      credentials: {
        identifier: { label: "Phone or email", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // The check itself is shared with the mobile app's login endpoint
      // (lib/credentials-login.ts); this only maps its result onto Auth.js.
      async authorize(credentials) {
        const identifier =
          typeof credentials?.identifier === "string" && credentials.identifier
            ? credentials.identifier
            : typeof credentials?.email === "string"
              ? credentials.email
              : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        const result = await verifyCredentials({ identifier, password });
        if (!result.ok) {
          if (result.reason === "too_many_attempts") {
            throw new TooManyAttemptsError();
          }
          if (result.reason === "suspended") throw new AccountSuspendedError();
          return null;
        }
        return {
          id: result.user.id,
          email: result.user.email ?? undefined,
          name: result.user.name ?? undefined,
          role: result.user.role,
        };
      },
    }),
    ...(googleEnabled
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    // Credentials' authorize() already blocks a suspended account before it
    // ever returns a user, so this only matters for the Google path (which
    // never runs authorize()). Returning a URL redirects there with that
    // query string instead of the default generic "?error=AccessDenied".
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) return true;
      const existing = await getUserByEmail(user.email);
      if (existing?.suspendedAt) {
        return "/login?error=account_suspended";
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role?: string }).role ?? "user";
        return token;
      }
      if (!token.id) return token;
      // Every later session read re-checks the account (lib/session-user.ts):
      // returning null ends the session, so suspending or deleting a user
      // takes effect on existing sessions, and the role always comes from
      // the database rather than from whatever was true at sign-in.
      try {
        const current = await getSessionUserState(token.id as string);
        if (!current) return null;
        token.role = current.role;
      } catch (error) {
        // A database hiccup must not sign everyone out; keep the token.
        console.error("[Auth] Session re-check failed", error);
        if (!token.role) token.role = "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as typeof session.user & { role: string }).role =
          (token.role as string) ?? "user";
      }
      return session;
    },
  },
});

export { googleEnabled };
