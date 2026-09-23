import { describe, expect, it } from "vitest";
import {
  MAX_PDF_HIGHLIGHTS,
  addPdfHighlight,
  emptyPageMarks,
  isEmptyPageMarks,
  removePdfHighlight,
  type PdfHighlight,
} from "./pdf-marks";

function makeHighlight(id: string): PdfHighlight {
  return { id, color: "#fde68a", rects: [{ x: 0, y: 0, width: 0.2, height: 0.02 }] };
}

describe("emptyPageMarks / isEmptyPageMarks", () => {
  it("starts empty", () => {
    expect(isEmptyPageMarks(emptyPageMarks())).toBe(true);
  });

  it("is non-empty once a highlight or stroke exists", () => {
    expect(
      isEmptyPageMarks({ highlights: [makeHighlight("a")], strokes: [] })
    ).toBe(false);
    expect(
      isEmptyPageMarks({
        highlights: [],
        strokes: [{ id: "s", color: "#000", width: 0.01, points: [[0, 0]] }],
      })
    ).toBe(false);
  });
});

describe("addPdfHighlight", () => {
  it("appends a highlight with rects", () => {
    const result = addPdfHighlight([], makeHighlight("a"));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });

  it("drops a highlight with no rects", () => {
    const result = addPdfHighlight([], { id: "a", color: "#fde68a", rects: [] });
    expect(result).toHaveLength(0);
  });

  it("never exceeds MAX_PDF_HIGHLIGHTS", () => {
    let highlights: PdfHighlight[] = [];
    for (let i = 0; i < MAX_PDF_HIGHLIGHTS + 10; i++) {
      highlights = addPdfHighlight(highlights, makeHighlight(`h${i}`));
    }
    expect(highlights).toHaveLength(MAX_PDF_HIGHLIGHTS);
  });

  it("keeps two overlapping highlights in different colours (unlike card highlights)", () => {
    const first = addPdfHighlight([], makeHighlight("a"));
    const second = addPdfHighlight(first, { ...makeHighlight("b"), color: "#bfdbfe" });
    expect(second).toHaveLength(2);
  });
});

describe("removePdfHighlight", () => {
  it("removes only the matching id", () => {
    const highlights = [makeHighlight("a"), makeHighlight("b")];
    expect(removePdfHighlight(highlights, "a")).toEqual([makeHighlight("b")]);
  });
});
