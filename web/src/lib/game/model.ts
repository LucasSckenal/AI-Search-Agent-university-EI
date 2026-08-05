/** Generalized tic-tac-toe: NxN board, K-in-a-row to win, solved with adversarial search. */

export type Player = 1 | -1; // 1 = X (maximizing), -1 = O (minimizing)
export type Cell = Player | 0;
export type Board = Cell[]; // flattened, row-major, length size*size

export interface GameConfig {
  size: number;
  winLength: number;
  maxDepth: number; // full-depth search when maxDepth >= size*size
}

export function createBoard(size: number): Board {
  return new Array(size * size).fill(0);
}

export function cloneBoard(board: Board): Board {
  return board.slice();
}

export function availableMoves(board: Board): number[] {
  const moves: number[] = [];
  for (let i = 0; i < board.length; i++) if (board[i] === 0) moves.push(i);
  return moves;
}

export function applyMove(board: Board, pos: number, player: Player): Board {
  const next = cloneBoard(board);
  next[pos] = player;
  return next;
}

const LINE_DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/** Returns 1 or -1 if that player just completed a winLength run, 0 for no winner yet. */
export function checkWinner(board: Board, size: number, winLength: number): Player | 0 {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const player = board[r * size + c];
      if (player === 0) continue;
      for (const [dr, dc] of LINE_DIRS) {
        let count = 1;
        let rr = r + dr;
        let cc = c + dc;
        while (rr >= 0 && rr < size && cc >= 0 && cc < size && board[rr * size + cc] === player) {
          count++;
          if (count >= winLength) return player;
          rr += dr;
          cc += dc;
        }
      }
    }
  }
  return 0;
}

export function isDraw(board: Board): boolean {
  return board.every((c) => c !== 0);
}

/** Same scan as checkWinner, but returns the actual winning cells (for highlighting) or null. */
export function getWinningLine(board: Board, size: number, winLength: number): number[] | null {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const player = board[r * size + c];
      if (player === 0) continue;
      for (const [dr, dc] of LINE_DIRS) {
        const cells = [r * size + c];
        let rr = r + dr;
        let cc = c + dc;
        while (rr >= 0 && rr < size && cc >= 0 && cc < size && board[rr * size + cc] === player) {
          cells.push(rr * size + cc);
          if (cells.length >= winLength) return cells;
          rr += dr;
          cc += dc;
        }
      }
    }
  }
  return null;
}

/** All winLength-cell windows still open for `player` (no opposing mark inside), weighted by fill count. */
function heuristicScore(board: Board, size: number, winLength: number): number {
  let score = 0;
  const scanWindow = (cells: Cell[]) => {
    const x = cells.filter((c) => c === 1).length;
    const o = cells.filter((c) => c === -1).length;
    if (x > 0 && o > 0) return; // blocked window, contributes nothing
    if (x > 0) score += x * x;
    else if (o > 0) score -= o * o;
  };
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      for (const [dr, dc] of LINE_DIRS) {
        const er = r + dr * (winLength - 1);
        const ec = c + dc * (winLength - 1);
        if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
        const cells: Cell[] = [];
        for (let k = 0; k < winLength; k++) cells.push(board[(r + dr * k) * size + (c + dc * k)]);
        scanWindow(cells);
      }
    }
  }
  return score;
}

export interface MinimaxResult {
  move: number;
  score: number;
  nodesExplored: number;
  prunedBranches: number;
  timeMs: number;
  maxDepthReached: number;
  /** True if the node budget was hit before the tree finished - the move is a best-effort choice
   *  from partial heuristic evaluation, not a proven-optimal minimax value. */
  truncated: boolean;
}

function orderedMoves(board: Board, size: number): number[] {
  const center = (size - 1) / 2;
  return availableMoves(board).sort((a, b) => {
    const ar = Math.floor(a / size) - center;
    const ac = (a % size) - center;
    const br = Math.floor(b / size) - center;
    const bc = (b % size) - center;
    return ar * ar + ac * ac - (br * br + bc * bc);
  });
}

/**
 * Adversarial search over the game tree. `player` is who is about to move.
 * With useAlphaBeta=false this is plain minimax; with true it's minimax + alpha-beta pruning.
 * Both explore the identical game tree in principle and must return the same optimal move/score -
 * alpha-beta simply visits fewer nodes by cutting branches that can't affect the result.
 */
export function minimax(
  board: Board,
  player: Player,
  config: GameConfig,
  useAlphaBeta: boolean,
  maxNodes = 2_000_000
): MinimaxResult {
  const t0 = performance.now();
  let nodesExplored = 0;
  let prunedBranches = 0;
  let maxDepthReached = 0;
  let truncated = false;

  function recurse(b: Board, p: Player, depth: number, alpha: number, beta: number): number {
    nodesExplored++;
    maxDepthReached = Math.max(maxDepthReached, depth);
    const winner = checkWinner(b, config.size, config.winLength);
    if (winner === 1) return 10_000 - depth;
    if (winner === -1) return -10_000 + depth;
    if (isDraw(b)) return 0;
    // Safety valve: a board large enough (or a maxDepth set high enough) that the tree simply
    // doesn't fit in a browser tab's budget degrades gracefully to a heuristic-only evaluation of
    // whatever's left, instead of hanging the UI thread - same pattern as search()'s maxNodes.
    if (nodesExplored > maxNodes) {
      truncated = true;
      return heuristicScore(b, config.size, config.winLength);
    }
    if (depth >= config.maxDepth) return heuristicScore(b, config.size, config.winLength);

    const moves = orderedMoves(b, config.size);
    if (p === 1) {
      let best = -Infinity;
      for (const m of moves) {
        const score = recurse(applyMove(b, m, p), -1 as Player, depth + 1, alpha, beta);
        best = Math.max(best, score);
        if (useAlphaBeta) {
          alpha = Math.max(alpha, best);
          if (alpha >= beta) {
            prunedBranches += moves.length - moves.indexOf(m) - 1;
            break;
          }
        }
      }
      return best;
    } else {
      let best = Infinity;
      for (const m of moves) {
        const score = recurse(applyMove(b, m, p), 1 as Player, depth + 1, alpha, beta);
        best = Math.min(best, score);
        if (useAlphaBeta) {
          beta = Math.min(beta, best);
          if (alpha >= beta) {
            prunedBranches += moves.length - moves.indexOf(m) - 1;
            break;
          }
        }
      }
      return best;
    }
  }

  const moves = orderedMoves(board, config.size);
  let bestMove = moves[0] ?? -1;
  let bestScore = player === 1 ? -Infinity : Infinity;
  let alpha = -Infinity;
  let beta = Infinity;
  for (const m of moves) {
    const score = recurse(applyMove(board, m, player), (-player) as Player, 1, alpha, beta);
    if (player === 1 ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = m;
    }
    if (useAlphaBeta) {
      if (player === 1) alpha = Math.max(alpha, bestScore);
      else beta = Math.min(beta, bestScore);
    }
  }

  return {
    move: bestMove,
    score: bestScore,
    nodesExplored,
    prunedBranches,
    timeMs: performance.now() - t0,
    maxDepthReached,
    truncated,
  };
}
