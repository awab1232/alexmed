import { describe, expect, it } from "vitest";
import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/pdf/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/pdf/upload-url", () => {
  it("rejects a fileName that isn't a .pdf", async () => {
    const response = await POST(jsonRequest({ fileName: "notes.txt", fileSize: 1000 }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("PDF");
  });

  it("rejects a file larger than the configured max", async () => {
    const oversized = (Number(process.env.UPLOAD_MAX_MB) || 250) * 1024 * 1024 + 1;
    const response = await POST(jsonRequest({ fileName: "book.pdf", fileSize: oversized }));
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toMatch(/MB/);
  });

  it("rejects a missing/invalid fileSize", async () => {
    const response = await POST(jsonRequest({ fileName: "book.pdf" }));
    const body = await response.json();

    expect(response.status).toBe(400);
  });
});
