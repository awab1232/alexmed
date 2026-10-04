import { describe, expect, it, vi } from "vitest";
import type { GoogleIdClaims } from "./google-id-token";
import { signInWithGoogle } from "./mobile-google";

vi.mock("./db", () => ({
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
  requireDb: vi.fn(),
}));

const claims: GoogleIdClaims = {
  sub: "g-1",
  email: "student@gmail.com",
  emailVerified: true,
  name: "Student",
  picture: "https://img/x",
  azp: "android",
};

type Row = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  suspendedAt: Date | null;
};

function deps({
  byEmail,
  linkedId,
  rows = {},
}: {
  byEmail?: Row;
  linkedId?: string;
  rows?: Record<string, Row>;
}) {
  const adapter = {
    getUserByAccount: vi.fn(async () =>
      linkedId ? { id: linkedId, email: "", emailVerified: null } : null
    ),
    createUser: vi.fn(async (u: Record<string, unknown>) => ({
      ...u,
      id: "new-user",
    })),
    linkAccount: vi.fn(async () => undefined),
  };
  const all: Record<string, Row> = {
    ...rows,
    "new-user": {
      id: "new-user",
      email: claims.email,
      name: claims.name,
      role: "user",
      suspendedAt: null,
    },
  };
  return {
    adapter,
    getUserByEmail: vi.fn(async () => byEmail),
    getUserById: vi.fn(async (id: string) => all[id]),
  } as const;
}

const row = (over: Partial<Row> = {}): Row => ({
  id: "u1",
  email: claims.email,
  name: "Student",
  role: "user",
  suspendedAt: null,
  ...over,
});

describe("signInWithGoogle (same rules as the web)", () => {
  it("signs in the user the Google account is already linked to", async () => {
    const d = deps({ byEmail: row(), linkedId: "u1", rows: { u1: row() } });
    const r = await signInWithGoogle(claims, d as never);
    expect(r).toEqual({
      ok: true,
      created: false,
      user: { id: "u1", email: claims.email, name: "Student", role: "user" },
    });
    expect(d.adapter.getUserByAccount).toHaveBeenCalledWith({
      provider: "google",
      providerAccountId: "g-1",
    });
    expect(d.adapter.createUser).not.toHaveBeenCalled();
  });

  it("refuses to link by email (the web throws OAuthAccountNotLinked)", async () => {
    const d = deps({ byEmail: row() });
    expect(await signInWithGoogle(claims, d as never)).toEqual({
      ok: false,
      reason: "not_linked",
    });
    expect(d.adapter.createUser).not.toHaveBeenCalled();
    expect(d.adapter.linkAccount).not.toHaveBeenCalled();
  });

  it("creates a new user + Google account like the web adapter", async () => {
    const d = deps({});
    const r = await signInWithGoogle(claims, d as never);
    expect(r).toMatchObject({
      ok: true,
      created: true,
      user: { id: "new-user", role: "user" },
    });
    expect(d.adapter.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Student",
        email: "student@gmail.com",
        image: "https://img/x",
        emailVerified: null,
      })
    );
    expect(d.adapter.linkAccount).toHaveBeenCalledWith({
      userId: "new-user",
      type: "oidc",
      provider: "google",
      providerAccountId: "g-1",
    });
  });

  it("refuses a suspended account (by email, before anything else)", async () => {
    const d = deps({
      byEmail: row({ suspendedAt: new Date() }),
      linkedId: "u1",
    });
    expect(await signInWithGoogle(claims, d as never)).toEqual({
      ok: false,
      reason: "suspended",
    });
  });

  it("refuses a linked account that is suspended or gone", async () => {
    const d = deps({
      linkedId: "u9",
      rows: { u9: row({ id: "u9", suspendedAt: new Date() }) },
    });
    expect(await signInWithGoogle(claims, d as never)).toMatchObject({
      reason: "suspended",
    });
    const gone = deps({ linkedId: "missing" });
    expect(await signInWithGoogle(claims, gone as never)).toMatchObject({
      reason: "suspended",
    });
  });

  it("won't create an account for an unverified Google email", async () => {
    const d = deps({});
    expect(
      await signInWithGoogle({ ...claims, emailVerified: false }, d as never)
    ).toEqual({ ok: false, reason: "unverified_email" });
    expect(d.adapter.createUser).not.toHaveBeenCalled();
  });
});
