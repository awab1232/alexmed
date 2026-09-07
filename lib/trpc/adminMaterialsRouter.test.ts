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
const mockGetPublished = getPublishedAdminMaterialForStudent as unknown as ReturnType<
  typeof vi.fn
>;

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
  it("returns NOT_FOUND for a material that isn't published, even a normal user's own request by id", async () => {
    // Simulates a draft/processing/failed/archived material — the DB helper
    // itself is what enforces status="published"; here it returns null,
    // proving the router never overrides that with the requested id.
    mockGetPublished.mockResolvedValue(null);
    const caller = studentMaterialsRouter.createCaller({
      user: {
        id: "u2",
        email: "student@example.com",
        name: "Student",
        role: "user",
        passwordHash: "",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: null,
      },
    });
    await expect(
      caller.get({ materialId: "some-draft-material-id" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
