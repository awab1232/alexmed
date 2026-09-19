import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTextFromDetections,
  isNemotronOcrConfigured,
  nemotronOcrPage,
} from "./nemotron-ocr";

describe("isNemotronOcrConfigured", () => {
  const original = process.env.NVIDIA_OCR_API_KEY;
  afterEach(() => {
    process.env.NVIDIA_OCR_API_KEY = original;
  });

  it("is false when the key is unset", () => {
    delete process.env.NVIDIA_OCR_API_KEY;
    expect(isNemotronOcrConfigured()).toBe(false);
  });

  it("is true when the key is set", () => {
    process.env.NVIDIA_OCR_API_KEY = "nvapi-test";
    expect(isNemotronOcrConfigured()).toBe(true);
  });
});

describe("buildTextFromDetections", () => {
  it("returns an empty string for no detections", () => {
    expect(buildTextFromDetections([])).toBe("");
  });

  it("joins detections on the same line left-to-right", () => {
    const text = buildTextFromDetections([
      {
        text_prediction: { text: "world" },
        bounding_box: {
          points: [
            { x: 0.5, y: 0.4 },
            { x: 0.6, y: 0.4 },
            { x: 0.6, y: 0.45 },
            { x: 0.5, y: 0.45 },
          ],
        },
      },
      {
        text_prediction: { text: "hello" },
        bounding_box: {
          points: [
            { x: 0.1, y: 0.4 },
            { x: 0.2, y: 0.4 },
            { x: 0.2, y: 0.45 },
            { x: 0.1, y: 0.45 },
          ],
        },
      },
    ]);
    expect(text).toBe("hello world");
  });

  it("puts distinct lines in top-to-bottom order", () => {
    const text = buildTextFromDetections([
      {
        text_prediction: { text: "second line" },
        bounding_box: {
          points: [
            { x: 0.1, y: 0.8 },
            { x: 0.3, y: 0.8 },
            { x: 0.3, y: 0.85 },
            { x: 0.1, y: 0.85 },
          ],
        },
      },
      {
        text_prediction: { text: "first line" },
        bounding_box: {
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.3, y: 0.1 },
            { x: 0.3, y: 0.15 },
            { x: 0.1, y: 0.15 },
          ],
        },
      },
    ]);
    expect(text).toBe("first line\nsecond line");
  });

  it("skips detections with empty text or no bounding box", () => {
    const text = buildTextFromDetections([
      { text_prediction: { text: "" }, bounding_box: { points: [] } },
      { text_prediction: { text: "kept" } },
    ]);
    expect(text).toBe("");
  });
});

describe("nemotronOcrPage", () => {
  const original = process.env.NVIDIA_OCR_API_KEY;
  beforeEach(() => {
    process.env.NVIDIA_OCR_API_KEY = "nvapi-test";
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    process.env.NVIDIA_OCR_API_KEY = original;
    vi.unstubAllGlobals();
  });

  it("throws when the key is not configured", async () => {
    delete process.env.NVIDIA_OCR_API_KEY;
    await expect(nemotronOcrPage("data:image/png;base64,AA==")).rejects.toThrow(
      "NVIDIA_OCR_API_KEY"
    );
  });

  it("returns hasText:false for an empty detection list (a real, legitimate response)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ index: 0, text_detections: [] }] }),
    });
    const result = await nemotronOcrPage("data:image/png;base64,AA==");
    expect(result).toEqual({ text: "", hasText: false });
  });

  it("parses real detections into page text", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            index: 0,
            text_detections: [
              {
                text_prediction: { text: "Test PDF", confidence: 0.98 },
                bounding_box: {
                  points: [
                    { x: 0.08, y: 0.4 },
                    { x: 0.6, y: 0.4 },
                    { x: 0.6, y: 0.5 },
                    { x: 0.08, y: 0.5 },
                  ],
                },
              },
            ],
          },
        ],
      }),
    });
    const result = await nemotronOcrPage("data:image/png;base64,AA==");
    expect(result).toEqual({ text: "Test PDF", hasText: true });
  });

  it("throws on a non-ok response so the caller can fall back", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "invalid key",
    });
    await expect(nemotronOcrPage("data:image/png;base64,AA==")).rejects.toThrow(
      "401"
    );
  });
});
