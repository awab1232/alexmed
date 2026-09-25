import { describe, expect, it } from "vitest";
import { GK_BANK, GK_CATEGORY_LABELS } from "./general-knowledge-bank";
import {
  GK_RECENT_WINDOW,
  generateGkStage,
  gkDifficulty,
  mergeRecentIds,
  pickGkEntries,
} from "./general-knowledge";
import { createRng } from "./rng";

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

describe("General Knowledge bank — every question is well-formed", () => {
  it("has unique ids and unique question texts", () => {
    expect(new Set(GK_BANK.map(q => q.id)).size).toBe(GK_BANK.length);
    expect(new Set(GK_BANK.map(q => norm(q.question))).size).toBe(
      GK_BANK.length
    );
  });

  it("every question: 4 distinct non-empty options, the answer exactly once", () => {
    for (const q of GK_BANK) {
      const options = [q.answer, ...q.wrong].map(norm);
      expect(options.every(Boolean), q.id).toBe(true);
      expect(new Set(options).size, q.id).toBe(4);
      expect(
        options.filter(o => o === norm(q.answer)),
        q.id
      ).toHaveLength(1);
    }
  });

  it("every question has an explanation, a known category and a difficulty", () => {
    for (const q of GK_BANK) {
      expect(q.question.length, q.id).toBeGreaterThan(8);
      expect(q.explanation.length, q.id).toBeGreaterThan(10);
      expect(Object.keys(GK_CATEGORY_LABELS)).toContain(q.category);
      expect([1, 2, 3, 4]).toContain(q.difficulty);
    }
  });

  it("covers every category and all four difficulties", () => {
    for (const category of Object.keys(GK_CATEGORY_LABELS)) {
      expect(
        GK_BANK.some(q => q.category === category),
        category
      ).toBe(true);
    }
    for (const d of [1, 2, 3, 4]) {
      expect(
        GK_BANK.filter(q => q.difficulty === d).length
      ).toBeGreaterThanOrEqual(30);
    }
  });
});

describe("General Knowledge stages", () => {
  it("maps stages to difficulty (easy → very hard)", () => {
    expect(gkDifficulty(1)).toBe(1);
    expect(gkDifficulty(11)).toBe(2);
    expect(gkDifficulty(31)).toBe(3);
    expect(gkDifficulty(61)).toBe(4);
    expect(gkDifficulty(100)).toBe(4);
  });

  it("every stage: 10 distinct questions with the right answer at correctIndex", () => {
    const byId = new Map(GK_BANK.map(q => [q.id, q]));
    for (let stage = 1; stage <= 100; stage++) {
      const qs = generateGkStage(stage, createRng(stage), 10, []);
      expect(qs).toHaveLength(10);
      expect(new Set(qs.map(q => q.id)).size).toBe(10);
      for (const q of qs) {
        const entry = byId.get(q.id)!;
        expect(q.options[q.correctIndex]).toBe(entry.answer);
        expect(new Set(q.options).size).toBe(4);
        expect(q.explanation).toBe(entry.explanation);
        expect(
          Math.abs(entry.difficulty - gkDifficulty(stage))
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it("does not repeat recently seen questions while unseen ones remain", () => {
    let recent: string[] = [];
    const played: string[][] = [];
    for (let stage = 31; stage <= 34; stage++) {
      const ids = pickGkEntries(stage, 10, createRng(stage), recent).map(
        q => q.id
      );
      played.push(ids);
      recent = mergeRecentIds(recent, ids);
    }
    // 4 consecutive hard stages = 40 questions, all different.
    expect(new Set(played.flat()).size).toBe(40);
  });

  it("when everything was seen, repeats the least recently seen first", () => {
    const pool = GK_BANK.filter(q => q.difficulty === 3 || q.difficulty === 2);
    const recent = pool.map(q => q.id); // all seen, first = oldest
    const picked = pickGkEntries(31, 10, createRng(1), recent).map(q => q.id);
    const oldest = new Set(recent.slice(0, 10));
    expect(picked.every(id => oldest.has(id))).toBe(true);
  });

  it("keeps a bounded recent window", () => {
    const ids = Array.from({ length: 100 }, (_, i) => `x${i}`);
    const merged = mergeRecentIds([], ids);
    expect(merged).toHaveLength(GK_RECENT_WINDOW);
    expect(merged[merged.length - 1]).toBe("x99");
  });
});
