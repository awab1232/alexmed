import { describe, expect, it } from "vitest";
import {
  MIRROR_TEXT_MAX_CHARS,
  estimateQuestionCount,
  normalizeQuestionText,
  splitTextIntoPages,
  validateQuestionText,
} from "./mirror-text";

describe("normalizeQuestionText", () => {
  it("unifies line endings and collapses runs of blank lines", () => {
    expect(normalizeQuestionText("a\r\nb\r\n\r\n\r\n\r\nc")).toBe("a\nb\n\nc");
  });

  it("strips zero-width and control characters but keeps RTL marks", () => {
    expect(normalizeQuestionText("a\u200bb\ufeffc\u0000d\u200fe")).toBe(
      "abcd\u200fe"
    );
  });

  it("trims trailing spaces on each line and the whole text", () => {
    expect(normalizeQuestionText("  a  \nb \t\n")).toBe("a\nb");
  });
});

describe("validateQuestionText", () => {
  it("rejects text that is too short", () => {
    const result = validateQuestionText("  1. hi  ");
    expect(result.ok).toBe(false);
  });

  it("rejects text over the size limit with a hint to add a second batch", () => {
    const result = validateQuestionText("x".repeat(MIRROR_TEXT_MAX_CHARS + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("60,000");
  });

  it("returns the normalized text when valid", () => {
    const result = validateQuestionText(
      "1. What is the first-line treatment?\r\n\r\n\r\n2. Name the enzyme."
    );
    expect(result).toEqual({
      ok: true,
      text: "1. What is the first-line treatment?\n\n2. Name the enzyme.",
    });
  });
});

describe("estimateQuestionCount", () => {
  it("counts numbered questions in several styles", () => {
    const text = [
      "1. First",
      "2) Second",
      "Q3 Third",
      "Question 4: Fourth",
      "س5 الخامس",
      "السؤال 6 السادس",
    ].join("\n");
    expect(estimateQuestionCount(text)).toBe(6);
  });

  it("does not count lettered answer options", () => {
    const text = "1. Which one?\nA. red\nB. blue\nC. green\n2. Next?\nA. yes";
    expect(estimateQuestionCount(text)).toBe(2);
  });

  it("returns 0 when there is no numbering", () => {
    expect(estimateQuestionCount("just some notes\nwithout numbers")).toBe(0);
  });
});

describe("splitTextIntoPages", () => {
  it("returns no pages for empty text", () => {
    expect(splitTextIntoPages("   \n\n ")).toEqual([]);
  });

  it("keeps short text on one page, numbered from 1", () => {
    const pages = splitTextIntoPages("1. One?\n\n2. Two?");
    expect(pages).toEqual([
      { page: 1, text: "1. One?\n\n2. Two?", hasText: true },
    ]);
  });

  it("splits long text into several pages without losing any question", () => {
    const questions = Array.from(
      { length: 60 },
      (_, i) => `${i + 1}. ${"question body ".repeat(15).trim()}`
    );
    const pages = splitTextIntoPages(questions.join("\n\n"));
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.map(p => p.page)).toEqual(pages.map((_, i) => i + 1));
    const joined = pages.map(p => p.text).join("\n\n");
    for (let i = 1; i <= 60; i++) expect(joined).toContain(`${i}. question`);
  });

  it("never splits a question from its options when the text has no blank lines", () => {
    const questions = Array.from(
      { length: 40 },
      (_, i) =>
        `${i + 1}. ${"stem ".repeat(30).trim()}\nA. one\nB. two\nC. three\nD. four`
    );
    const pages = splitTextIntoPages(questions.join("\n"));
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      // Every page must start at a question, i.e. no page begins with an option.
      expect(page.text).toMatch(/^\d+\. /);
    }
  });

  it("falls back to single lines when there is no numbering or blank lines", () => {
    const text = Array.from({ length: 200 }, (_, i) => `note line ${i}`).join(
      "\n"
    );
    const pages = splitTextIntoPages(text);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.map(p => p.text).join("\n\n")).toContain("note line 199");
  });
});
