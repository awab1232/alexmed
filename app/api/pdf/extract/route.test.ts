import { describe, expect, it } from "vitest";
import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/pdf/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/pdf/extract", () => {
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
