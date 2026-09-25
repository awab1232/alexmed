// ✖️ Multiplication — tables first, then harder products. Time limits grow
// back up for the multi-digit tiers so they stay doable, not impossible.
import type { QuizQuestion } from "./games";
import { numericOptions } from "./distractors";
import type { Rng } from "./rng";

export type MultiplicationTier = {
  timeLimitMs: number;
  a: [number, number];
  b: [number, number];
};

// 1–10: tables 2–5 · 11–25: tables 2–10 · 26–40: mixed up to 12×12 ·
// 41–60: 2-digit × 1-digit (17 × 6) · 61–80: bigger 2-digit × 1-digit ·
// 81–100: 2-digit × 2-digit (24 × 13).
export function multiplicationTier(stage: number): MultiplicationTier {
  if (stage <= 10) return { timeLimitMs: 8000, a: [2, 5], b: [1, 10] };
  if (stage <= 25) return { timeLimitMs: 8000, a: [2, 10], b: [2, 10] };
  if (stage <= 40) return { timeLimitMs: 7000, a: [3, 12], b: [3, 12] };
  if (stage <= 60) return { timeLimitMs: 8000, a: [11, 19], b: [2, 9] };
  if (stage <= 80) return { timeLimitMs: 9000, a: [12, 49], b: [3, 9] };
  return { timeLimitMs: 12000, a: [11, 25], b: [11, 19] };
}

export function generateMultiplicationStage(
  stage: number,
  rng: Rng,
  count: number
): QuizQuestion[] {
  const tier = multiplicationTier(stage);
  const questions: QuizQuestion[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (questions.length < count && guard++ < count * 60) {
    const a = rng.int(tier.a[0], tier.a[1]);
    const b = rng.int(tier.b[0], tier.b[1]);
    // 7 × 8 and 8 × 7 are the same fact — only one per stage.
    const key = [a, b].sort((x, y) => x - y).join("x");
    if (seen.has(key)) continue;
    seen.add(key);
    const [left, right] = rng.next() < 0.5 ? [a, b] : [b, a];
    const answer = a * b;
    const { options, correctIndex } = numericOptions(answer, rng, [
      (a + 1) * b,
      (a - 1) * b,
      a * (b + 1),
      a * (b - 1),
      answer + 10,
      answer - 10,
    ]);
    questions.push({
      id: `mul-${stage}-${questions.length}`,
      prompt: `${left} × ${right} = ?`,
      instruction: "Solve",
      options,
      correctIndex,
      timeLimitMs: tier.timeLimitMs,
    });
  }
  return questions;
}
