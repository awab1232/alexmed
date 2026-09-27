import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserById = vi.fn();
vi.mock("./db", () => ({ getUserById: (id: string) => getUserById(id) }));

import { forgetSessionUserState, getSessionUserState } from "./session-user";

describe("session user re-check", () => {
  beforeEach(() => getUserById.mockReset());

  it("ends the session for a suspended or deleted account", async () => {
    getUserById.mockResolvedValueOnce({
      role: "user",
      suspendedAt: new Date(),
    });
    expect(await getSessionUserState("suspended")).toBeNull();
    getUserById.mockResolvedValueOnce(undefined);
    expect(await getSessionUserState("deleted")).toBeNull();
  });

  it("takes the role from the database, not the token", async () => {
    getUserById.mockResolvedValueOnce({ role: "user", suspendedAt: null });
    expect(await getSessionUserState("demoted")).toEqual({ role: "user" });
  });

  it("caches briefly, and forgetting applies a change at once", async () => {
    getUserById.mockResolvedValue({ role: "admin", suspendedAt: null });
    expect(await getSessionUserState("u1")).toEqual({ role: "admin" });
    getUserById.mockResolvedValue({ role: "admin", suspendedAt: new Date() });
    expect(await getSessionUserState("u1")).toEqual({ role: "admin" });
    expect(getUserById).toHaveBeenCalledTimes(1);
    forgetSessionUserState("u1");
    expect(await getSessionUserState("u1")).toBeNull();
  });
});
