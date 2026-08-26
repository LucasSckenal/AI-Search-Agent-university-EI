/**
 * Connect Four (Lig 4): fixed 7x6 board, 4-in-a-row to win. Unlike Jogo da Velha's `game/model.ts`
 * (a resizable NxN board with arbitrary-cell placement), this board is fixed-size (mirrors Tetris's
 * fixed 10x20 well) and moves are column drops, not arbitrary cell placement - there's no
 * `applyMove(board, pos, player)` here, only `applyDrop(board, col, player)`, which resolves the
 * landing row itself via gravity. Kept fully independent of `game/model.ts` rather than generalizing
 * that module to non-square boards, matching this project's convention of one self-contained
 * `model.ts` per page.
 */

export type Player = 1 | -1; // 1 = vermelho, -1 = amarelo
export type Cell = Player | 0;
export type Board = Cell[]; // flat, row-major, COLS*ROWS, row 0 = top

export const COLS = 7;
export const ROWS = 6;
export const WIN_LENGTH = 4;

export function emptyBoard(): Board {
  return new Array(COLS * ROWS).fill(0);
}

export function cloneBoard(board: Board): Board {
  return board.slice();
}

/** Columns with at least one empty cell (the top row isn't yet filled). */
export function legalColumns(board: Board): number[] {
  const cols: number[] = [];
  for (let c = 0; c < COLS; c++) if (board[c] === 0) cols.push(c);
  return cols;
}

/** The row a piece dropped into this column would land on (gravity - lowest empty cell), or -1 if the column is full. */
export function dropRow(board: Board, col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r * COLS + col] === 0) return r;
  }
  return -1;
}

export function applyDrop(board: Board, col: number, player: Player): { board: Board; row: number } | null {
  const row = dropRow(board, col);
  if (row === -1) return null;
  const next = cloneBoard(board);
  next[row * COLS + col] = player;
  return { board: next, row };
}

export function isDraw(board: Board): boolean {
  return legalColumns(board).length === 0;
}

const LINE_DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/** Returns 1 or -1 if that player just completed a 4-in-a-row, 0 for no winner yet. */
export function checkWinner(board: Board): Player | 0 {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const player = board[r * COLS + c];
      if (player === 0) continue;
      for (const [dr, dc] of LINE_DIRS) {
        let count = 1;
        let rr = r + dr;
        let cc = c + dc;
        while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr * COLS + cc] === player) {
          count++;
          if (count >= WIN_LENGTH) return player;
          rr += dr;
          cc += dc;
        }
      }
    }
  }
  return 0;
}

/** Same scan as checkWinner, but returns the actual winning cells (for highlighting) or null. */
export function getWinningLine(board: Board): number[] | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const player = board[r * COLS + c];
      if (player === 0) continue;
      for (const [dr, dc] of LINE_DIRS) {
        const cells = [r * COLS + c];
        let rr = r + dr;
        let cc = c + dc;
        while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr * COLS + cc] === player) {
          cells.push(rr * COLS + cc);
          if (cells.length >= WIN_LENGTH) return cells;
          rr += dr;
          cc += dc;
        }
      }
    }
  }
  return null;
}

/**
 * Leaf heuristic for minimax: every open (not blocked by both colors) 4-cell window scores by how
 * many of the 4 slots are already filled - a 3-of-4 open window is worth far more than a lone piece,
 * since it's one move from winning, not just "generally central." Center-column pieces get a flat
 * bonus on top since the center column participates in the most winning lines on a 7-wide board -
 * the standard hand-tuned Connect Four evaluation shape.
 */
const WINDOW_WEIGHT: Record<number, number> = { 1: 1, 2: 10, 3: 50 };
const CENTER_COL = 3;
const CENTER_BONUS = 3;

function heuristicScore(board: Board): number {
  let score = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of LINE_DIRS) {
        const er = r + dr * (WIN_LENGTH - 1);
        const ec = c + dc * (WIN_LENGTH - 1);
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        let red = 0;
        let yellow = 0;
        for (let k = 0; k < WIN_LENGTH; k++) {
          const cell = board[(r + dr * k) * COLS + (c + dc * k)];
          if (cell === 1) red++;
          else if (cell === -1) yellow++;
        }
        if (red > 0 && yellow > 0) continue; // blocked window, contributes nothing
        if (red > 0) score += WINDOW_WEIGHT[red] ?? 0;
        else if (yellow > 0) score -= WINDOW_WEIGHT[yellow] ?? 0;
      }
    }
  }
  for (let r = 0; r < ROWS; r++) {
    const cell = board[r * COLS + CENTER_COL];
    if (cell === 1) score += CENTER_BONUS;
    else if (cell === -1) score -= CENTER_BONUS;
  }
  return score;
}

export interface GameConfig {
  maxDepth: number;
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

/** Center-out column order - the standard Connect Four move-ordering heuristic (center columns
 *  both win more often and prune alpha-beta harder as the first-tried branch). Columns don't move
 *  position like Jogo da Velha's cells do, so this is a fixed constant, not computed per call. */
const CENTER_ORDER = [3, 2, 4, 1, 5, 0, 6];

function orderedColumns(board: Board): number[] {
  const legal = new Set(legalColumns(board));
  return CENTER_ORDER.filter((c) => legal.has(c));
}

/**
 * Adversarial search over the game tree. `player` is who is about to move.
 * With useAlphaBeta=false this is plain minimax; with true it's minimax + alpha-beta pruning.
 * Both explore the identical game tree in principle and must return the same optimal move/score -
 * alpha-beta simply visits fewer nodes by cutting branches that can't affect the result.
 */
export function minimax(board: Board, player: Player, config: GameConfig, useAlphaBeta: boolean, maxNodes = 2_000_000): MinimaxResult {
  const t0 = performance.now();
  let nodesExplored = 0;
  let prunedBranches = 0;
  let maxDepthReached = 0;
  let truncated = false;

  function recurse(b: Board, p: Player, depth: number, alpha: number, beta: number): number {
    nodesExplored++;
    maxDepthReached = Math.max(maxDepthReached, depth);
    const winner = checkWinner(b);
    if (winner === 1) return 10_000 - depth;
    if (winner === -1) return -10_000 + depth;
    if (isDraw(b)) return 0;
    if (nodesExplored > maxNodes) {
      truncated = true;
      return heuristicScore(b);
    }
    if (depth >= config.maxDepth) return heuristicScore(b);

    const cols = orderedColumns(b);
    if (p === 1) {
      let best = -Infinity;
      for (const col of cols) {
        const dropped = applyDrop(b, col, p);
        if (!dropped) continue;
        const score = recurse(dropped.board, -1 as Player, depth + 1, alpha, beta);
        best = Math.max(best, score);
        if (useAlphaBeta) {
          alpha = Math.max(alpha, best);
          if (alpha >= beta) {
            prunedBranches += cols.length - cols.indexOf(col) - 1;
            break;
          }
        }
      }
      return best;
    } else {
      let best = Infinity;
      for (const col of cols) {
        const dropped = applyDrop(b, col, p);
        if (!dropped) continue;
        const score = recurse(dropped.board, 1 as Player, depth + 1, alpha, beta);
        best = Math.min(best, score);
        if (useAlphaBeta) {
          beta = Math.min(beta, best);
          if (alpha >= beta) {
            prunedBranches += cols.length - cols.indexOf(col) - 1;
            break;
          }
        }
      }
      return best;
    }
  }

  const cols = orderedColumns(board);
  let bestMove = cols[0] ?? -1;
  let bestScore = player === 1 ? -Infinity : Infinity;
  let alpha = -Infinity;
  let beta = Infinity;
  for (const col of cols) {
    const dropped = applyDrop(board, col, player);
    if (!dropped) continue;
    const score = recurse(dropped.board, (-player) as Player, 1, alpha, beta);
    if (player === 1 ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = col;
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

export interface MctsConfig {
  simulations: number;
  /** UCB1 exploration constant. Defaults to sqrt(2), the theoretically-derived value for rewards in [0,1] (Kocsis & Szepesvári). */
  explorationConstant?: number;
  /** Optional wall-clock safety valve - if set, simulations stop early once this budget is exceeded. */
  maxTimeMs?: number;
}

export interface MctsResult {
  move: number;
  /** The chosen move's win rate in [-1, 1] from `player`'s perspective (+1 = every rollout through
   *  this child was a win, -1 = every rollout was a loss, 0 = even/draws) - NOT the same scale as
   *  MinimaxResult.score (a near-terminal win/loss magnitude around +-10000). The two are different
   *  units and must be labeled separately wherever they're shown side by side. */
  score: number;
  nodesExplored: number;
  /** Always 0 - MCTS has no pruning; kept only so MctsResult/MinimaxResult share a shape for the comparison table. */
  prunedBranches: number;
  timeMs: number;
  /** Deepest selection-phase depth reached (root = 0) across all simulations. */
  maxDepthReached: number;
  /** True if maxTimeMs cut the run short before the simulation budget finished. */
  truncated: boolean;
}

interface MctsNode {
  board: Board;
  playerToMove: Player;
  parent: MctsNode | null;
  /** The player who made the move landing on this node (0 for the root, which has no move-in). Used
   *  to backpropagate each rollout's outcome into "was this a good move for whoever made it." */
  moverSign: Player | 0;
  children: Map<number, MctsNode>;
  untried: number[];
  visits: number;
  /** Sum of rollout outcomes (+1 win / -1 loss / 0 draw) from `moverSign`'s perspective. */
  value: number;
}

function makeNode(board: Board, playerToMove: Player, parent: MctsNode | null, moverSign: Player | 0): MctsNode {
  return { board, playerToMove, parent, moverSign, children: new Map(), untried: legalColumns(board), visits: 0, value: 0 };
}

function ucb1Select(node: MctsNode, c: number): MctsNode {
  let best: MctsNode | null = null;
  let bestScore = -Infinity;
  for (const child of node.children.values()) {
    const exploitation = child.value / child.visits;
    const exploration = c * Math.sqrt(Math.log(node.visits) / child.visits);
    const score = exploitation + exploration;
    if (score > bestScore) {
      bestScore = score;
      best = child;
    }
  }
  return best!;
}

/**
 * Monte Carlo Tree Search: builds the search tree asymmetrically by repeatedly running the 4
 * classic phases (select via UCB1, expand one untried move, simulate a random rollout to a
 * terminal, backpropagate the outcome) instead of exhaustively enumerating the tree like minimax -
 * this is what lets it scale to positions where full-depth minimax is too expensive, at the cost of
 * an approximate (not provably optimal) answer. `rng` is injectable so results are reproducible
 * with `seededRng` from `core/rng.ts` (see that module's own doc comment on why determinism matters
 * for a citable, reproducible result) - production callers can omit it and get `Math.random`.
 */
export function mcts(board: Board, player: Player, config: MctsConfig, rng: () => number = Math.random): MctsResult {
  const t0 = performance.now();
  const c = config.explorationConstant ?? Math.SQRT2;
  const root = makeNode(board, player, null, 0);
  let maxDepthReached = 0;
  let truncated = false;
  let simulationsRun = 0;

  for (let i = 0; i < config.simulations; i++) {
    if (config.maxTimeMs !== undefined && performance.now() - t0 > config.maxTimeMs) {
      truncated = true;
      break;
    }
    simulationsRun++;

    // 1. Selection: descend via UCB1 while fully expanded and non-terminal.
    let node = root;
    let depth = 0;
    while (node.untried.length === 0 && node.children.size > 0 && checkWinner(node.board) === 0 && !isDraw(node.board)) {
      node = ucb1Select(node, c);
      depth++;
    }
    maxDepthReached = Math.max(maxDepthReached, depth);

    const winnerHere = checkWinner(node.board);
    let outcome: Player | 0;
    if (winnerHere !== 0 || isDraw(node.board)) {
      // Terminal node reached during selection - nothing to expand/simulate, just score it directly.
      outcome = winnerHere;
    } else {
      // 2. Expansion: pick one untried column at random.
      const idx = Math.floor(rng() * node.untried.length);
      const col = node.untried[idx];
      node.untried.splice(idx, 1);
      const dropped = applyDrop(node.board, col, node.playerToMove)!;
      const child = makeNode(dropped.board, (-node.playerToMove) as Player, node, node.playerToMove);
      node.children.set(col, child);
      node = child;

      // 3. Simulation: uniformly random legal moves to a terminal state.
      let rolloutBoard = node.board;
      let rolloutPlayer = node.playerToMove;
      let winner = checkWinner(rolloutBoard);
      while (winner === 0 && !isDraw(rolloutBoard)) {
        const legal = legalColumns(rolloutBoard);
        const move = legal[Math.floor(rng() * legal.length)];
        rolloutBoard = applyDrop(rolloutBoard, move, rolloutPlayer)!.board;
        rolloutPlayer = (-rolloutPlayer) as Player;
        winner = checkWinner(rolloutBoard);
      }
      outcome = winner;
    }

    // 4. Backpropagation: walk back to the root, flipping the outcome's sign relative to whoever
    // moved into each node (a win for player 1 is a "+1" contribution to nodes player 1 moved into,
    // a "-1" contribution to nodes player -1 moved into).
    let n: MctsNode | null = node;
    while (n) {
      n.visits++;
      if (n.moverSign !== 0) n.value += outcome * n.moverSign;
      n = n.parent;
    }
  }

  let bestMove = -1;
  let bestVisits = -1;
  let bestScore = 0;
  for (const [col, child] of root.children) {
    if (child.visits > bestVisits) {
      bestVisits = child.visits;
      bestMove = col;
      bestScore = child.visits > 0 ? child.value / child.visits : 0;
    }
  }
  if (bestMove === -1) {
    // Degenerate: budget too small to expand even once (or no legal moves at all).
    const legal = legalColumns(board);
    bestMove = legal[0] ?? -1;
  }

  return {
    move: bestMove,
    score: bestScore,
    nodesExplored: simulationsRun,
    prunedBranches: 0,
    timeMs: performance.now() - t0,
    maxDepthReached,
    truncated,
  };
}
