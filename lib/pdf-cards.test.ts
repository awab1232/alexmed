import { describe, expect, it } from "vitest";
import { normalizePageText, splitPageInputsIntoBatches } from "./pdf-cards";

describe("normalizePageText", () => {
  it("normalizes extracted page text without changing its meaning", () => {
    expect(
      normalizePageText(
        "  Question   one  \n\n\n Answer" + String.fromCharCode(0) + "  "
      )
    ).toBe("Question   one\n\n Answer");
  });
});

describe("splitPageInputsIntoBatches", () => {
  it("keeps all pages and splits a dense page without dropping text", () => {
    const pages = [
      { page: 1, text: "one\n" + "a".repeat(12) },
      { page: 2, text: "two" },
    ];
    const batches = splitPageInputsIntoBatches(pages, 10);
    expect(batches.flat().map(page => page.page)).toEqual([1, 1, 1, 2]);
    expect(batches.flat().map(page => page.text).join("\n")).toContain("one");
    expect(batches.flat().map(page => page.text).join("\n")).toContain("two");
  });
});
