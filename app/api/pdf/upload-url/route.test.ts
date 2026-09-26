import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
// The plan's maximum file size (lib/billing) — a fake Free plan of 100 MB,
// no database.
vi.mock("@/lib/billing/usage", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/billing/usage")>();
  return {
    ...actual,
    assertFileSizeAllowed: vi.fn(async (_userId: string, bytes: number) => {
      if (bytes <= 100 * 1024 * 1024) return { id: "free" };
      throw new actual.BillingError(
        {
          code: "FILE_SIZE_LIMIT",
          planId: "free",
          planName: "Free",
          maxFileSizeMb: 100,
          actualFileSizeMb: bytes / (1024 * 1024),
          upgradePlanId: "pro",
          upgradePlanName: "Pro",
          upgradeValue: 250,
        },
        "باقة Free تدعم ملفات حتى 100MB. رقِّ إلى Pro لملفات حتى 250MB."
      );
    }),
  };
});

import { auth } from "@/lib/auth";
import { POST } from "./route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/pdf/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/pdf/upload-url", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockAuth.mockResolvedValue({ user: { id: "u1", email: "a@example.com" } });
  });

  it("rejects an unauthenticated request", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await POST(
      jsonRequest({ fileName: "book.pdf", fileSize: 1000 })
    );
    expect(response.status).toBe(401);
  });

  it("rejects a fileName that isn't a .pdf", async () => {
    const response = await POST(
      jsonRequest({ fileName: "notes.txt", fileSize: 1000 })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("PDF");
  });

  it("rejects a file larger than the student's plan allows, with the upgrade", async () => {
    const oversized = 100 * 1024 * 1024 + 1;
    const response = await POST(
      jsonRequest({ fileName: "book.pdf", fileSize: oversized })
    );
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toMatch(/MB/);
    expect(body.code).toBe("FILE_SIZE_LIMIT");
    expect(body.details).toMatchObject({
      maxFileSizeMb: 100,
      upgradePlanId: "pro",
    });
  });

  it("rejects a missing/invalid fileSize", async () => {
    const response = await POST(jsonRequest({ fileName: "book.pdf" }));
    expect(response.status).toBe(400);
  });
});
