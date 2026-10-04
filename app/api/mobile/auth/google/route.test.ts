import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { getUserByEmail, createUser } from "@/lib/db";
import { issueMobileSession } from "@/lib/mobile-session";
import { POST } from "./route";

vi.mock("@/lib/db", () => ({
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
}));
vi.mock("@/lib/mobile-session", () => ({ issueMobileSession: vi.fn() }));

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const GOOGLE_CLIENT_ID = "test-google-client-id";
const saved = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID;
  global.fetch = vi.fn();
});

afterEach(() => {
  process.env = { ...saved };
  vi.restoreAllMocks();
});

describe("POST /api/mobile/auth/google", () => {
  it("valid Google token → finds existing user → issues session", async () => {
    const email = "student@example.com";
    m(global.fetch).mockResolvedValue({
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
    m(getUserByEmail).mockResolvedValue({
      id: "u1",
      email,
      name: "Student",
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
    expect(getUserByEmail).toHaveBeenCalledWith(email);
    expect(createUser).not.toHaveBeenCalled();
    expect(issueMobileSession).toHaveBeenCalledWith(
        expect.objectContaining({ id: "u1" }),
        expect.any(String)
    );
    const body = await response.json();
    expect(body.token).toBe("new-token");
    expect(body.user).toEqual({ id: "u1", email, name: "Student", role: "user" });
  });

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
    expect(response.status).toBe(401);
  });

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

    const response = await POST(
        new Request("https://nirolearn.com/api/mobile/auth/google", {
          method: "POST",
          body: JSON.stringify({ idToken: "fake-id-token" }),
        })
      );
    expect(response.status).toBe(400);
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });
});
