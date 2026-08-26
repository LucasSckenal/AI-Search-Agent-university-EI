import {
  ac3,
  ac3Steps,
  backtrackingSteps,
  boxOf,
  colOf,
  conflictCells,
  countSolutions,
  Digit,
  DIFFICULTY_CLUES,
  Difficulty,
  forwardCheckingSteps,
  generatePuzzle,
  generateSolvedGrid,
  peersOf,
  rowOf,
  SIZE,
} from "../src/lib/sudoku/model";
import { seededRng } from "../src/lib/core/rng";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

function emptyGrid(): Digit[] {
  return new Array(81).fill(0) as Digit[];
}
function lastStep<T>(steps: T[]): T {
  return steps[steps.length - 1];
}

// --- peersOf() ---
{
  for (const i of [0, 4, 40, 8, 72, 80]) {
    const peers = peersOf(i);
    assert(peers.length === 20, `peersOf(${i}) has exactly 20 cells (got ${peers.length})`);
    assert(!peers.includes(i), `peersOf(${i}) does not include itself`);
    const r = rowOf(i), c = colOf(i), b = boxOf(i);
    const coversRow = peers.filter((j) => rowOf(j) === r).length === SIZE - 1;
    const coversCol = peers.filter((j) => colOf(j) === c).length === SIZE - 1;
    const coversBox = peers.filter((j) => boxOf(j) === b).length === 9 - 1;
    assert(coversRow, `peersOf(${i}) covers all 8 other cells in its row`);
    assert(coversCol, `peersOf(${i}) covers all 8 other cells in its column`);
    assert(coversBox, `peersOf(${i}) covers all 8 other cells in its box`);
  }
}

// --- conflictCells() ---
{
  const grid = emptyGrid();
  grid[0] = 5;
  grid[3] = 5; // same row (0)
  const bad = conflictCells(grid);
  assert(bad.has(0) && bad.has(3), "two equal digits in the same row are both flagged");
}
{
  const grid = emptyGrid();
  grid[0] = 7; // box 0
  grid[10] = 7; // row1,col1 -> also box 0
  const bad = conflictCells(grid);
  assert(bad.has(0) && bad.has(10), "two equal digits in the same box are both flagged");
}
{
  assert(conflictCells(emptyGrid()).size === 0, "an empty grid has no conflicts");
  const solved = generateSolvedGrid(seededRng(1));
  assert(conflictCells(solved).size === 0, "a freshly-generated solved grid has no conflicts");
}

// --- generatePuzzle: uniqueness + determinism ---
{
  const seeds = [1, 2, 3];
  const tiers: Difficulty[] = ["facil", "medio", "dificil"];
  for (const seed of seeds) {
    for (const tier of tiers) {
      const { puzzle, solution, clues } = generatePuzzle(seed, DIFFICULTY_CLUES[tier]);
      const actualClues = puzzle.filter((v) => v !== 0).length;
      assert(actualClues === clues, `seed ${seed}/${tier}: reported clue count matches actual non-zero cells`);
      assert(countSolutions(puzzle, 2) === 1, `seed ${seed}/${tier}: generated puzzle has a unique solution`);
      assert(conflictCells(solution).size === 0, `seed ${seed}/${tier}: stored solution has no conflicts`);
    }
  }
  const a = generatePuzzle(42, 35);
  const b = generatePuzzle(42, 35);
  assert(JSON.stringify(a.puzzle) === JSON.stringify(b.puzzle), "generatePuzzle is deterministic for a fixed seed (puzzle)");
  assert(JSON.stringify(a.solution) === JSON.stringify(b.solution), "generatePuzzle is deterministic for a fixed seed (solution)");
}

// --- backtracking solves and matches the stored solution ---
{
  const { puzzle, solution } = generatePuzzle(7, DIFFICULTY_CLUES.medio);
  const steps = backtrackingSteps(puzzle);
  const final = lastStep(steps);
  assert(final.action === "solved", "backtracking reaches a solved final step");
  assert(JSON.stringify(final.grid) === JSON.stringify(solution), "backtracking's final grid matches the stored solution");
  assert(conflictCells(final.grid).size === 0, "backtracking's final grid has no conflicts");
}

// --- forward checking: solves + never expands more nodes than plain backtracking ---
{
  for (const seed of [7, 8, 9]) {
    const { puzzle, solution } = generatePuzzle(seed, DIFFICULTY_CLUES.medio);
    const btFinal = lastStep(backtrackingSteps(puzzle));
    const fcFinal = lastStep(forwardCheckingSteps(puzzle));
    assert(fcFinal.action === "solved", `seed ${seed}: forward checking reaches a solved final step`);
    assert(JSON.stringify(fcFinal.grid) === JSON.stringify(solution), `seed ${seed}: forward checking's final grid matches the stored solution`);
    assert(fcFinal.nodesExpanded <= btFinal.nodesExpanded, `seed ${seed}: forward checking expands <= nodes than plain backtracking (${fcFinal.nodesExpanded} vs ${btFinal.nodesExpanded})`);
  }
}

// --- AC-3: propagate frame shape + central invariant (ac3 nodes <= forward-checking nodes) ---
{
  for (const seed of [7, 8, 9]) {
    const { puzzle, solution } = generatePuzzle(seed, DIFFICULTY_CLUES.medio);
    const steps = ac3Steps(puzzle);
    assert(steps[0].action === "propagate", `seed ${seed}: ac3Steps' first frame is "propagate"`);
    assert(!!steps[0].domains && steps[0].domains.length === 81, `seed ${seed}: propagate frame carries all 81 domains`);

    const fcFinal = lastStep(forwardCheckingSteps(puzzle));
    const ac3Final = lastStep(steps);
    assert(ac3Final.action === "solved", `seed ${seed}: ac3Steps reaches a solved final step`);
    assert(JSON.stringify(ac3Final.grid) === JSON.stringify(solution), `seed ${seed}: ac3Steps' final grid matches the stored solution`);
    assert(ac3Final.nodesExpanded <= fcFinal.nodesExpanded, `seed ${seed}: AC-3 expands <= nodes than forward checking (${ac3Final.nodesExpanded} vs ${fcFinal.nodesExpanded})`);
  }
}

// --- AC-3 detects an already-inconsistent grid ---
{
  const grid = emptyGrid();
  grid[0] = 5;
  grid[1] = 5; // same row, contradictory as givens
  const domains = grid.map((v) => (v !== 0 ? [v] : Array.from({ length: 9 }, (_, k) => k + 1)));
  const result = ac3(domains);
  assert(result.consistent === false, "ac3() detects an inconsistent grid via an empty domain");

  const steps = ac3Steps(grid);
  assert(steps.length === 1, "ac3Steps on an inconsistent grid produces only the propagate frame");
  assert(steps[0].domains!.some((d) => d.length === 0), "the propagate frame shows at least one empty domain");
}

// --- sanity: an already-full board solves instantly ---
{
  const solution = generateSolvedGrid(seededRng(3));
  const steps = backtrackingSteps(solution);
  const final = lastStep(steps);
  assert(final.action === "solved" && final.nodesExpanded === 0, "a fully-filled valid grid solves immediately with zero nodes expanded");
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll Sudoku tests passed.");
}
