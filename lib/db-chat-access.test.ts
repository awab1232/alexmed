// A chat session reads the book it points at on every turn, so it must stop
// working the moment the caller loses access to that book (share revoked or
// removed) — not only be checked when the session was created.
import { beforeEach, describe, expect, it, vi } from "vitest";

let sessionRow: Record<string, unknown> | undefined;
const chain = {
  select: () => chain,
  from: () => chain,
  where: () => chain,
  limit: async () => (sessionRow ? [sessionRow] : []),
};
vi.mock("./db", () => ({ getDb: () => chain }));
const getBookAccess = vi.fn();
vi.mock("./book-access", () => ({
  getBookAccess: (u: string, b: string) => getBookAccess(u, b),
  getChapterAccess: vi.fn(async () => null),
}));
vi.mock("./db-books", () => ({
  getBookPageOwnedByUser: vi.fn(async () => null),
}));
vi.mock("./db-subjects", () => ({
  getSubjectForUser: vi.fn(async () => null),
}));

import { getChatSessionForUser } from "./db-chat";

describe("getChatSessionForUser re-checks access", () => {
  beforeEach(() => {
    getBookAccess.mockReset();
    sessionRow = { id: "s1", userId: "r1", scope: "book", bookId: "b1" };
  });

  it("returns the session while the share is accepted", async () => {
    getBookAccess.mockResolvedValue({ role: "shared" });
    expect(await getChatSessionForUser("r1", "s1")).toEqual(sessionRow);
    expect(getBookAccess).toHaveBeenCalledWith("r1", "b1");
  });

  it("refuses the session once access is gone", async () => {
    getBookAccess.mockResolvedValue(null);
    expect(await getChatSessionForUser("r1", "s1")).toBeNull();
  });

  it("refuses a session with no target", async () => {
    sessionRow = { id: "s1", userId: "r1", scope: "book", bookId: null };
    expect(await getChatSessionForUser("r1", "s1")).toBeNull();
  });

  it("returns null for an unknown session", async () => {
    sessionRow = undefined;
    expect(await getChatSessionForUser("r1", "s1")).toBeNull();
  });
});
