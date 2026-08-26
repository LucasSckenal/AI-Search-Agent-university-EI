import { seededRng } from "../core/rng";

export const SIZE = 9;
export const CELLS = 81;

/** 0 = empty cell. Grid is flat and row-major: index = row*9 + col. */
export type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type Difficulty = "facil" | "medio" | "dificil";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};

/** Target clue counts per tier - discrete tiers instead of a slider, since clue-count-to-difficulty
 * isn't remotely linear (a 30-clue puzzle can be trivial or brutal depending on which cells are given). */
export const DIFFICULTY_CLUES: Record<Difficulty, number> = {
  facil: 45,
  medio: 35,
  dificil: 28,
};

/**
 * A single animation frame in a Sudoku solve - one SudokuStep per "event" (a placement, a
 * backtrack, reaching a full valid grid, or AC-3's one-time domain propagation), the same
 * "one frame per accepted step" shape N-Rainhas' QueensStep already uses, so the shared Timeline
 * component scrubs through these without any changes.
 */
export interface SudokuStep {
  grid: Digit[];
  action: "place" | "backtrack" | "solved" | "propagate";
  /** Cell index just touched; -1 for "solved" and for AC-3's single "propagate" frame. */
  index: number;
  /** Remaining candidate digits per cell (length 81) - only populated by Forward Checking and AC-3. */
  domains?: number[][];
  /** "propagate" frame only: how many revise() calls actually shrank a domain during AC-3. */
  revisions?: number;
  nodesExpanded: number;
  backtracks: number;
}

export function rowOf(i: number): number {
  return (i / SIZE) | 0;
}
export function colOf(i: number): number {
  return i % SIZE;
}
export function boxOf(i: number): number {
  return Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);
}

/**
 * Every other cell sharing a row, column, or 3x3 box with cell i - precomputed once at module load
 * since it's static (always exactly 20 cells for a 9x9 grid), the same "build once, index everywhere"
 * idea as N-Rainhas' attackedCells, just eager here because there's nothing per-call to recompute.
 */
const PEERS: readonly number[][] = Array.from({ length: CELLS }, (_, i) => {
  const r = rowOf(i);
  const c = colOf(i);
  const b = boxOf(i);
  const peers: number[] = [];
  for (let k = 0; k < CELLS; k++) {
    if (k === i) continue;
    if (rowOf(k) === r || colOf(k) === c || boxOf(k) === b) peers.push(k);
  }
  return peers;
});

export function peersOf(i: number): readonly number[] {
  return PEERS[i];
}

/**
 * Every filled cell that shares a row/column/box with another cell holding the same digit - the
 * box-aware analogue of N-Rainhas' attackedCells, but reporting already-conflicting cells (like
 * queens' `conflicts()`) rather than every square a piece threatens, since Sudoku's manual play only
 * ever needs to flag actual violations in real time, never "don't place here" reach.
 */
export function conflictCells(grid: Digit[]): Set<number> {
  const bad = new Set<number>();
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] === 0) continue;
    for (const j of peersOf(i)) {
      if (grid[j] === grid[i]) {
        bad.add(i);
        bad.add(j);
      }
    }
  }
  return bad;
}

export function isComplete(grid: Digit[]): boolean {
  return grid.every((v) => v !== 0) && conflictCells(grid).size === 0;
}

function isSafeValue(grid: Digit[], idx: number, v: number): boolean {
  return peersOf(idx).every((j) => grid[j] !== v);
}

function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/**
 * Randomized backtracking fill: shuffles the candidate digit order at every cell using the injected
 * rng, so different seeds produce structurally different full grids - not just different holes dug
 * into the same canonical solution.
 */
export function generateSolvedGrid(rng: () => number): Digit[] {
  const grid: Digit[] = new Array(CELLS).fill(0);
  function fill(pos: number): boolean {
    if (pos === CELLS) return true;
    for (const v of shuffle(DIGITS, rng)) {
      if (!isSafeValue(grid, pos, v)) continue;
      grid[pos] = v as Digit;
      if (fill(pos + 1)) return true;
      grid[pos] = 0;
    }
    return false;
  }
  fill(0);
  return grid;
}

/**
 * Bounded solution counter used by puzzle generation to verify uniqueness - stops as soon as `limit`
 * solutions are found (generation only ever needs to know "is it exactly 1?", never the true count)
 * and defensively caps total recursive calls via maxNodes. Exported so tests can assert
 * `countSolutions(puzzle, 2) === 1` directly instead of re-deriving uniqueness some other way.
 */
export function countSolutions(grid: readonly Digit[], limit: number, maxNodes = 50_000): number {
  const g = grid.slice() as Digit[];
  let count = 0;
  let nodes = 0;

  function nextEmpty(from: number): number {
    for (let i = from; i < CELLS; i++) if (g[i] === 0) return i;
    return -1;
  }
  function solve(from: number): void {
    if (count >= limit || nodes >= maxNodes) return;
    const idx = nextEmpty(from);
    if (idx === -1) {
      count++;
      return;
    }
    for (let v = 1; v <= 9 && count < limit && nodes < maxNodes; v++) {
      if (!isSafeValue(g, idx, v)) continue;
      g[idx] = v as Digit;
      nodes++;
      solve(idx + 1);
      g[idx] = 0;
    }
  }
  solve(0);
  return count;
}

export interface GeneratedPuzzle {
  puzzle: Digit[];
  solution: Digit[];
  clues: number;
}

/**
 * Digs holes from a freshly-generated solved grid in random order, keeping each removal only if the
 * puzzle still has a UNIQUE solution (countSolutions(...,2) === 1) - the standard technique for
 * generating well-formed Sudoku puzzles. Stops at targetClues or once no further safe removal exists.
 */
export function generatePuzzle(seed: number, targetClues: number): GeneratedPuzzle {
  const rng = seededRng(seed);
  const solution = generateSolvedGrid(rng);
  const puzzle = solution.slice();
  let clues = CELLS;

  const order = shuffle(
    Array.from({ length: CELLS }, (_, i) => i),
    rng
  );
  for (const idx of order) {
    if (clues <= targetClues) break;
    const backup = puzzle[idx];
    puzzle[idx] = 0;
    if (countSolutions(puzzle, 2) === 1) {
      clues--;
    } else {
      puzzle[idx] = backup;
    }
  }
  return { puzzle, solution, clues };
}

function candidatesFor(grid: readonly Digit[], i: number): number[] {
  const used = new Set<number>(peersOf(i).map((j) => grid[j]).filter((v) => v !== 0));
  const out: number[] = [];
  for (let v = 1; v <= 9; v++) if (!used.has(v)) out.push(v);
  return out;
}

function initialDomains(grid: readonly Digit[]): number[][] {
  return grid.map((v, i) => (v !== 0 ? [v] : candidatesFor(grid, i)));
}

/**
 * One-hop forward checking: after placing `v` at `placedIdx`, strips `v` from every still-unassigned
 * peer's domain. Shared by forwardCheckingSteps and ac3Steps' post-propagation search phase - both
 * need exactly this same "propagate one fresh assignment outward once" pruning during search, the
 * difference is only what domains they start the search from.
 */
function pruneAfterPlacement(domains: number[][], grid: readonly Digit[], placedIdx: number, v: number): number[][] {
  const peerSet = new Set(peersOf(placedIdx));
  return domains.map((dom, i) => {
    if (grid[i] !== 0 || !peerSet.has(i)) return dom;
    return dom.filter((x) => x !== v);
  });
}

/**
 * Chronological backtracking with no lookahead, fixed row-major cell order (first empty cell) -
 * deliberately not MRV, so the Backtracking/Forward-Checking/AC-3 comparison isolates the effect of
 * the propagation technique itself without also mixing in a variable-ordering heuristic, mirroring
 * how N-Rainhas' own FC-vs-backtracking comparison keeps column order fixed too.
 */
export function backtrackingSteps(puzzle: readonly Digit[], maxSteps = 200_000): SudokuStep[] {
  const grid = puzzle.slice() as Digit[];
  const steps: SudokuStep[] = [];
  let nodesExpanded = 0;
  let backtracks = 0;

  function nextEmpty(from: number): number {
    for (let i = from; i < CELLS; i++) if (grid[i] === 0) return i;
    return -1;
  }
  function solve(from: number): boolean {
    if (steps.length >= maxSteps) return false;
    const idx = nextEmpty(from);
    if (idx === -1) {
      steps.push({ grid: grid.slice(), action: "solved", index: -1, nodesExpanded, backtracks });
      return true;
    }
    for (let v = 1; v <= 9; v++) {
      if (steps.length >= maxSteps) return false;
      if (!isSafeValue(grid, idx, v)) continue;
      grid[idx] = v as Digit;
      nodesExpanded++;
      steps.push({ grid: grid.slice(), action: "place", index: idx, nodesExpanded, backtracks });
      if (solve(idx + 1)) return true;
      grid[idx] = 0;
    }
    backtracks++;
    steps.push({ grid: grid.slice(), action: "backtrack", index: idx, nodesExpanded, backtracks });
    return false;
  }
  solve(0);
  return steps;
}

/**
 * Backtracking with forward checking: after each placement, immediately prunes the candidate digits
 * of every peer against the new value, abandoning the branch without recursing if any peer is left
 * with zero candidates. Same shape as N-Rainhas' forwardCheckingSteps.
 */
export function forwardCheckingSteps(puzzle: readonly Digit[], maxSteps = 200_000): SudokuStep[] {
  const grid = puzzle.slice() as Digit[];
  const steps: SudokuStep[] = [];
  let nodesExpanded = 0;
  let backtracks = 0;

  function nextEmpty(from: number): number {
    for (let i = from; i < CELLS; i++) if (grid[i] === 0) return i;
    return -1;
  }
  function solve(from: number, domains: number[][]): boolean {
    if (steps.length >= maxSteps) return false;
    const idx = nextEmpty(from);
    if (idx === -1) {
      steps.push({ grid: grid.slice(), action: "solved", index: -1, nodesExpanded, backtracks, domains: domains.map((d) => d.slice()) });
      return true;
    }
    for (const v of domains[idx]) {
      if (steps.length >= maxSteps) return false;
      grid[idx] = v as Digit;
      nodesExpanded++;
      const pruned = pruneAfterPlacement(domains, grid, idx, v);
      const deadEnd = pruned.some((d, i) => grid[i] === 0 && d.length === 0);
      steps.push({ grid: grid.slice(), action: "place", index: idx, nodesExpanded, backtracks, domains: pruned.map((d) => d.slice()) });
      if (!deadEnd && solve(idx + 1, pruned)) return true;
      grid[idx] = 0;
    }
    backtracks++;
    steps.push({ grid: grid.slice(), action: "backtrack", index: idx, nodesExpanded, backtracks, domains: domains.map((d) => d.slice()) });
    return false;
  }
  solve(0, initialDomains(grid));
  return steps;
}

/**
 * Removes from Di every value with no support in Dj (no y in Dj with y !== x) - the general
 * "all-different" arc-consistency check, not a hand-coded singleton shortcut, so this reads like
 * AC-3 from any AI textbook rather than disguised forward checking.
 */
function revise(domains: number[][], xi: number, xj: number): boolean {
  const dj = domains[xj];
  const filtered = domains[xi].filter((x) => dj.some((y) => y !== x));
  if (filtered.length === domains[xi].length) return false;
  domains[xi] = filtered;
  return true;
}

export interface Ac3Result {
  domains: number[][];
  consistent: boolean;
  /** Count of revise() calls that actually shrank a domain - an AC-3-specific propagation-strength
   * stat with no forward-checking/backtracking equivalent. */
  revisions: number;
}

/**
 * Real worklist-based arc consistency: unlike one-hop forward checking (which only propagates from a
 * single freshly-placed cell to its direct peers, once), AC-3 propagates transitively across the
 * whole constraint graph to a fixpoint - when a domain shrinks, every arc pointing back into it is
 * re-enqueued, so a cascade can prune cells arbitrarily far from where it started, entirely before
 * any search begins.
 */
export function ac3(seedDomains: number[][]): Ac3Result {
  const domains = seedDomains.map((d) => d.slice());
  const queue: [number, number][] = [];
  for (let i = 0; i < CELLS; i++) {
    for (const j of peersOf(i)) queue.push([i, j]);
  }

  let revisions = 0;
  while (queue.length > 0) {
    const [xi, xj] = queue.shift()!;
    if (!revise(domains, xi, xj)) continue;
    revisions++;
    if (domains[xi].length === 0) return { domains, consistent: false, revisions };
    for (const xk of peersOf(xi)) {
      if (xk !== xj) queue.push([xk, xi]);
    }
  }
  return { domains, consistent: true, revisions };
}

/**
 * AC-3 preprocessing (recorded as a single "propagate" frame showing every domain collapse before
 * any placement happens), then a search phase reusing forward checking's exact shape - just seeded
 * with AC-3's already-narrowed domains instead of raw peer-conflict domains. Since AC-3's domains are
 * always a pointwise subset of forward checking's initial domains, and both phases place cells in the
 * same fixed order with the same one-hop pruning afterward, AC-3 can only ever explore <= as many
 * nodes as forwardCheckingSteps on the same puzzle.
 */
export function ac3Steps(puzzle: readonly Digit[], maxSteps = 200_000): SudokuStep[] {
  const grid = puzzle.slice() as Digit[];
  const steps: SudokuStep[] = [];
  let nodesExpanded = 0;
  let backtracks = 0;

  const { domains: propagated, consistent, revisions } = ac3(initialDomains(grid));
  steps.push({
    grid: grid.slice(),
    action: "propagate",
    index: -1,
    nodesExpanded,
    backtracks,
    domains: propagated.map((d) => d.slice()),
    revisions,
  });
  if (!consistent) return steps;

  function nextEmpty(from: number): number {
    for (let i = from; i < CELLS; i++) if (grid[i] === 0) return i;
    return -1;
  }
  function solve(from: number, domains: number[][]): boolean {
    if (steps.length >= maxSteps) return false;
    const idx = nextEmpty(from);
    if (idx === -1) {
      steps.push({ grid: grid.slice(), action: "solved", index: -1, nodesExpanded, backtracks, domains: domains.map((d) => d.slice()) });
      return true;
    }
    for (const v of domains[idx]) {
      if (steps.length >= maxSteps) return false;
      grid[idx] = v as Digit;
      nodesExpanded++;
      const pruned = pruneAfterPlacement(domains, grid, idx, v);
      const deadEnd = pruned.some((d, i) => grid[i] === 0 && d.length === 0);
      steps.push({ grid: grid.slice(), action: "place", index: idx, nodesExpanded, backtracks, domains: pruned.map((d) => d.slice()) });
      if (!deadEnd && solve(idx + 1, pruned)) return true;
      grid[idx] = 0;
    }
    backtracks++;
    steps.push({ grid: grid.slice(), action: "backtrack", index: idx, nodesExpanded, backtracks, domains: domains.map((d) => d.slice()) });
    return false;
  }
  solve(0, propagated);
  return steps;
}
