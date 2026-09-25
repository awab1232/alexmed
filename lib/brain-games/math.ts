// ➕ Math Challenge — procedural question generator with a calibrated
// difficulty curve. Every question is one of several shapes (not just
// A + B); multiplication only appears from stage 76.
import type { QuizQuestion } from "./games";
import { numericOptions } from "./distractors";
import type { Rng } from "./rng";

export type MathShape =
  | "add"
  | "sub"
  | "missing_addend"
  | "reverse_sub"
  | "missing_minuend"
  | "mixed3"
  | "mul_add"
  | "mul_sub";

export type MathTier = {
  timeLimitMs: number;
  shapes: MathShape[];
  // Largest operand used at this stage (grows smoothly inside the tier).
  maxOperand: number;
};

// Stage 1–10: small add/sub, 8s · 11–25: 2-digit incl. missing numbers, 7s
// · 26–50: mixed three-term, 6s · 51–75: harder (3-digit), 5s · 76+: adds
// small multiplication combos, 5s.
export function mathTier(stage: number): MathTier {
  const within = (from: number, to: number, min: number, max: number) =>
    Math.round(
      min + ((Math.min(stage, to) - from) / (to - from)) * (max - min)
    );
  if (stage <= 10) {
    return {
      timeLimitMs: 8000,
      shapes: ["add", "sub"],
      maxOperand: within(1, 10, 12, 40),
    };
  }
  if (stage <= 25) {
    return {
      timeLimitMs: 7000,
      shapes: [
        "add",
        "sub",
        "missing_addend",
        "reverse_sub",
        "missing_minuend",
      ],
      maxOperand: within(11, 25, 45, 99),
    };
  }
  const withMixed: MathShape[] = [
    "add",
    "sub",
    "missing_addend",
    "reverse_sub",
    "missing_minuend",
    "mixed3",
    "mixed3",
  ];
  if (stage <= 50) {
    return {
      timeLimitMs: 6000,
      shapes: withMixed,
      maxOperand: within(26, 50, 60, 150),
    };
  }
  if (stage <= 75) {
    return {
      timeLimitMs: 5000,
      shapes: withMixed,
      maxOperand: within(51, 75, 150, 400),
    };
  }
  return {
    timeLimitMs: 5000,
    shapes: [
      "add",
      "sub",
      "missing_addend",
      "reverse_sub",
      "mixed3",
      "mul_add",
      "mul_sub",
    ],
    maxOperand: within(76, 100, 150, 500),
  };
}

type Built = {
  prompt: string;
  instruction: string;
  answer: number;
  extras: number[];
};

const MINUS = "−";

function build(shape: MathShape, rng: Rng, max: number): Built {
  const lo = Math.max(2, Math.floor(max / 6));
  const operand = () => rng.int(lo, max);
  switch (shape) {
    case "add": {
      const a = operand();
      const b = operand();
      return {
        prompt: `${a} + ${b} = ?`,
        instruction: "Solve",
        answer: a + b,
        extras: [a + b + 10, a + b - 10],
      };
    }
    case "sub": {
      const a = operand();
      const b = operand();
      const [big, small] = a >= b ? [a + 1, b] : [b + 1, a];
      return {
        prompt: `${big} ${MINUS} ${small} = ?`,
        instruction: "Solve",
        answer: big - small,
        extras: [big - small + 10, big - small - 10],
      };
    }
    case "missing_addend": {
      const known = operand();
      const missing = operand();
      const total = known + missing;
      const left = rng.next() < 0.5;
      return {
        prompt: left ? `? + ${known} = ${total}` : `${known} + ? = ${total}`,
        instruction: "Find the missing number",
        answer: missing,
        extras: [missing + 10, missing - 10],
      };
    }
    case "reverse_sub": {
      const result = operand();
      const missing = operand();
      return {
        prompt: `${result + missing} ${MINUS} ? = ${result}`,
        instruction: "Find the missing number",
        answer: missing,
        extras: [missing + 10, missing - 10],
      };
    }
    case "missing_minuend": {
      const subtrahend = operand();
      const result = operand();
      return {
        prompt: `? ${MINUS} ${subtrahend} = ${result}`,
        instruction: "Find the missing number",
        answer: subtrahend + result,
        // The classic slip: subtracting instead of adding back.
        extras: [Math.abs(result - subtrahend), subtrahend + result + 10],
      };
    }
    case "mixed3": {
      const a = operand();
      const b = operand();
      const c = rng.int(lo, Math.min(a + b - 1, max));
      return {
        prompt: `${a} + ${b} ${MINUS} ${c} = ?`,
        instruction: "Solve",
        answer: a + b - c,
        extras: [a + b - c + 10, a + b - c - 10],
      };
    }
    case "mul_add": {
      const a = rng.int(11, 25);
      const b = rng.int(3, 9);
      const c = rng.int(2, 30);
      return {
        prompt: `${a} × ${b} + ${c} = ?`,
        instruction: "Solve",
        answer: a * b + c,
        extras: [(a + 1) * b + c, (a - 1) * b + c, a * (b + 1) + c],
      };
    }
    case "mul_sub": {
      const a = rng.int(11, 25);
      const b = rng.int(3, 9);
      const c = rng.int(2, Math.min(30, a * b - 1));
      return {
        prompt: `${a} × ${b} ${MINUS} ${c} = ?`,
        instruction: "Solve",
        answer: a * b - c,
        extras: [(a + 1) * b - c, a * (b - 1) - c, a * b - c + 10],
      };
    }
  }
}

export function generateMathStage(
  stage: number,
  rng: Rng,
  count: number
): QuizQuestion[] {
  const tier = mathTier(stage);
  const questions: QuizQuestion[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (questions.length < count && guard++ < count * 50) {
    const shape = rng.pick(tier.shapes);
    const built = build(shape, rng, tier.maxOperand);
    if (built.answer < 0 || seen.has(built.prompt)) continue;
    seen.add(built.prompt);
    const { options, correctIndex } = numericOptions(
      built.answer,
      rng,
      built.extras
    );
    questions.push({
      id: `math-${stage}-${questions.length}`,
      prompt: built.prompt,
      instruction: built.instruction,
      options,
      correctIndex,
      timeLimitMs: tier.timeLimitMs,
    });
  }
  return questions;
}
