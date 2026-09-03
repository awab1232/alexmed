import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/pdf/ocr", () => {
  it("rejects OCR requests without a stored PDF and page list", async () => {
    const response = await POST(
      new Request("http://localhost/api/pdf/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("مصوّرة");
  });
});
