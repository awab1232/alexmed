import { describe, expect, it } from "vitest";
import {
  addHighlight,
  appendPoint,
  eraseStrokesAt,
  removeHighlight,
  segmentText,
  strokePath,
  strokeTouches,
  type Highlight,
  type Stroke,
} from "./card-marks";

const hl = (
  id: string,
  start: number,
  end: number,
  field: Highlight["field"] = "answer",
  color = "#fde68a"
): Highlight => ({ id, field, start, end, color });

describe("addHighlight", () => {
  it("adds a highlight to an empty list", () => {
    expect(addHighlight([], hl("a", 2, 5))).toEqual([hl("a", 2, 5)]);
  });

  it("ignores an empty range", () => {
    expect(addHighlight([], hl("a", 3, 3))).toEqual([]);
  });

  it("lets a new highlight overwrite the overlapped part of an older one", () => {
    const result = addHighlight([hl("old", 0, 10)], hl("new", 5, 15));
    expect(result.map(h => [h.id, h.start, h.end])).toEqual([
      ["old", 0, 5],
      ["new", 5, 15],
    ]);
  });

  it("splits an older highlight when the new one lands in its middle", () => {
    const result = addHighlight(
      [hl("old", 0, 10, "answer", "#fde68a")],
      hl("new", 3, 6, "answer", "#bfdbfe")
    );
    expect(result.map(h => [h.start, h.end, h.color])).toEqual([
      [0, 3, "#fde68a"],
      [3, 6, "#bfdbfe"],
      [6, 10, "#fde68a"],
    ]);
    // The two halves of the split must not share an id.
    expect(new Set(result.map(h => h.id)).size).toBe(3);
  });

  it("removes an older highlight the new one fully covers", () => {
    const result = addHighlight([hl("old", 4, 6)], hl("new", 0, 10));
    expect(result.map(h => h.id)).toEqual(["new"]);
  });

  it("does not touch highlights in a different field", () => {
    const other = hl("q", 0, 10, "question");
    const result = addHighlight([other], hl("a", 0, 10, "answer"));
    expect(result).toHaveLength(2);
    expect(result.find(h => h.id === "q")).toEqual(other);
  });
});

describe("removeHighlight", () => {
  it("removes only the highlight with that id", () => {
    const result = removeHighlight([hl("a", 0, 2), hl("b", 4, 6)], "a");
    expect(result.map(h => h.id)).toEqual(["b"]);
  });
});

describe("segmentText", () => {
  it("returns one plain segment when nothing is highlighted", () => {
    expect(segmentText("hello", [])).toEqual([
      { text: "hello", highlight: null },
    ]);
  });

  it("splits text around highlights and keeps every character", () => {
    const h = hl("a", 6, 11);
    const segments = segmentText("hello world!", [h]);
    expect(segments).toEqual([
      { text: "hello ", highlight: null },
      { text: "world", highlight: h },
      { text: "!", highlight: null },
    ]);
    expect(segments.map(s => s.text).join("")).toBe("hello world!");
  });

  it("clamps a range that runs past the end of the text", () => {
    const segments = segmentText("short", [hl("a", 2, 999)]);
    expect(segments.map(s => s.text)).toEqual(["sh", "ort"]);
  });

  it("never renders the same characters twice for overlapping ranges", () => {
    const segments = segmentText("abcdef", [hl("a", 0, 4), hl("b", 1, 6)]);
    expect(segments.map(s => s.text).join("")).toBe("abcdef");
  });

  it("works with Arabic text", () => {
    const text = "الأنسولين هرمون";
    const segments = segmentText(text, [hl("a", 0, 10)]);
    expect(segments[0].text).toBe("الأنسولين ");
    expect(segments.map(s => s.text).join("")).toBe(text);
  });
});

const stroke = (points: [number, number][], width = 0.006): Stroke => ({
  id: "s",
  color: "#e11d48",
  width,
  points,
});

describe("appendPoint", () => {
  it("adds a point that is far enough from the last one", () => {
    expect(appendPoint([[0, 0]], [0.1, 0])).toEqual([
      [0, 0],
      [0.1, 0],
    ]);
  });

  it("drops a point that is practically on top of the last one", () => {
    const points: [number, number][] = [[0, 0]];
    expect(appendPoint(points, [0.0001, 0])).toBe(points);
  });
});

describe("strokeTouches / eraseStrokesAt", () => {
  const line = stroke([
    [0.1, 0.1],
    [0.5, 0.1],
  ]);

  it("hits a point on the line", () => {
    expect(strokeTouches(line, [0.3, 0.1], 0.01)).toBe(true);
  });

  it("hits within the eraser radius but not beyond it", () => {
    expect(strokeTouches(line, [0.3, 0.115], 0.02)).toBe(true);
    expect(strokeTouches(line, [0.3, 0.2], 0.02)).toBe(false);
  });

  it("does not hit past the end of the segment", () => {
    expect(strokeTouches(line, [0.9, 0.1], 0.02)).toBe(false);
  });

  it("hits a single-point stroke (a dot)", () => {
    expect(strokeTouches(stroke([[0.2, 0.2]]), [0.205, 0.2], 0.02)).toBe(true);
  });

  it("removes only the touched strokes, returning the same array when none", () => {
    const other: Stroke = {
      ...stroke([
        [0.1, 0.8],
        [0.5, 0.8],
      ]),
      id: "other",
    };
    const strokes = [line, other];
    expect(eraseStrokesAt(strokes, [0.3, 0.1], 0.02).map(s => s.id)).toEqual([
      "other",
    ]);
    expect(eraseStrokesAt(strokes, [0.9, 0.5], 0.02)).toBe(strokes);
  });
});

describe("strokePath", () => {
  it("is empty for no points", () => {
    expect(strokePath([], 100)).toBe("");
  });

  it("draws a dot for a single point", () => {
    expect(strokePath([[0.5, 0.5]], 100)).toBe("M 50 50 l 0.01 0");
  });

  it("scales points from card-width units to pixels", () => {
    expect(
      strokePath(
        [
          [0.1, 0.1],
          [0.2, 0.2],
        ],
        200
      )
    ).toBe("M 20 20 L 40 40");
  });

  it("smooths three or more points with quadratic curves", () => {
    const path = strokePath(
      [
        [0, 0],
        [0.1, 0.1],
        [0.2, 0],
      ],
      100
    );
    expect(path).toBe("M 0 0 Q 10 10 15 5 L 20 0");
  });
});
