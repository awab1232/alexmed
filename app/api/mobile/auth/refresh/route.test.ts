import { getToken } from "next-auth/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ getUserById: vi.fn() }));

import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/db";
import { POST } from "./route";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const SECRET = "test-secret-for-mobile-refresh-0123456789";
const saved = { ...process.env };

const refresh = () =>
  POST(
    new Request("https://nirolearn.com/api/mobile/auth/refresh", {
      method: "POST",
    })
  );

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = SECRET;
  process.env.AUTH_URL = "https://nirolearn.com";
});
afterEach(() => {
  process.env = { ...saved };
});

describe("POST /api/mobile/auth/refresh", () => {
  it("valid session → a fresh 30-day token for the same account", async () => {
    m(auth).mockResolvedValue({ user: { id: "u1" } });
    m(getUserById).mockResolvedValue({
      id: "u1",
      name: "Student",
      email: null,
      role: "admin",
      suspendedAt: null,
    });
    const response = await refresh();
    expect(response.status).toBe(200);
    const body = await response.json();
    const claims = await getToken({
      req: new Request("https://nirolearn.com/x", {
        headers: { cookie: `${body.cookieName}=${body.token}` },
      }),
      secret: SECRET,
      secureCookie: true,
    });
    expect(claims).toMatchObject({ id: "u1", role: "admin" });
  });

  it("no session (expired / ended by the server) → 401, no token", async () => {
    m(auth).mockResolvedValue(null);
    const response = await refresh();
    expect(response.status).toBe(401);
    expect((await response.json()).token).toBeUndefined();
    expect(getUserById).not.toHaveBeenCalled();
  });

  it("suspended or deleted since → 401, the session is not extended", async () => {
    m(auth).mockResolvedValue({ user: { id: "u1" } });
    m(getUserById).mockResolvedValue({ id: "u1", suspendedAt: new Date() });
    expect((await refresh()).status).toBe(401);
    m(getUserById).mockResolvedValue(undefined);
    expect((await refresh()).status).toBe(401);
  });
});
