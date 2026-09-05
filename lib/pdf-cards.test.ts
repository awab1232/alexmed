import { describe, expect, it } from "vitest";
import {
  findMissingPageNumbers,
  normalizePageText,
  splitPageInputsIntoBatches,
} from "./pdf-cards";

describe("normalizePageText", () => {
  it("normalizes extracted page text without changing its meaning", () => {
    expect(
      normalizePageText(
        "  Question   one  \n\n\n Answer" + String.fromCharCode(0) + "  "
      )
    ).toBe("Question   one\n\n Answer");
  });
});

describe("findMissingPageNumbers", () => {
  it("reports every missing PDF page in order", () => {
    expect(
      findMissingPageNumbers([{ page: 1 }, { page: 3 }, { page: 5 }], 5)
    ).toEqual([2, 4]);
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
    expect(
      batches
        .flat()
        .map(page => page.text)
        .join("\n")
    ).toContain("one");
    expect(
      batches
        .flat()
        .map(page => page.text)
        .join("\n")
    ).toContain("two");
  });
});
