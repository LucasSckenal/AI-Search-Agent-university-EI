import { seededRng } from "../core/rng";

/**
 * A single animation frame in a queens search/repair run - one QueensStep per "event" (a
 * placement, a backtrack, or reaching a full valid board), the same "one frame per accepted step"
 * shape TSP's TourStep already uses, so the shared Timeline component scrubs through these without
 * any changes. `col` is -1 for the very first frame (the random starting board of min-conflicts,
 * which isn't a placement into any particular column).
 */
export interface QueensStep {
  /** board[col] = row of the queen in that column, or -1 if the column has no queen yet. */
  board: number[];
  action: "place" | "backtrack" | "solved";
  col: number;
  /** Remaining candidate rows per column after this step's pruning - only populated by Forward Checking. */
  domains?: number[][];
  nodesExpanded: number;
  backtracks: number;
}

/** Column pairs whose queens attack each other (same row, or same diagonal). Unplaced columns (-1) are skipped. */
export function conflicts(board: number[]): [number, number][] {
  const pairs: [number, number][] = [];
  const n = board.length;
  for (let i = 0; i < n; i++) {
    if (board[i] === -1) continue;
    for (let j = i + 1; j < n; j++) {
      if (board[j] === -1) continue;
      if (board[i] === board[j] || Math.abs(board[i] - board[j]) === j - i) {
        pairs.push([i, j]);
      }
    }
  }
  return pairs;
}

/**
 * Every cell (as `"col,row"`) any placed queen attacks - its whole row, its whole column, and both
 * diagonals, the full four-direction reach of a real chess queen. Used by manual play to flag,
 * after each placement, exactly which squares are now unsafe - the classic N-Queens visual feedback
 * of a queen's reach lighting up the board, distinct from `conflicts()` which only reports
 * queen-pairs that are already mutually attacking. The column is included for this visual reach
 * even though this board representation (one queen per column) can never actually produce a
 * same-column conflict - omitting it left the column's cells looking safe to place in, when
 * dragging a queen there would just relocate the same queen, not create a second one.
 */
export function attackedCells(board: number[]): Set<string> {
  const n = board.length;
  const attacked = new Set<string>();
  for (let col = 0; col < n; col++) {
    const row = board[col];
    if (row === -1) continue;
    for (let c = 0; c < n; c++) {
      for (let r = 0; r < n; r++) {
        if (c === col) {
          // Same column as this queen: attacked at every other row, but not the queen's own square
          // - otherwise a single, non-conflicting queen would render as if under attack by itself.
          if (r !== row) attacked.add(`${c},${r}`);
        } else if (r === row || Math.abs(r - row) === Math.abs(c - col)) {
          attacked.add(`${c},${r}`);
        }
      }
    }
  }
  return attacked;
}

function isSafe(board: number[], col: number, row: number): boolean {
  for (let c = 0; c < col; c++) {
    const r = board[c];
    if (r === row || Math.abs(r - row) === col - c) return false;
  }
  return true;
}

/**
 * Chronological backtracking with no lookahead: tries each row 0..n-1 for the current column,
 * recursing into the next column whenever a row is consistent with everything placed so far, and
 * backtracking (undo + try the next row, or pop up a column) once every row has been exhausted.
 * One QueensStep per placement/backtrack/solved event, capped at `maxSteps` frames as a safety
 * valve against pathological instances.
 */
export function backtrackingSteps(n: number, maxSteps = 200_000): QueensStep[] {
  const board = new Array<number>(n).fill(-1);
  const steps: QueensStep[] = [];
  let nodesExpanded = 0;
  let backtracks = 0;

  function place(col: number): boolean {
    if (steps.length >= maxSteps) return false;
    if (col === n) {
      steps.push({ board: board.slice(), action: "solved", col, nodesExpanded, backtracks });
      return true;
    }
    for (let row = 0; row < n; row++) {
      if (steps.length >= maxSteps) return false;
      if (!isSafe(board, col, row)) continue;
      board[col] = row;
      nodesExpanded++;
      steps.push({ board: board.slice(), action: "place", col, nodesExpanded, backtracks });
      if (place(col + 1)) return true;
      board[col] = -1;
    }
    backtracks++;
    steps.push({ board: board.slice(), action: "backtrack", col, nodesExpanded, backtracks });
    return false;
  }

  place(0);
  return steps;
}

/** Prunes columns after `fromCol` of any row that now conflicts with the queen just placed at (fromCol, row). */
function pruneDomains(domains: number[][], fromCol: number, row: number): number[][] {
  return domains.map((dom, c) => {
    if (c <= fromCol) return dom;
    return dom.filter((r) => r !== row && Math.abs(r - row) !== c - fromCol);
  });
}

/**
 * Backtracking with forward checking: after each placement, immediately prunes the candidate rows
 * of every future column against the new queen. If that leaves any future column with zero
 * candidates, the branch is provably dead and is abandoned without ever recursing into it - the
 * same partial assignments plain backtracking would still have to visit (and fail) one column
 * later. That's the entire point of the comparison: forward checking's `nodesExpanded` can only be
 * lower than or equal to plain backtracking's on the same N, never higher.
 */
export function forwardCheckingSteps(n: number, maxSteps = 200_000): QueensStep[] {
  const board = new Array<number>(n).fill(-1);
  const steps: QueensStep[] = [];
  let nodesExpanded = 0;
  let backtracks = 0;
  const initialDomains: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, (_, r) => r));

  function solve(col: number, domains: number[][]): boolean {
    if (steps.length >= maxSteps) return false;
    if (col === n) {
      steps.push({
        board: board.slice(),
        action: "solved",
        col,
        nodesExpanded,
        backtracks,
        domains: domains.map((d) => d.slice()),
      });
      return true;
    }
    for (const row of domains[col]) {
      if (steps.length >= maxSteps) return false;
      board[col] = row;
      nodesExpanded++;
      const pruned = pruneDomains(domains, col, row);
      const deadEnd = pruned.slice(col + 1).some((d) => d.length === 0);
      steps.push({
        board: board.slice(),
        action: "place",
        col,
        nodesExpanded,
        backtracks,
        domains: pruned.map((d) => d.slice()),
      });
      if (!deadEnd && solve(col + 1, pruned)) return true;
      board[col] = -1;
    }
    backtracks++;
    steps.push({
      board: board.slice(),
      action: "backtrack",
      col,
      nodesExpanded,
      backtracks,
      domains: domains.map((d) => d.slice()),
    });
    return false;
  }

  solve(0, initialDomains);
  return steps;
}

export interface MinConflictsResult {
  steps: QueensStep[];
  solved: boolean;
}

/**
 * Min-conflicts local search: starts with one queen per column at a random row, then repeatedly
 * picks a random column involved in a conflict and moves it to whichever row minimizes its conflict
 * count (ties broken randomly). A completely different paradigm from backtracking - repairing a
 * full-but-flawed board instead of building a partial-but-valid one - which is what lets it scale to
 * much larger N without the combinatorial blowup plain search hits.
 */
export function minConflictsSteps(n: number, seed: number, maxIterations = 10_000): MinConflictsResult {
  const rng = seededRng(seed);
  const board = Array.from({ length: n }, () => Math.floor(rng() * n));
  const steps: QueensStep[] = [{ board: board.slice(), action: "place", col: -1, nodesExpanded: 0, backtracks: 0 }];

  if (conflicts(board).length === 0) {
    return { steps, solved: true };
  }

  const conflictCountForRow = (col: number, row: number): number => {
    let count = 0;
    for (let c = 0; c < n; c++) {
      if (c === col) continue;
      const r = board[c];
      if (r === row || Math.abs(r - row) === Math.abs(c - col)) count++;
    }
    return count;
  };

  for (let iter = 0; iter < maxIterations; iter++) {
    const conflicted = conflicts(board);
    if (conflicted.length === 0) break;

    const conflictedCols = new Set<number>();
    for (const [a, b] of conflicted) {
      conflictedCols.add(a);
      conflictedCols.add(b);
    }
    const cols = Array.from(conflictedCols);
    const col = cols[Math.floor(rng() * cols.length)];

    let bestRows: number[] = [];
    let bestCount = Infinity;
    for (let row = 0; row < n; row++) {
      const count = conflictCountForRow(col, row);
      if (count < bestCount) {
        bestCount = count;
        bestRows = [row];
      } else if (count === bestCount) {
        bestRows.push(row);
      }
    }
    board[col] = bestRows[Math.floor(rng() * bestRows.length)];

    const nowSolved = conflicts(board).length === 0;
    steps.push({ board: board.slice(), action: nowSolved ? "solved" : "place", col, nodesExpanded: iter + 1, backtracks: 0 });
    if (nowSolved) return { steps, solved: true };
  }

  return { steps, solved: false };
}
