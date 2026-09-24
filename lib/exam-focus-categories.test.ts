import { describe, expect, it } from "vitest";
import {
  SWIPE_THRESHOLD_PX,
  categoryInfo,
  shouldPrefetch,
  splitHighlights,
  stepIndex,
  swipeDirection,
  visibleCategoryFilters,
} from "./exam-focus-categories";

describe("swipe navigation", () => {
  it("swipe left = next, swipe right = previous", () => {
    expect(swipeDirection(-SWIPE_THRESHOLD_PX - 5)).toBe("next");
    expect(swipeDirection(SWIPE_THRESHOLD_PX + 5)).toBe("previous");
  });

  it("ignores short drags and vertical scrolls of a long card", () => {
    expect(swipeDirection(-20)).toBeNull();
    expect(swipeDirection(-90, 140)).toBeNull();
  });

  it("previous/next stay inside the deck", () => {
    expect(stepIndex(0, "previous", 10)).toBe(0);
    expect(stepIndex(0, "next", 10)).toBe(1);
    expect(stepIndex(9, "next", 10)).toBe(9);
    expect(stepIndex(5, "previous", 10)).toBe(4);
    expect(stepIndex(3, "next", 0)).toBe(0);
  });

  it("prefetches the next page a few cards before the loaded end", () => {
    expect(shouldPrefetch(10, 40, 247)).toBe(false);
    expect(shouldPrefetch(35, 40, 247)).toBe(true);
    expect(shouldPrefetch(245, 247, 247)).toBe(false); // everything loaded
    expect(shouldPrefetch(120, 40, 247)).toBe(true); // restored deep position
  });
});

describe("filters", () => {
  it("shows only the categories present in the deck, by priority", () => {
    expect(
      visibleCategoryFilters({ treatment: 4, emergency: 2, bogus: 9 }).map(
        f => f.category
      )
    ).toEqual(["emergency", "treatment"]);
    expect(visibleCategoryFilters({})).toEqual([]);
  });

  it("falls back to High Yield for an unknown category label", () => {
    expect(categoryInfo("nope").label).toBe("High Yield");
    expect(categoryInfo("exam_trap").label).toBe("Exam Trap");
  });
});

describe("splitHighlights", () => {
  it("marks numbers, ranges and units without touching the rest", () => {
    const text = "Irrigate for 15–30 minutes until pH 7.4, give 500 mg";
    const segments = splitHighlights(text);
    const highlighted = segments.filter(s => s.highlight).map(s => s.text);
    expect(highlighted).toEqual(["15–30 minutes", "7.4", "500 mg"]);
    expect(segments.map(s => s.text).join("")).toBe(text);
  });

  it("returns the text untouched when there are no numbers", () => {
    expect(splitHighlights("Alkali penetrates deeply")).toEqual([
      { text: "Alkali penetrates deeply", highlight: false },
    ]);
  });
});
