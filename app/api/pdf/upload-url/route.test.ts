import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

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
    const response = await POST(jsonRequest({ fileName: "book.pdf", fileSize: 1000 }));
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

  it("rejects a file larger than the configured max", async () => {
    const oversized =
      (Number(process.env.UPLOAD_MAX_MB) || 250) * 1024 * 1024 + 1;
    const response = await POST(
      jsonRequest({ fileName: "book.pdf", fileSize: oversized })
    );
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toMatch(/MB/);
  });

  it("rejects a missing/invalid fileSize", async () => {
    const response = await POST(jsonRequest({ fileName: "book.pdf" }));
    expect(response.status).toBe(400);
  });
});
