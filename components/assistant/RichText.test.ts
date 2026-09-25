import { describe, expect, it } from "vitest";
import { parseBlocks, tidyMath, tidySource } from "./RichText";

describe("RichText tidyMath (LaTeX the model slipped in)", () => {
  it("turns the model's real cardiac-output answer into readable text", () => {
    const source = [
      "\\[",
      "CO = 75 \\ \\text{beat/min} \\times 70 \\ \\text{mL/beat}",
      "\\]",
      "لأن \\(1000 \\text{ mL} = 1 \\text{ L}\\).",
    ].join("\n");
    expect(tidySource(source).split("\n")).toEqual([
      "",
      "CO = 75 beat/min × 70 mL/beat",
      "",
      "لأن 1000 mL = 1 L.",
    ]);
  });

  it("handles fractions, roots, powers and symbols", () => {
    expect(tidyMath("\\frac{a+b}{2} \\approx \\sqrt{x^2} \\geq 3")).toBe(
      "(a+b)/(2) ≈ √(x²) ≥ 3"
    );
    expect(tidyMath("v_{max} = 10^{3} \\cdot \\Delta P")).toBe(
      "v_max = 10³ · Δ P"
    );
    expect(tidyMath("\\left( x \\right) \\to y")).toBe("( x ) → y");
  });

  it("leaves code blocks untouched", () => {
    const source = "```\nprint('\\times')\n```";
    expect(tidySource(source)).toBe(source);
  });
});

describe("RichText parseBlocks", () => {
  it("recognises headings, lists, code, tables and paragraphs", () => {
    const blocks = parseBlocks(
      [
        "### الخلاصة",
        "النتاج القلبي **مهم**.",
        "سطر ثانٍ",
        "",
        "- أولاً",
        "- ثانيًا",
        "  تكملة",
        "1. خطوة",
        "2. خطوة",
        "```",
        "const x = 1;",
        "```",
        "| A | B |",
        "|---|---|",
        "| 1 | 2 |",
        "> ملاحظة",
      ].join("\n")
    );
    expect(blocks.map(block => block.kind)).toEqual([
      "heading",
      "paragraph",
      "list",
      "list",
      "code",
      "table",
      "quote",
    ]);
    expect(blocks[1]).toEqual({
      kind: "paragraph",
      text: "النتاج القلبي **مهم**.\nسطر ثانٍ",
    });
    expect(blocks[2]).toEqual({
      kind: "list",
      ordered: false,
      items: ["أولاً", "ثانيًا\nتكملة"],
    });
    expect(blocks[3]).toMatchObject({ ordered: true, items: ["خطوة", "خطوة"] });
    expect(blocks[4]).toEqual({ kind: "code", text: "const x = 1;" });
    expect(blocks[5]).toEqual({
      kind: "table",
      header: ["A", "B"],
      rows: [["1", "2"]],
    });
  });

  it("keeps a lone pipe line or unfinished code as plain content", () => {
    expect(parseBlocks("a | b")).toEqual([{ kind: "paragraph", text: "a | b" }]);
    expect(parseBlocks("```\nstill streaming")).toEqual([
      { kind: "code", text: "still streaming" },
    ]);
  });
});
