import { describe, expect, it } from "vitest";
import { findSourceHighlight } from "./text-source-match";

describe("findSourceHighlight", () => {
  it("finds an exact verbatim match", () => {
    const page =
      "Page 2\nHoarseness of voice (HOV) is the earliest and most common symptom due to direct involvement of the vocal cords.\nNext paragraph.";
    const answer =
      "Hoarseness of voice (HOV) is the earliest and most common symptom due to direct involvement of the vocal cords.";
    const range = findSourceHighlight(page, answer);
    expect(range).not.toBeNull();
    expect(page.slice(range!.start, range!.end)).toBe(answer);
  });

  it("is case-insensitive", () => {
    const page = "the vocal cords vibrate to produce sound in the larynx.";
    const answer = "The Vocal Cords Vibrate To Produce Sound";
    const range = findSourceHighlight(page, answer);
    expect(range).not.toBeNull();
    expect(page.slice(range!.start, range!.end).toLowerCase()).toBe(
      answer.toLowerCase()
    );
  });

  it("finds a full sentence quoted verbatim inside a longer paraphrased answer", () => {
    const page =
      "Background info. Acute mastoiditis is more common in children due to the anatomy of their eustachian tubes. More context follows.";
    // Paraphrased answer: the second sentence is a literal source quote.
    const answer =
      "This is a key fact to remember. Acute mastoiditis is more common in children due to the anatomy of their eustachian tubes.";
    const range = findSourceHighlight(page, answer);
    expect(range).not.toBeNull();
    expect(page.slice(range!.start, range!.end)).toBe(
      "Acute mastoiditis is more common in children due to the anatomy of their eustachian tubes."
    );
  });

  it("falls back to fuzzy longest-common-substring for heavily reworded answers", () => {
    const page =
      "Juvenile nasopharyngeal angiofibroma is a benign but highly vascular tumor arising from the sphenopalatine foramen, typically in adolescent males.";
    const answer =
      "JNA is a benign but highly vascular tumor arising from the sphenopalatine foramen.";
    const range = findSourceHighlight(page, answer);
    expect(range).not.toBeNull();
    expect(range!.end - range!.start).toBeGreaterThanOrEqual(20);
  });

  it("returns null when there is no meaningful overlap", () => {
    const page = "This page discusses an entirely unrelated topic in detail.";
    const answer = "Completely different clinical fact about something else.";
    expect(findSourceHighlight(page, answer)).toBeNull();
  });

  it("returns null for missing inputs", () => {
    expect(findSourceHighlight(null, "answer")).toBeNull();
    expect(findSourceHighlight("page text", null)).toBeNull();
    expect(findSourceHighlight("page text", "")).toBeNull();
  });
});
