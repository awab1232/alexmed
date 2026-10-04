import { getToken } from "next-auth/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/google-id-token", async () => {
  const actual = await vi.importActual<typeof import("@/lib/google-id-token")>(
    "@/lib/google-id-token"
  );
  return { ...actual, verifyGoogleIdToken: vi.fn() };
});
vi.mock("@/lib/mobile-google", () => ({ signInWithGoogle: vi.fn() }));

import { GoogleTokenError, verifyGoogleIdToken } from "@/lib/google-id-token";
import { signInWithGoogle } from "@/lib/mobile-google";
import { POST } from "./route";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const SECRET = "test-secret-for-mobile-google-0123456789";
const saved = { ...process.env };
const ID_TOKEN = "header.payload.signature-long-enough";

function post(body: unknown) {
  return POST(
    new Request("https://nirolearn.com/api/mobile/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

const claims = {
  sub: "g-1",
  email: "s@gmail.com",
  emailVerified: true,
  name: "S",
  picture: null,
  azp: "android",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = SECRET;
  process.env.AUTH_URL = "https://nirolearn.com";
  process.env.GOOGLE_CLIENT_ID = "web-client";
  process.env.GOOGLE_CLIENT_SECRET = "web-secret";
});
afterEach(() => {
  process.env = { ...saved };
});

describe("POST /api/mobile/auth/google", () => {
  it("verifies against the web client + the Android client and returns a session", async () => {
    m(verifyGoogleIdToken).mockResolvedValue(claims);
    m(signInWithGoogle).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          aud: GOOGLE_CLIENT_ID,
          iss: "https://accounts.google.com",
          email,
          name: "Student",
          sub: "google123",
        }),
    });
    const response = await post({ idToken: ID_TOKEN });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const [, options] = m(verifyGoogleIdToken).mock.calls[0];
    expect(options.audiences).toEqual([
      "342475897969-tcogc9hjlfe5nlgqdkhm1opsk126j2ed.apps.googleusercontent.com",
      "web-client",
    ]);
    expect(options.authorizedParties).toContain(
      "342475897969-e9m19r0t8u47r07nnpslqn0tp5artnmb.apps.googleusercontent.com"
    );
    const body = await response.json();
    const decoded = await getToken({
      req: new Request("https://nirolearn.com/", {
        headers: { cookie: `${body.cookieName}=${body.token}` },
      }),
      secret: SECRET,
      secureCookie: true,
    });
    expect(decoded?.id).toBe("u1");
    expect(body.user.id).toBe("u1");
  });

<<<<<<< HEAD
  it("valid Google token → new user → creates user → issues session", async () => {
      const email = "new@example.com";
      m(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            aud: GOOGLE_CLIENT_ID,
            iss: "https://accounts.google.com",
            email,
            name: "New Student",
            sub: "google456",
          }),
      });
      m(getUserByEmail).mockResolvedValue(undefined);
      m(createUser).mockResolvedValue({
          id: "u2",
          email,
          name: "New Student",
          role: "user",
          suspendedAt: null,
      });
      m(issueMobileSession).mockResolvedValue({ token: "new-token", cookieName: "authjs.session-token" });

      const response = await POST(
        new Request("https://nirolearn.com/api/mobile/auth/google", {
          method: "POST",
          body: JSON.stringify({ idToken: "fake-id-token" }),
        })
      );

      expect(response.status).toBe(200);
      expect(createUser).toHaveBeenCalledWith(
          expect.objectContaining({ email, name: "New Student", role: "user" })
      );
      // users.id is a uuid column with a DB default — the route must never
      // hand the insert an app-generated id string.
      expect(m(createUser).mock.calls[0][0]).not.toHaveProperty("id");
      expect(issueMobileSession).toHaveBeenCalledWith(
          expect.objectContaining({ id: "u2" }),
          expect.any(String)
      );
      const body = await response.json();
      expect(body.user).toEqual({ id: "u2", email, name: "New Student", role: "user" });
    });

  it("invalid audience → 401", async () => {
    m(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ aud: "wrong-aud", iss: "https://accounts.google.com" }),
    });
    const response = await POST(
        new Request("https://nirolearn.com/api/mobile/auth/google", {
          method: "POST",
          body: JSON.stringify({ idToken: "fake-id-token" }),
        })
      );
    expect(response.status).toBe(401);
  });

  it("invalid issuer → 401", async () => {
    m(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ aud: GOOGLE_CLIENT_ID, iss: "https://malicious.com" }),
    });
    const response = await POST(
        new Request("https://nirolearn.com/api/mobile/auth/google", {
          method: "POST",
          body: JSON.stringify({ idToken: "fake-id-token" }),
        })
      );
=======
  it("extra mobile client IDs come from GOOGLE_MOBILE_CLIENT_IDS", async () => {
    process.env.GOOGLE_MOBILE_CLIENT_IDS = "ios-client, other ";
    m(verifyGoogleIdToken).mockRejectedValue(new GoogleTokenError("x"));
    await post({ idToken: ID_TOKEN });
    const [, options] = m(verifyGoogleIdToken).mock.calls[0];
    expect(options.authorizedParties).toEqual(
      expect.arrayContaining(["ios-client", "other"])
    );
  });

  it("an invalid Google token → 401", async () => {
    m(verifyGoogleIdToken).mockRejectedValue(
      new GoogleTokenError("bad signature")
    );
    const response = await post({ idToken: ID_TOKEN });
>>>>>>> main
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("invalid_google_token");
    expect(signInWithGoogle).not.toHaveBeenCalled();
  });

<<<<<<< HEAD
  it("suspended user → 403", async () => {
    m(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ aud: GOOGLE_CLIENT_ID, iss: "https://accounts.google.com", email: "s@e.com", sub: "g1" }),
      });
    m(getUserByEmail).mockResolvedValue({ id: "u1", suspendedAt: new Date() });

    const response = await POST(
        new Request("https://nirolearn.com/api/mobile/auth/google", {
          method: "POST",
          body: JSON.stringify({ idToken: "fake-id-token" }),
        })
      );
    expect(response.status).toBe(403);
  });

  it("token without an email → 400, no user lookup", async () => {
    m(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ aud: GOOGLE_CLIENT_ID, iss: "https://accounts.google.com", sub: "g1" }),
      });
=======
  it("Google keys unreachable → 502", async () => {
    m(verifyGoogleIdToken).mockRejectedValue(new Error("network"));
    expect((await post({ idToken: ID_TOKEN })).status).toBe(502);
  });

  it.each([
    ["not_linked", 409, "account_not_linked"],
    ["suspended", 403, "account_suspended"],
    ["unverified_email", 403, "unverified_email"],
  ])("%s → %d %s", async (reason, status, code) => {
    m(verifyGoogleIdToken).mockResolvedValue(claims);
    m(signInWithGoogle).mockResolvedValue({ ok: false, reason });
    const response = await post({ idToken: ID_TOKEN });
    expect(response.status).toBe(status);
    expect((await response.json()).code).toBe(code);
  });
>>>>>>> main

  it("bad body → 400", async () => {
    expect((await post({})).status).toBe(400);
    expect(verifyGoogleIdToken).not.toHaveBeenCalled();
  });

  it("Google not configured on the server → 503", async () => {
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect((await post({ idToken: ID_TOKEN })).status).toBe(503);
  });
});
