import { describe, expect, it } from "vitest";
import { createRng } from "./rng";
import {
  conflictingCells,
  countSolutions,
  generateSudoku,
  gradePuzzle,
  isSolved,
  isValidBoardShape,
  nextHint,
  scoreSudoku,
  solve,
  sudokuSpec,
} from "./sudoku";

// Independent rule check of a finished grid (rows, cols, boxes = 1..9).
function isValidSolution(grid: number[]): boolean {
  const ok = (cells: number[]) =>
    [...cells].sort((a, b) => a - b).join("") === "123456789";
  for (let k = 0; k < 9; k++) {
    const row = grid.slice(k * 9, k * 9 + 9);
    const col = Array.from({ length: 9 }, (_, r) => grid[r * 9 + k]);
    const r0 = Math.floor(k / 3) * 3;
    const c0 = (k % 3) * 3;
    const box = Array.from(
      { length: 9 },
      (_, i) => grid[(r0 + Math.floor(i / 3)) * 9 + c0 + (i % 3)]
    );
    if (!ok(row) || !ok(col) || !ok(box)) return false;
  }
  return true;
}

const STAGES = [1, 5, 10, 11, 18, 25, 26, 33, 40, 41, 46, 50];

describe("Sudoku generator", () => {
  for (const stage of STAGES) {
    it(`stage ${stage}: valid puzzle, exactly one solution, matching difficulty`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const spec = sudokuSpec(stage);
        const p = generateSudoku(stage, createRng(seed * 101 + stage));
        expect(isValidBoardShape(p.puzzle)).toBe(true);
        expect(isValidSolution(p.solution)).toBe(true);
        // Givens are a subset of the solution and conflict-free.
        p.puzzle.forEach((v, i) => {
          if (v) expect(v).toBe(p.solution[i]);
        });
        expect(conflictingCells(p.puzzle).size).toBe(0);
        // Exactly one solution — and it's the stored one.
        expect(countSolutions(p.puzzle, 2)).toBe(1);
        expect(solve(p.puzzle)).toEqual(p.solution);
        // Difficulty from the technique grader, not only the clue count.
        expect(p.clues).toBe(p.puzzle.filter(Boolean).length);
        expect(p.clues).toBeLessThanOrEqual(spec.maxClues);
        expect(p.level).toBeGreaterThanOrEqual(spec.minLevel);
        expect(p.level).toBeLessThanOrEqual(spec.maxLevel);
      }
    });
  }

  it("difficulty bands follow the stages (easy → expert)", () => {
    expect(sudokuSpec(1).difficulty).toBe("easy");
    expect(sudokuSpec(10).difficulty).toBe("easy");
    expect(sudokuSpec(11).difficulty).toBe("medium");
    expect(sudokuSpec(26).difficulty).toBe("hard");
    expect(sudokuSpec(41).difficulty).toBe("expert");
    expect(sudokuSpec(10).maxClues).toBeLessThan(sudokuSpec(1).maxClues);
  });

  it("the grader separates single-only puzzles from harder ones", () => {
    const easy = generateSudoku(1, createRng(9));
    const hard = generateSudoku(30, createRng(9));
    expect(gradePuzzle(easy.puzzle).level).toBeLessThanOrEqual(2);
    expect(gradePuzzle(hard.puzzle).level).toBeGreaterThanOrEqual(3);
  });

  it("generates quickly enough for a request (< 2s even for hard stages)", () => {
    const started = Date.now();
    for (let seed = 0; seed < 5; seed++) generateSudoku(35, createRng(seed));
    expect((Date.now() - started) / 5).toBeLessThan(2000);
  });
});

describe("Sudoku validation", () => {
  const { puzzle, solution } = generateSudoku(3, createRng(77));
  const firstEmpty = puzzle.indexOf(0);

  it("flags a duplicate in a row", () => {
    const board = new Array(81).fill(0);
    board[0] = 5;
    board[8] = 5;
    expect([...conflictingCells(board)].sort((a, b) => a - b)).toEqual([0, 8]);
  });

  it("flags a duplicate in a column", () => {
    const board = new Array(81).fill(0);
    board[4] = 7;
    board[76] = 7;
    expect([...conflictingCells(board)].sort((a, b) => a - b)).toEqual([4, 76]);
  });

  it("flags a duplicate in a 3×3 box", () => {
    const board = new Array(81).fill(0);
    board[0] = 3;
    board[20] = 3; // row 2, col 2 — same box, different row and column
    expect([...conflictingCells(board)].sort((a, b) => a - b)).toEqual([0, 20]);
  });

  it("an invalid placement makes a conflict; a correct one doesn't", () => {
    const board = [...puzzle];
    const row = Math.floor(firstEmpty / 9);
    const wrongDigit = puzzle.find((v, i) => v && Math.floor(i / 9) === row)!;
    board[firstEmpty] = wrongDigit;
    expect(conflictingCells(board).has(firstEmpty)).toBe(true);
    board[firstEmpty] = solution[firstEmpty];
    expect(conflictingCells(board).size).toBe(0);
  });

  it("recognises complete vs incomplete boards", () => {
    expect(isSolved(solution, puzzle)).toBe(true);
    const incomplete = [...solution];
    incomplete[firstEmpty] = 0;
    expect(isSolved(incomplete, puzzle)).toBe(false);
  });

  it("never accepts a full board that breaks the rules or changes a given", () => {
    const broken = [...solution];
    const a = puzzle.indexOf(0);
    broken[a] = (broken[a] % 9) + 1;
    expect(isSolved(broken, puzzle)).toBe(false);
    const givenChanged = [...solution];
    const given = puzzle.findIndex(Boolean);
    givenChanged[given] = (givenChanged[given] % 9) + 1;
    expect(isSolved(givenChanged, puzzle)).toBe(false);
  });

  it("rejects malformed boards", () => {
    expect(isValidBoardShape(new Array(80).fill(0))).toBe(false);
    expect(isValidBoardShape([...new Array(80).fill(0), 10])).toBe(false);
    expect(isValidBoardShape([...new Array(80).fill(0), 1.5])).toBe(false);
  });

  it("an unsolvable board has no solutions", () => {
    const board = new Array(81).fill(0);
    board[0] = 1;
    board[1] = 1;
    expect(countSolutions(board)).toBe(0);
    expect(solve(board)).toBeNull();
  });
});

describe("Sudoku hints and scoring", () => {
  const { puzzle, solution } = generateSudoku(12, createRng(5));

  it("a hint fixes a wrong entry first", () => {
    const board = [...puzzle];
    const i = puzzle.indexOf(0);
    board[i] = (solution[i] % 9) + 1;
    expect(nextHint(board, puzzle, solution)).toEqual({
      index: i,
      value: solution[i],
    });
  });

  it("otherwise fills a correct value into an empty cell", () => {
    const hint = nextHint(puzzle, puzzle, solution)!;
    expect(puzzle[hint.index]).toBe(0);
    expect(hint.value).toBe(solution[hint.index]);
  });

  it("no hint on a solved board", () => {
    expect(nextHint(solution, puzzle, solution)).toBeNull();
  });

  it("scores harder, faster, hint-free solves higher (never below 100)", () => {
    const base = { parSeconds: 600, seconds: 300, hintsUsed: 0, mistakes: 0 };
    const easy = scoreSudoku({ ...base, difficulty: "easy" });
    const expert = scoreSudoku({ ...base, difficulty: "expert" });
    expect(expert).toBeGreaterThan(easy);
    expect(scoreSudoku({ ...base, difficulty: "easy", hintsUsed: 2 })).toBe(
      easy - 300
    );
    expect(
      scoreSudoku({
        ...base,
        difficulty: "easy",
        seconds: 5000,
        hintsUsed: 3,
        mistakes: 40,
      })
    ).toBe(100);
  });
});
