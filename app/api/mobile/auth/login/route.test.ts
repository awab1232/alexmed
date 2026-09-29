import { getToken } from "next-auth/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/credentials-login", () => ({ verifyCredentials: vi.fn() }));

import { verifyCredentials } from "@/lib/credentials-login";
import { POST } from "./route";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const SECRET = "test-secret-for-mobile-login-0123456789";
const saved = { ...process.env };

function post(body: unknown) {
  return POST(
    new Request("https://nirolearn.com/api/mobile/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = SECRET;
  process.env.AUTH_URL = "https://nirolearn.com";
});
afterEach(() => {
  process.env = { ...saved };
});

describe("POST /api/mobile/auth/login", () => {
  it("returns a session token the server accepts as its session cookie", async () => {
    m(verifyCredentials).mockResolvedValue({
      ok: true,
      user: { id: "u1", email: null, name: "Student", role: "user" },
    });
    const response = await post({
      identifier: "0791234567",
      password: "secret-pass",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.cookieName).toBe("__Secure-authjs.session-token");
    expect(body.user).toEqual({
      id: "u1",
      email: null,
      name: "Student",
      role: "user",
    });
    expect(Date.parse(body.expiresAt)).toBeGreaterThan(Date.now());
    expect(verifyCredentials).toHaveBeenCalledWith({
      identifier: "0791234567",
      password: "secret-pass",
    });

    const claims = await getToken({
      req: new Request("https://nirolearn.com/api/trpc/auth.me", {
        headers: { cookie: `${body.cookieName}=${body.token}` },
      }),
      secret: SECRET,
      secureCookie: true,
    });
    expect(claims).toMatchObject({ id: "u1", sub: "u1", role: "user" });
  });

  it.each([
    ["invalid", 401, "invalid_credentials"],
    ["suspended", 403, "account_suspended"],
    ["too_many_attempts", 429, "too_many_attempts"],
  ] as const)("%s → %i with code %s and no token", async (reason, status, code) => {
    m(verifyCredentials).mockResolvedValue({ ok: false, reason });
    const response = await post({ identifier: "a@b.com", password: "x" });
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body.code).toBe(code);
    expect(body.error).toMatch(/[؀-ۿ]/);
    expect(body.token).toBeUndefined();
  });

  it("rejects malformed bodies before checking anything", async () => {
    for (const body of [
      "not json",
      {},
      { identifier: "", password: "x" },
      { identifier: "a@b.com" },
      { identifier: "a@b.com", password: "x".repeat(129) },
    ]) {
      const response = await post(body);
      expect(response.status).toBe(400);
    }
    expect(verifyCredentials).not.toHaveBeenCalled();
  });
});
