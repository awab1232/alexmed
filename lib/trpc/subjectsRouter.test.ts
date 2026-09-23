import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db-subjects", () => ({
  createSubject: vi.fn(),
  deleteSubject: vi.fn(),
  getSubjectForUser: vi.fn(),
  listDeckCountsBySubjectForUser: vi.fn().mockResolvedValue(new Map()),
  listSubjectsForUser: vi.fn().mockResolvedValue([]),
  updateSubject: vi.fn(),
}));

import { subjectsRouter } from "./subjectsRouter";
import {
  createSubject,
  deleteSubject,
  getSubjectForUser,
  updateSubject,
} from "../db-subjects";

const mockCreate = createSubject as unknown as ReturnType<typeof vi.fn>;
const mockDelete = deleteSubject as unknown as ReturnType<typeof vi.fn>;
const mockGet = getSubjectForUser as unknown as ReturnType<typeof vi.fn>;
const mockUpdate = updateSubject as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function caller() {
  return subjectsRouter.createCaller({
    user: {
      id: "u1",
      email: "test@example.com",
      name: "Test",
      role: "user",
      passwordHash: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: null,
    },
  });
}

describe("subjectsRouter.get", () => {
  it("returns NOT_FOUND for a subject that isn't the caller's", async () => {
    mockGet.mockResolvedValue(null);
    await expect(caller().get({ id: "not-mine" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns the subject when it is the caller's", async () => {
    mockGet.mockResolvedValue({ id: "s1", name: "تشريح" });
    const result = await caller().get({ id: "s1" });
    expect(result).toEqual({ id: "s1", name: "تشريح" });
    expect(mockGet).toHaveBeenCalledWith("u1", "s1");
  });
});

describe("subjectsRouter.create", () => {
  it("rejects an empty name before it reaches the data layer", async () => {
    await expect(caller().create({ name: "" })).rejects.toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates under the caller's own userId", async () => {
    mockCreate.mockResolvedValue({ id: "s1", name: "تشريح" });
    await caller().create({ name: "تشريح" });
    expect(mockCreate).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ name: "تشريح" })
    );
  });
});

describe("subjectsRouter.update / delete ownership", () => {
  it("update returns NOT_FOUND when the subject isn't the caller's", async () => {
    mockUpdate.mockResolvedValue(false);
    await expect(
      caller().update({ id: "not-mine", name: "x" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("delete returns NOT_FOUND when the subject isn't the caller's", async () => {
    mockDelete.mockResolvedValue(false);
    await expect(caller().delete({ id: "not-mine" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
