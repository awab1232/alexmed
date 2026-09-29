import { decode, getToken } from "next-auth/jwt";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MOBILE_SESSION_MAX_AGE_SECONDS,
  issueMobileSession,
  sessionCookieName,
} from "./mobile-session";

const SECRET = "test-secret-for-mobile-session-0123456789";
const user = {
  id: "u1",
  email: "student@example.com",
  name: "Student",
  role: "user",
};

const saved = { ...process.env };
beforeEach(() => {
  process.env.AUTH_SECRET = SECRET;
  delete process.env.AUTH_URL;
  delete process.env.NEXTAUTH_URL;
});
afterEach(() => {
  process.env = { ...saved };
});

describe("sessionCookieName (must match what auth() reads)", () => {
  it("HTTPS base → __Secure- name; HTTP → plain", () => {
    expect(sessionCookieName("https://nirolearn.com/api/mobile/auth/login")).toBe(
      "__Secure-authjs.session-token"
    );
    expect(sessionCookieName("http://localhost:3000/x")).toBe(
      "authjs.session-token"
    );
  });

  it("AUTH_URL wins over the request URL (production sets it)", () => {
    process.env.AUTH_URL = "https://nirolearn.com";
    expect(sessionCookieName("http://internal:8080/x")).toBe(
      "__Secure-authjs.session-token"
    );
  });
});

describe("issueMobileSession", () => {
  it("issues the same token Auth.js reads from the session cookie", async () => {
    const session = await issueMobileSession(
      user,
      "https://nirolearn.com/api/mobile/auth/login"
    );
    expect(session.cookieName).toBe("__Secure-authjs.session-token");

    // Exactly how Auth.js reads a request's session: the cookie, decoded
    // with the secret and the cookie name as salt.
    const request = new Request("https://nirolearn.com/api/trpc/auth.me", {
      headers: { cookie: `${session.cookieName}=${session.token}` },
    });
    const claims = await getToken({
      req: request,
      secret: SECRET,
      secureCookie: true,
    });
    expect(claims).toMatchObject({
      sub: "u1",
      id: "u1",
      role: "user",
      email: "student@example.com",
      name: "Student",
    });
  });

  it("expires in 30 days, like a web session", async () => {
    const now = new Date("2026-09-29T12:00:00Z");
    const session = await issueMobileSession(user, "https://nirolearn.com/", now);
    expect(session.expiresAt).toBe("2026-10-29T12:00:00.000Z");
    const claims = await decode({
      token: session.token,
      secret: SECRET,
      salt: session.cookieName,
    });
    const exp = Number(claims?.exp);
    const iat = Number(claims?.iat);
    expect(exp - iat).toBe(MOBILE_SESSION_MAX_AGE_SECONDS);
  });

  it("a token is useless under another cookie name or secret", async () => {
    const session = await issueMobileSession(user, "https://nirolearn.com/");
    await expect(
      decode({
        token: session.token,
        secret: SECRET,
        salt: "authjs.session-token",
      })
    ).rejects.toThrow();
    await expect(
      decode({
        token: session.token,
        secret: "another-secret-0123456789-0123456789",
        salt: session.cookieName,
      })
    ).rejects.toThrow();
  });

  it("refuses to issue without AUTH_SECRET", async () => {
    delete process.env.AUTH_SECRET;
    await expect(
      issueMobileSession(user, "https://nirolearn.com/")
    ).rejects.toThrow("AUTH_SECRET");
  });
});
