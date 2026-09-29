import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getUserByEmail: vi.fn(),
  getUserByPhone: vi.fn(),
  touchLastSignedIn: vi.fn(),
}));
vi.mock("./auth-rate-limit", async importOriginal => ({
  ...(await importOriginal<typeof import("./auth-rate-limit")>()),
  assertLoginAllowed: vi.fn(),
  recordFailedLogin: vi.fn(),
}));

import { LoginRateLimitedError } from "./auth-rate-limit";
import { assertLoginAllowed, recordFailedLogin } from "./auth-rate-limit";
import { verifyCredentials } from "./credentials-login";
import { getUserByEmail, getUserByPhone, touchLastSignedIn } from "./db";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const hash = bcrypt.hashSync("correct-horse", 4);

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    email: "student@example.com",
    name: "Student",
    role: "user",
    passwordHash: hash,
    suspendedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m(assertLoginAllowed).mockResolvedValue(undefined);
});

describe("verifyCredentials (shared by web sign-in and the mobile login)", () => {
  it("accepts the right email + password and records the sign-in", async () => {
    m(getUserByEmail).mockResolvedValue(user());
    const result = await verifyCredentials({
      identifier: "  Student@Example.com ",
      password: "correct-horse",
    });
    expect(result).toEqual({
      ok: true,
      user: {
        id: "u1",
        email: "student@example.com",
        name: "Student",
        role: "user",
      },
    });
    expect(getUserByEmail).toHaveBeenCalledWith("student@example.com");
    expect(touchLastSignedIn).toHaveBeenCalledWith("u1");
    expect(recordFailedLogin).not.toHaveBeenCalled();
  });

  it("looks phone numbers up by E.164, whichever way they are typed", async () => {
    m(getUserByPhone).mockResolvedValue(user({ email: null }));
    const result = await verifyCredentials({
      identifier: "079 123 4567",
      password: "correct-horse",
    });
    expect(result.ok).toBe(true);
    expect(getUserByPhone).toHaveBeenCalledWith("+962791234567");
    expect(assertLoginAllowed).toHaveBeenCalledWith("+962791234567");
  });

  it("wrong password → invalid, and counts against the rate limit", async () => {
    m(getUserByEmail).mockResolvedValue(user());
    const result = await verifyCredentials({
      identifier: "student@example.com",
      password: "wrong",
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(recordFailedLogin).toHaveBeenCalledWith("student@example.com");
    expect(touchLastSignedIn).not.toHaveBeenCalled();
  });

  it("unknown account and Google-only account look exactly like a wrong password", async () => {
    m(getUserByEmail).mockResolvedValue(undefined);
    expect(
      await verifyCredentials({ identifier: "nobody@x.com", password: "p" })
    ).toEqual({ ok: false, reason: "invalid" });

    m(getUserByEmail).mockResolvedValue(user({ passwordHash: null }));
    expect(
      await verifyCredentials({
        identifier: "student@example.com",
        password: "p",
      })
    ).toEqual({ ok: false, reason: "invalid" });
    expect(recordFailedLogin).toHaveBeenCalledTimes(2);
  });

  it("suspended is only revealed after the password matched", async () => {
    m(getUserByEmail).mockResolvedValue(user({ suspendedAt: new Date() }));
    expect(
      await verifyCredentials({
        identifier: "student@example.com",
        password: "wrong",
      })
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      await verifyCredentials({
        identifier: "student@example.com",
        password: "correct-horse",
      })
    ).toEqual({ ok: false, reason: "suspended" });
    expect(touchLastSignedIn).not.toHaveBeenCalled();
  });

  it("rate limited → checked before the database and bcrypt", async () => {
    m(assertLoginAllowed).mockRejectedValue(new LoginRateLimitedError());
    const result = await verifyCredentials({
      identifier: "student@example.com",
      password: "correct-horse",
    });
    expect(result).toEqual({ ok: false, reason: "too_many_attempts" });
    expect(getUserByEmail).not.toHaveBeenCalled();
  });

  it("empty input and malformed phone numbers are invalid without a lookup", async () => {
    for (const input of [
      { identifier: "", password: "x" },
      { identifier: "a@b.com", password: "" },
      // Looks like a phone number but isn't a valid Jordanian mobile.
      { identifier: "0712345", password: "x" },
    ]) {
      expect(await verifyCredentials(input)).toEqual({
        ok: false,
        reason: "invalid",
      });
    }
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(getUserByPhone).not.toHaveBeenCalled();
  });
});
