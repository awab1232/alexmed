import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../billing/subscriptions", () => ({
  adminActivatePlan: vi.fn(),
  adminCancelSubscription: vi.fn(),
  adminChangePlan: vi.fn(),
  adminExpireSubscription: vi.fn(),
  adminExtendSubscription: vi.fn(),
  adminResetUsage: vi.fn(),
  approvePaymentRequest: vi.fn(),
  rejectPaymentRequest: vi.fn(),
}));
vi.mock("../billing/admin-queries", () => ({
  getBillingOverview: vi.fn(),
  getBillingUserDetail: vi.fn(),
  listPaymentRequests: vi.fn(),
  searchBillingUsers: vi.fn(),
}));
vi.mock("../billing/plans", () => ({
  getAllPlans: vi.fn(),
  getBillingSettings: vi.fn(),
  updateBillingSettings: vi.fn(),
  updatePlan: vi.fn(),
}));

import { adminBillingRouter } from "./adminBillingRouter";
import {
  adminActivatePlan,
  approvePaymentRequest,
} from "../billing/subscriptions";

const mockActivate = adminActivatePlan as unknown as ReturnType<typeof vi.fn>;
const mockApprove = approvePaymentRequest as unknown as ReturnType<
  typeof vi.fn
>;

const USER_ID = "4b7c2a53-8f1e-4c1a-9d5e-2f6a8b9c0d1e";
const REQUEST_ID = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";

function caller(role: "user" | "admin") {
  return adminBillingRouter.createCaller({
    user: {
      id: "actor-1",
      email: "actor@example.invalid",
      name: "Actor",
      role,
      passwordHash: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: null,
    },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("adminBillingRouter access", () => {
  it("refuses students (FORBIDDEN) and never touches subscriptions", async () => {
    await expect(
      caller("user").activate({ userId: USER_ID, planId: "pro", months: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller("user").approve({ requestId: REQUEST_ID })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockActivate).not.toHaveBeenCalled();
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it("refuses signed-out callers", async () => {
    await expect(
      adminBillingRouter
        .createCaller({ user: null } as never)
        .activate({ userId: USER_ID, planId: "pro", months: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets admins activate a plan, audited with the admin's own id", async () => {
    mockActivate.mockResolvedValue({ id: "sub-1" });
    await caller("admin").activate({
      userId: USER_ID,
      planId: "pro",
      months: 1,
    });
    expect(mockActivate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        planId: "pro",
        months: 1,
        adminId: "actor-1",
      })
    );
  });

  it("rejects out-of-range durations before reaching the database", async () => {
    await expect(
      caller("admin").activate({ userId: USER_ID, planId: "pro", months: 0 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockActivate).not.toHaveBeenCalled();
  });
});
