import { describe, expect, it } from "vitest";
import { applySrsRating, type SrsCardState } from "./srs";

const NOW = new Date("2026-01-01T00:00:00Z");
const fresh: SrsCardState = {
  easeFactor: 2.5,
  intervalDays: 0,
  reviewCount: 0,
};

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

describe("applySrsRating — first review", () => {
  it("hard: due the same day, ease factor drops", () => {
    const result = applySrsRating(fresh, "hard", NOW);
    expect(result.intervalDays).toBe(0);
    expect(daysBetween(result.dueAt, NOW)).toBe(0);
    expect(result.easeFactor).toBeCloseTo(2.3);
    expect(result.reviewCount).toBe(1);
  });

  it("good: due in 1 day, ease factor unchanged", () => {
    const result = applySrsRating(fresh, "good", NOW);
    expect(result.intervalDays).toBe(1);
    expect(daysBetween(result.dueAt, NOW)).toBe(1);
    expect(result.easeFactor).toBeCloseTo(2.5);
  });

  it("easy: due in 3 days (longer than good), ease factor rises", () => {
    const result = applySrsRating(fresh, "easy", NOW);
    expect(result.intervalDays).toBe(3);
    expect(daysBetween(result.dueAt, NOW)).toBe(3);
    expect(result.easeFactor).toBeCloseTo(2.65);
  });
});

describe("applySrsRating — subsequent reviews", () => {
  it("hard shrinks the interval relative to the current one", () => {
    const card: SrsCardState = {
      easeFactor: 2.5,
      intervalDays: 10,
      reviewCount: 2,
    };
    const result = applySrsRating(card, "hard", NOW);
    expect(result.intervalDays).toBe(5); // round(10 * 0.5)
  });

  it("good grows the interval by the ease factor", () => {
    const card: SrsCardState = {
      easeFactor: 2.5,
      intervalDays: 4,
      reviewCount: 2,
    };
    const result = applySrsRating(card, "good", NOW);
    expect(result.intervalDays).toBe(10); // round(4 * 2.5)
  });

  it("easy grows the interval faster than good", () => {
    const card: SrsCardState = {
      easeFactor: 2.5,
      intervalDays: 4,
      reviewCount: 2,
    };
    const good = applySrsRating(card, "good", NOW);
    const easy = applySrsRating(card, "easy", NOW);
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays);
  });

  it("repeated good/easy ratings compound the interval upward", () => {
    let card: SrsCardState = fresh;
    let previousInterval = -1;
    for (let i = 0; i < 4; i++) {
      const result = applySrsRating(card, "good", NOW);
      expect(result.intervalDays).toBeGreaterThan(previousInterval);
      previousInterval = result.intervalDays;
      card = result;
    }
  });

  it("never gets stuck at a zero interval after an early hard rating", () => {
    // first review "hard" -> intervalDays 0, reviewCount 1
    const afterHard = applySrsRating(fresh, "hard", NOW);
    expect(afterHard.intervalDays).toBe(0);
    // a later "good" review must not multiply 0 by anything and stay at 0
    const afterGood = applySrsRating(afterHard, "good", NOW);
    expect(afterGood.intervalDays).toBeGreaterThanOrEqual(1);
  });
});

describe("applySrsRating — ease factor clamping", () => {
  it("never drops below 1.3 even after many hard ratings", () => {
    let card: SrsCardState = fresh;
    for (let i = 0; i < 20; i++) {
      card = applySrsRating(card, "hard", NOW);
    }
    expect(card.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("never rises above 3.0 even after many easy ratings", () => {
    let card: SrsCardState = fresh;
    for (let i = 0; i < 20; i++) {
      card = applySrsRating(card, "easy", NOW);
    }
    expect(card.easeFactor).toBeLessThanOrEqual(3.0);
  });
});
