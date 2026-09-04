import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { POST } from "./route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/pdf/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/pdf/extract", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockAuth.mockResolvedValue({ user: { id: "u1", email: "a@example.com" } });
  });

  it("rejects an unauthenticated request", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await POST(
      jsonRequest({ key: "study-pdfs/abc-notes.pdf", fileName: "notes.pdf", fileSize: 100 })
    );
    expect(response.status).toBe(401);
  });

  it("rejects an extraction request with no storage key", async () => {
    const response = await POST(
      jsonRequest({ fileName: "notes.pdf", fileSize: 100 })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("PDF");
  });

  it("rejects a fileName that isn't a .pdf", async () => {
    const response = await POST(
      jsonRequest({
        key: "study-pdfs/abc-notes.txt",
        fileName: "notes.txt",
        fileSize: 100,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("PDF");
  });
});
