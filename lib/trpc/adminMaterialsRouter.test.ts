import { describe, expect, it, vi } from "vitest";

vi.mock("../db-admin-materials", () => ({
  listAdminMaterials: vi.fn().mockResolvedValue([]),
  getAdminMaterialStats: vi.fn(),
  getAdminMaterialWithBatches: vi.fn(),
  createAdminMaterialDraft: vi.fn(),
  startAdminMaterialProcessing: vi.fn(),
  getAdminMaterialBatchById: vi.fn(),
  resetAdminMaterialBatchForRetry: vi.fn(),
  publishAdminMaterial: vi.fn(),
  archiveAdminMaterial: vi.fn(),
  deleteAdminMaterial: vi.fn(),
  getAdminMaterialCardsForReview: vi.fn(),
  updateAdminMaterialCard: vi.fn(),
  deleteAdminMaterialCard: vi.fn(),
  bulkApproveAdminMaterialCards: vi.fn(),
  bulkDeleteAdminMaterialCards: vi.fn(),
  writeAdminMaterialAuditLog: vi.fn(),
  // studentMaterialsRouter's own imports, mocked here too since both router
  // test files below import from the same module.
  getPublishedAdminMaterialForStudent: vi.fn(),
  getPublishedAdminMaterialCardsForStudent: vi.fn(),
  getStudentMaterialProgress: vi.fn(),
  listPublishedAdminMaterialsForStudents: vi.fn(),
  rateAdminMaterialCard: vi.fn(),
  recordAdminMaterialView: vi.fn(),
}));
vi.mock("../queue/client", () => ({ publishMessage: vi.fn() }));

import { adminMaterialsRouter } from "./adminMaterialsRouter";
import { studentMaterialsRouter } from "./studentMaterialsRouter";
import {
  getPublishedAdminMaterialForStudent,
  listAdminMaterials,
} from "../db-admin-materials";

const mockList = listAdminMaterials as unknown as ReturnType<typeof vi.fn>;
const mockGetPublished =
  getPublishedAdminMaterialForStudent as unknown as ReturnType<typeof vi.fn>;

function callerAs(role: "user" | "admin") {
  return adminMaterialsRouter.createCaller({
    user: {
      id: "u1",
      email: "test@example.com",
      name: "Test",
      role,
      passwordHash: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: null,
    },
  });
}

describe("adminMaterialsRouter permissions", () => {
  it("rejects a normal user (role=user) from any admin procedure", async () => {
    const caller = callerAs("user");
    await expect(caller.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows an admin (role=admin) through the same procedure", async () => {
    mockList.mockResolvedValue([]);
    const caller = callerAs("admin");
    await expect(caller.list({})).resolves.toEqual([]);
  });

  it("rejects an unauthenticated (no user) caller", async () => {
    const caller = adminMaterialsRouter.createCaller({ user: null });
    await expect(caller.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("studentMaterialsRouter visibility", () => {
  const as = (role: "user" | "admin") =>
    studentMaterialsRouter.createCaller({
      user: {
        id: "u2",
        email: `${role}@example.com`,
        name: role,
        role,
        passwordHash: "",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: null,
      },
    });

  it("🔒 a student is refused every procedure, even calling it directly", async () => {
    mockGetPublished.mockResolvedValue({ id: "m1" });
    const student = as("user");
    await expect(student.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(student.get({ materialId: "m1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(student.cards({ materialId: "m1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      student.rateCard({ materialCardId: "c1", rating: "good" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      studentMaterialsRouter.createCaller({ user: null }).list()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockGetPublished).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a material that isn't published, even to an admin by id", async () => {
    // Simulates a draft/processing/failed/archived material — the DB helper
    // itself is what enforces status="published"; here it returns null,
    // proving the router never overrides that with the requested id.
    mockGetPublished.mockResolvedValue(null);
    await expect(
      as("admin").get({ materialId: "some-draft-material-id" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
