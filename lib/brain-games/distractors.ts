import type { Rng } from "./rng";

// Plausible wrong answers for a numeric question: the mistakes people
// actually make (off by one/two, a carry slip of ±10, swapped digits, one
// factor off by one) — never 63 vs 1000. Always 3 distinct, non-negative
// values different from the answer, so exactly one option is correct.
export function numericOptions(
  answer: number,
  rng: Rng,
  extraCandidates: number[] = []
): { options: string[]; correctIndex: number } {
  const candidates = new Set<number>();
  // A mistake far from the answer (e.g. 28 ↔ 82 digit swap) gives the
  // answer away; only close values are tempting.
  const maxDistance = Math.max(30, Math.round(answer * 0.3));
  const add = (value: number) => {
    if (
      Number.isInteger(value) &&
      value >= 0 &&
      value !== answer &&
      Math.abs(value - answer) <= maxDistance
    ) {
      candidates.add(value);
    }
  };
  extraCandidates.forEach(add);
  const swapped = Number(String(answer).split("").reverse().join(""));
  if (answer >= 10 && swapped !== answer) add(swapped);
  for (const delta of [1, -1, 2, -2, 10, -10, 9, -9, 11, -11, 3, -3, 5, -5]) {
    add(answer + delta);
  }
  // Keep the closest, most tempting mistakes, but vary them per question
  // so the right answer can't be spotted as "the middle value".
  // Caller-supplied mistakes (e.g. one factor off by one) come first.
  const extras = extraCandidates.filter(value => candidates.has(value));
  const ranked = [...candidates]
    .filter(value => !extras.includes(value))
    .sort((a, b) => Math.abs(a - answer) - Math.abs(b - answer));
  const pool = Array.from(new Set([...extras, ...ranked])).slice(
    0,
    Math.max(6, extras.length + 2)
  );
  const wrong = rng.shuffle(pool).slice(0, 3);
  // Fallback for tiny answers where few candidates exist (answer 0/1).
  let pad = answer + 4;
  while (wrong.length < 3) {
    if (!wrong.includes(pad) && pad !== answer) wrong.push(pad);
    pad += 1;
  }
  const values = rng.shuffle([answer, ...wrong]);
  return {
    options: values.map(String),
    correctIndex: values.indexOf(answer),
  };
}
