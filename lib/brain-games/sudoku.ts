// 🧩 Sudoku — generator, uniqueness checker, logical grader and validator.
// Pure (no I/O) and shared by the server (stage generation, hints, final
// verification) and the board UI (conflict highlighting).
//
// A board is number[81], row-major, 0 = empty.
//
// Difficulty is graded by the hardest human technique needed to solve the
// puzzle (not just by how many clues were removed):
//   1 naked single · 2 hidden single · 3 locked candidates (pointing /
//   claiming) · 4 naked / hidden pairs · 5 beyond those (needs chains or
//   trial) — plus a clue-count band per difficulty.
import type { Rng } from "./rng";

export type SudokuDifficulty = "easy" | "medium" | "hard" | "expert";

const ALL = 0x3fe; // bits 1..9
const bit = (digit: number) => 1 << digit;
const popcount = (mask: number) => {
  let count = 0;
  for (let m = mask; m; m &= m - 1) count += 1;
  return count;
};
const lowestDigit = (mask: number) => 31 - Math.clz32(mask & -mask);

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) =>
  Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

// The 27 units (9 rows, 9 cols, 9 boxes) and each cell's 20 peers.
export const UNITS: number[][] = [];
for (let r = 0; r < 9; r++) {
  UNITS.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
}
for (let c = 0; c < 9; c++) {
  UNITS.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
}
for (let b = 0; b < 9; b++) {
  const r0 = Math.floor(b / 3) * 3;
  const c0 = (b % 3) * 3;
  UNITS.push(
    Array.from(
      { length: 9 },
      (_, k) => (r0 + Math.floor(k / 3)) * 9 + c0 + (k % 3)
    )
  );
}
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const peers = new Set<number>();
  for (const unit of UNITS) {
    if (unit.includes(i)) unit.forEach(j => j !== i && peers.add(j));
  }
  return [...peers];
});

// ── Solving / uniqueness ─────────────────────────────────────────────────
function candidatesOf(grid: number[], i: number): number {
  let used = 0;
  for (const p of PEERS[i]) if (grid[p]) used |= bit(grid[p]);
  return ALL & ~used;
}

// Counts solutions up to `limit` (2 is enough to prove uniqueness). MRV
// backtracking: always branches on the cell with the fewest candidates.
export function countSolutions(puzzle: number[], limit = 2): number {
  if (hasConflicts(puzzle)) return 0;
  const grid = [...puzzle];
  let found = 0;
  const search = (): void => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const mask = candidatesOf(grid, i);
      const count = popcount(mask);
      if (count === 0) return;
      if (count < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = count;
        if (count === 1) break;
      }
    }
    if (best === -1) {
      found += 1;
      return;
    }
    for (let m = bestMask; m && found < limit; m &= m - 1) {
      grid[best] = lowestDigit(m);
      search();
    }
    grid[best] = 0;
  };
  search();
  return found;
}

export function solve(puzzle: number[]): number[] | null {
  if (hasConflicts(puzzle)) return null;
  const grid = [...puzzle];
  const search = (): boolean => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const mask = candidatesOf(grid, i);
      const count = popcount(mask);
      if (count === 0) return false;
      if (count < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = count;
      }
    }
    if (best === -1) return true;
    for (let m = bestMask; m; m &= m - 1) {
      grid[best] = lowestDigit(m);
      if (search()) return true;
    }
    grid[best] = 0;
    return false;
  };
  return search() ? grid : null;
}

function generateSolvedGrid(rng: Rng): number[] {
  const grid = new Array<number>(81).fill(0);
  const fill = (i: number): boolean => {
    if (i === 81) return true;
    const mask = candidatesOf(grid, i);
    const digits = rng
      .shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])
      .filter(d => mask & bit(d));
    for (const d of digits) {
      grid[i] = d;
      if (fill(i + 1)) return true;
    }
    grid[i] = 0;
    return false;
  };
  fill(0);
  return grid;
}

// ── Logical grader ───────────────────────────────────────────────────────
// Solves like a human, always using the easiest technique that makes
// progress, and reports the hardest one it ever needed (5 = stuck).
export function gradePuzzle(puzzle: number[]): {
  level: number;
  solved: boolean;
} {
  const grid = [...puzzle];
  const cands = grid.map((v, i) => (v ? 0 : candidatesOf(grid, i)));
  let hardest = 0;

  const place = (i: number, d: number) => {
    grid[i] = d;
    cands[i] = 0;
    for (const p of PEERS[i]) cands[p] &= ~bit(d);
  };

  const nakedSingle = () => {
    for (let i = 0; i < 81; i++) {
      if (!grid[i] && popcount(cands[i]) === 1) {
        place(i, lowestDigit(cands[i]));
        return true;
      }
    }
    return false;
  };
  const hiddenSingle = () => {
    for (const unit of UNITS) {
      for (let d = 1; d <= 9; d++) {
        let spot = -1;
        let n = 0;
        for (const i of unit) {
          if (!grid[i] && cands[i] & bit(d)) {
            spot = i;
            n += 1;
          }
        }
        if (n === 1) {
          place(spot, d);
          return true;
        }
      }
    }
    return false;
  };
  // Pointing: in a box, a digit confined to one row/col → removed from the
  // rest of that line. Claiming: in a line, confined to one box → removed
  // from the rest of that box.
  const lockedCandidates = () => {
    let changed = false;
    for (let u = 0; u < 27; u++) {
      const unit = UNITS[u];
      for (let d = 1; d <= 9; d++) {
        const spots = unit.filter(i => !grid[i] && cands[i] & bit(d));
        if (spots.length < 2) continue;
        const targets: number[][] = [];
        if (u >= 18) {
          if (spots.every(i => rowOf(i) === rowOf(spots[0]))) {
            targets.push(UNITS[rowOf(spots[0])]);
          }
          if (spots.every(i => colOf(i) === colOf(spots[0]))) {
            targets.push(UNITS[9 + colOf(spots[0])]);
          }
        } else if (spots.every(i => boxOf(i) === boxOf(spots[0]))) {
          targets.push(UNITS[18 + boxOf(spots[0])]);
        }
        for (const target of targets) {
          for (const i of target) {
            if (!spots.includes(i) && !grid[i] && cands[i] & bit(d)) {
              cands[i] &= ~bit(d);
              changed = true;
            }
          }
        }
      }
    }
    return changed;
  };
  const pairs = () => {
    let changed = false;
    for (const unit of UNITS) {
      const open = unit.filter(i => !grid[i]);
      // Naked pair: two cells with the same two candidates.
      for (let a = 0; a < open.length; a++) {
        const ma = cands[open[a]];
        if (popcount(ma) !== 2) continue;
        for (let b = a + 1; b < open.length; b++) {
          if (cands[open[b]] !== ma) continue;
          for (const i of open) {
            if (i !== open[a] && i !== open[b] && cands[i] & ma) {
              cands[i] &= ~ma;
              changed = true;
            }
          }
        }
      }
      // Hidden pair: two digits that only fit in the same two cells.
      for (let d1 = 1; d1 <= 9; d1++) {
        const s1 = open.filter(i => cands[i] & bit(d1));
        if (s1.length !== 2) continue;
        for (let d2 = d1 + 1; d2 <= 9; d2++) {
          const s2 = open.filter(i => cands[i] & bit(d2));
          if (s2.length === 2 && s2[0] === s1[0] && s2[1] === s1[1]) {
            const keep = bit(d1) | bit(d2);
            for (const i of s1) {
              if (cands[i] & ~keep) {
                cands[i] &= keep;
                changed = true;
              }
            }
          }
        }
      }
    }
    return changed;
  };

  const techniques: [number, () => boolean][] = [
    [1, nakedSingle],
    [2, hiddenSingle],
    [3, lockedCandidates],
    [4, pairs],
  ];
  while (grid.includes(0)) {
    let progressed = false;
    for (const [level, technique] of techniques) {
      if (technique()) {
        hardest = Math.max(hardest, level);
        progressed = true;
        break;
      }
    }
    if (!progressed) return { level: 5, solved: false };
    if (cands.some((mask, i) => !grid[i] && mask === 0)) {
      return { level: 5, solved: false };
    }
  }
  return { level: Math.max(hardest, 1), solved: true };
}

// ── Stage difficulty ─────────────────────────────────────────────────────
export type SudokuSpec = {
  difficulty: SudokuDifficulty;
  minClues: number;
  maxClues: number;
  minLevel: number;
  maxLevel: number;
  parSeconds: number;
  maxHints: number;
};

// 1–10 Easy · 11–25 Medium · 26–40 Hard · 41+ Expert. Inside a band the
// clue count drifts down, so stage 10 is harder than stage 1.
export function sudokuSpec(stage: number): SudokuSpec {
  const t = (from: number, to: number) =>
    (Math.min(stage, to) - from) / Math.max(1, to - from);
  if (stage <= 10) {
    const max = Math.round(44 - t(1, 10) * 5);
    return {
      difficulty: "easy",
      minClues: max - 3,
      maxClues: max,
      minLevel: 1,
      maxLevel: 2,
      parSeconds: 480,
      maxHints: 3,
    };
  }
  if (stage <= 25) {
    const max = Math.round(35 - t(11, 25) * 3);
    return {
      difficulty: "medium",
      minClues: max - 3,
      maxClues: max,
      minLevel: 2,
      maxLevel: 2,
      parSeconds: 720,
      maxHints: 3,
    };
  }
  if (stage <= 40) {
    return {
      difficulty: "hard",
      minClues: 25,
      maxClues: 31,
      minLevel: 3,
      maxLevel: 4,
      parSeconds: 1080,
      maxHints: 3,
    };
  }
  return {
    difficulty: "expert",
    minClues: 22,
    maxClues: 28,
    minLevel: 4,
    maxLevel: 5,
    parSeconds: 1500,
    maxHints: 3,
  };
}

export type SudokuPuzzle = {
  puzzle: number[];
  solution: number[];
  difficulty: SudokuDifficulty;
  level: number;
  clues: number;
};

// Digs cells (in symmetric pairs) out of a random solved grid, keeping the
// solution unique at every step, and accepts the puzzle once its clue count
// AND its graded technique level match the stage. Retries with a new grid
// otherwise; if the budget runs out, returns the attempt closest to the
// target — always with exactly one solution, never an invalid board.
export function generateSudoku(stage: number, rng: Rng): SudokuPuzzle {
  const spec = sudokuSpec(stage);
  let best: (SudokuPuzzle & { distance: number }) | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const solution = generateSolvedGrid(rng);
    const puzzle = [...solution];
    let clues = 81;
    const order = rng.shuffle(Array.from({ length: 41 }, (_, i) => i));
    for (const i of order) {
      if (clues <= spec.minClues) break;
      const j = 80 - i;
      const saved = [puzzle[i], puzzle[j]];
      const removed = i === j ? 1 : 2;
      if (clues - removed < spec.minClues - 1) continue;
      puzzle[i] = 0;
      puzzle[j] = 0;
      if (countSolutions(puzzle, 2) !== 1) {
        puzzle[i] = saved[0];
        puzzle[j] = saved[1];
        continue;
      }
      clues -= removed;
      if (clues > spec.maxClues) continue;
      const { level } = gradePuzzle(puzzle);
      if (level >= spec.minLevel && level <= spec.maxLevel) {
        return {
          puzzle: [...puzzle],
          solution,
          difficulty: spec.difficulty,
          level,
          clues,
        };
      }
      const distance =
        (level < spec.minLevel
          ? spec.minLevel - level
          : level > spec.maxLevel
            ? level - spec.maxLevel
            : 0) *
          10 +
        Math.max(0, clues - spec.maxClues);
      if (!best || distance < best.distance) {
        best = {
          puzzle: [...puzzle],
          solution,
          difficulty: spec.difficulty,
          level,
          clues,
          distance,
        };
      }
    }
  }
  if (!best) throw new Error("Sudoku generation failed");
  return {
    puzzle: best.puzzle,
    solution: best.solution,
    difficulty: best.difficulty,
    level: best.level,
    clues: best.clues,
  };
}

// ── Validation (UI + server) ─────────────────────────────────────────────
// Every filled cell that repeats a digit in its row, column or box.
export function conflictingCells(board: number[]): Set<number> {
  const conflicts = new Set<number>();
  for (const unit of UNITS) {
    const seen = new Map<number, number[]>();
    for (const i of unit) {
      if (!board[i]) continue;
      const list = seen.get(board[i]) ?? [];
      list.push(i);
      seen.set(board[i], list);
    }
    for (const list of seen.values()) {
      if (list.length > 1) list.forEach(i => conflicts.add(i));
    }
  }
  return conflicts;
}

export function hasConflicts(board: number[]): boolean {
  return conflictingCells(board).size > 0;
}

export function isValidBoardShape(board: unknown): board is number[] {
  return (
    Array.isArray(board) &&
    board.length === 81 &&
    board.every(v => Number.isInteger(v) && v >= 0 && v <= 9)
  );
}

// Complete = every cell filled, no conflicts, and the givens untouched.
// With a unique-solution puzzle this is exactly "equals the solution".
export function isSolved(board: number[], puzzle: number[]): boolean {
  return (
    board.every(v => v >= 1 && v <= 9) &&
    !hasConflicts(board) &&
    puzzle.every((given, i) => !given || board[i] === given)
  );
}

// A hint: first fixes a wrong entry, otherwise fills the empty cell with
// the fewest candidates (the one a human would look at next).
export function nextHint(
  board: number[],
  puzzle: number[],
  solution: number[]
): { index: number; value: number } | null {
  for (let i = 0; i < 81; i++) {
    if (!puzzle[i] && board[i] && board[i] !== solution[i]) {
      return { index: i, value: solution[i] };
    }
  }
  let best = -1;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (board[i]) continue;
    const count = popcount(candidatesOf(board, i));
    if (count < bestCount) {
      best = i;
      bestCount = count;
    }
  }
  return best === -1 ? null : { index: best, value: solution[best] };
}

// ── Scoring ──────────────────────────────────────────────────────────────
const BASE: Record<SudokuDifficulty, number> = {
  easy: 1000,
  medium: 1500,
  hard: 2200,
  expert: 3000,
};
export const HINT_PENALTY = 150;
export const MISTAKE_PENALTY = 25;

export function scoreSudoku(input: {
  difficulty: SudokuDifficulty;
  parSeconds: number;
  seconds: number;
  hintsUsed: number;
  mistakes: number;
}): number {
  const timeBonus = Math.max(0, input.parSeconds - input.seconds);
  const score =
    BASE[input.difficulty] +
    timeBonus -
    input.hintsUsed * HINT_PENALTY -
    Math.min(input.mistakes, 40) * MISTAKE_PENALTY;
  return Math.max(100, Math.round(score));
}
