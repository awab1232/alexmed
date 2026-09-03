import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { normalizePageText, registerPdfRoutes } from "./pdfRoutes";

describe("PDF study-card routes", () => {
  it("normalizes extracted page text without changing its meaning", () => {
    expect(normalizePageText("  Question   one  \n\n\n Answer\u0000  ")).toBe("Question   one\n\n Answer");
  });

  it("rejects an extraction request that has no file", async () => {
    const app = express();
    app.use(express.json());
    registerPdfRoutes(app);

    const response = await request(app).post("/api/pdf/extract");

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("PDF");
  });

  it("rejects non-PDF uploads before calling the parser", async () => {
    const app = express();
    app.use(express.json());
    registerPdfRoutes(app);

    const response = await request(app)
      .post("/api/pdf/extract")
      .attach("file", Buffer.from("not a pdf"), { filename: "notes.txt", contentType: "text/plain" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("PDF");
  });

  it("rejects OCR requests without a stored PDF and page list", async () => {
    const app = express();
    app.use(express.json());
    registerPdfRoutes(app);

    const response = await request(app).post("/api/pdf/ocr").send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("مصوّرة");
  });
});
