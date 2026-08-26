/** 2048: slide-and-merge tile puzzle, solved with Expectimax - minimax's stochastic sibling, needed
 *  because the "opponent" here isn't adversarial, it's a random tile spawn with a known distribution. */
import { seededRng } from "../core/rng";

export type Board = number[]; // flat, row-major, length size*size, 0 = empty
export type Direction = "up" | "down" | "left" | "right";

const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

function getRow(board: Board, size: number, r: number): number[] {
  return board.slice(r * size, r * size + size);
}

function setRow(board: Board, size: number, r: number, row: number[]): void {
  for (let c = 0; c < size; c++) board[r * size + c] = row[c];
}

function getCol(board: Board, size: number, c: number): number[] {
  const col: number[] = [];
  for (let r = 0; r < size; r++) col.push(board[r * size + c]);
  return col;
}

function setCol(board: Board, size: number, c: number, col: number[]): void {
  for (let r = 0; r < size; r++) board[r * size + c] = col[r];
}

function rowIndices(size: number, r: number): number[] {
  return Array.from({ length: size }, (_, c) => r * size + c);
}

function colIndices(size: number, c: number): number[] {
  return Array.from({ length: size }, (_, r) => r * size + c);
}

/** One board cell's slide destination for the current move - `from`/`to` are full-board indices,
 *  not line-local ones. A merge produces two TileMoves sharing the same `to` (both source tiles
 *  slide onto the same cell, exactly like the real game renders it), which is also how the grid
 *  component tells a merge apart from a plain slide. */
export interface TileMove {
  from: number;
  to: number;
}

/** Slides one line toward index 0, merging each equal adjacent pair once (leading edge first) -
 *  the one place merge logic lives; every direction reuses this on a row/column, reversed or not.
 *  `moveMap[i]` is the destination line-local index for the tile that started at line-local index
 *  `i` (or null if that cell was empty) - the caller maps this back to full-board coordinates. */
function slideRow(line: number[]): { row: number[]; scoreDelta: number; moveMap: (number | null)[] } {
  const nonEmpty: { value: number; index: number }[] = [];
  line.forEach((v, i) => {
    if (v !== 0) nonEmpty.push({ value: v, index: i });
  });
  const row: number[] = [];
  const moveMap: (number | null)[] = new Array(line.length).fill(null);
  let scoreDelta = 0;
  let i = 0;
  let outIndex = 0;
  while (i < nonEmpty.length) {
    if (i + 1 < nonEmpty.length && nonEmpty[i].value === nonEmpty[i + 1].value) {
      const merged = nonEmpty[i].value * 2;
      row.push(merged);
      scoreDelta += merged;
      moveMap[nonEmpty[i].index] = outIndex;
      moveMap[nonEmpty[i + 1].index] = outIndex;
      outIndex++;
      i += 2;
    } else {
      row.push(nonEmpty[i].value);
      moveMap[nonEmpty[i].index] = outIndex;
      outIndex++;
      i += 1;
    }
  }
  while (row.length < line.length) row.push(0);
  return { row, scoreDelta, moveMap };
}

export interface MoveResult {
  board: Board;
  scoreDelta: number;
  /** False for an illegal move - the board is unchanged and the caller must not spawn a tile. */
  moved: boolean;
  /** Every occupied cell's slide destination, in full-board indices, for the grid's slide
   *  animation. Empty when the move was illegal. */
  moves: TileMove[];
}

export function applyMove(board: Board, size: number, direction: Direction): MoveResult {
  const next = board.slice();
  let scoreDelta = 0;
  const reversed = direction === "right" || direction === "down";
  const moves: TileMove[] = [];

  const runLine = (line: number[], lineIndices: number[]): number[] => {
    const input = reversed ? line.slice().reverse() : line;
    const inputIndices = reversed ? lineIndices.slice().reverse() : lineIndices;
    const { row, scoreDelta: delta, moveMap } = slideRow(input);
    scoreDelta += delta;
    for (let k = 0; k < input.length; k++) {
      const dest = moveMap[k];
      if (dest === null) continue;
      const destLocal = reversed ? input.length - 1 - dest : dest;
      moves.push({ from: inputIndices[k], to: lineIndices[destLocal] });
    }
    return reversed ? row.slice().reverse() : row;
  };

  if (direction === "left" || direction === "right") {
    for (let r = 0; r < size; r++) {
      const indices = rowIndices(size, r);
      setRow(next, size, r, runLine(getRow(next, size, r), indices));
    }
  } else {
    for (let c = 0; c < size; c++) {
      const indices = colIndices(size, c);
      setCol(next, size, c, runLine(getCol(next, size, c), indices));
    }
  }

  const moved = next.some((v, i) => v !== board[i]);
  return { board: next, scoreDelta, moved, moves: moved ? moves : [] };
}

export function emptyCells(board: Board): number[] {
  const out: number[] = [];
  for (let i = 0; i < board.length; i++) if (board[i] === 0) out.push(i);
  return out;
}

export function legalMoves(board: Board, size: number): Direction[] {
  return DIRECTIONS.filter((d) => applyMove(board, size, d).moved);
}

/** Two rng() draws in a fixed order (cell, then value) - preserved exactly so a seed reproduces an
 *  identical spawn sequence, which is what lets the Comparison mode run Greedy and Expectimax on the
 *  exact same starting board and tile draws. */
export function spawnTile(board: Board, rng: () => number): { board: Board; index: number; value: 2 | 4 } {
  const empties = emptyCells(board);
  const index = empties[Math.floor(rng() * empties.length)];
  const value: 2 | 4 = rng() < 0.9 ? 2 : 4;
  const next = board.slice();
  next[index] = value;
  return { board: next, index, value };
}

export interface HeuristicWeights {
  empty: number;
  mono: number;
  smooth: number;
  corner: number;
}

/** Hand-picked, directionally sensible starting point - not claimed optimal. The Algoritmo
 *  Genético mode exists precisely to search for something better than this fixed guess. */
export const DEFAULT_WEIGHTS: HeuristicWeights = { empty: 2.7, mono: 1.0, smooth: 0.1, corner: 1.0 };

function log2(v: number): number {
  return v === 0 ? 0 : Math.log2(v);
}

/** Weighted-sum board heuristic: reward open space and a well-ordered board, penalize jagged
 *  neighboring values, reward keeping the largest tile pinned in a corner where it won't get boxed
 *  in. `weights` defaults to a fixed hand-tuned guess (Heurística Gulosa's own decision function);
 *  the Algoritmo Genético mode calls this same function with evolved weights instead. */
export function evaluateBoard(board: Board, size: number, weights: HeuristicWeights = DEFAULT_WEIGHTS): number {
  const empties = emptyCells(board).length;

  let monotonicity = 0;
  const scanLine = (line: number[]) => {
    let inc = 0;
    let dec = 0;
    for (let i = 0; i < line.length - 1; i++) {
      const a = log2(line[i]);
      const b = log2(line[i + 1]);
      if (a > b) dec += a - b;
      else if (b > a) inc += b - a;
    }
    monotonicity -= Math.min(inc, dec);
  };
  for (let r = 0; r < size; r++) scanLine(getRow(board, size, r));
  for (let c = 0; c < size; c++) scanLine(getCol(board, size, c));

  let smoothness = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = board[r * size + c];
      if (v === 0) continue;
      if (c + 1 < size) {
        const right = board[r * size + c + 1];
        if (right !== 0) smoothness -= Math.abs(log2(v) - log2(right));
      }
      if (r + 1 < size) {
        const down = board[(r + 1) * size + c];
        if (down !== 0) smoothness -= Math.abs(log2(v) - log2(down));
      }
    }
  }

  let maxTile = 0;
  let maxIndex = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i] > maxTile) {
      maxTile = board[i];
      maxIndex = i;
    }
  }
  const corners = [0, size - 1, size * (size - 1), size * size - 1];
  const cornerBonus = maxTile > 0 && corners.includes(maxIndex) ? log2(maxTile) : 0;

  return empties * weights.empty + monotonicity * weights.mono + smoothness * weights.smooth + cornerBonus * weights.corner;
}

export interface GreedyResult {
  move: Direction | null;
  score: number;
  nodesExplored: number;
  timeMs: number;
}

/** No lookahead at all: evaluate the board immediately after each legal move and take the best -
 *  ignorant of what tile will spawn next, unlike Expectimax. Ties keep the earliest direction in
 *  fixed order, so this is fully deterministic given a board (no RNG involved in the choice itself).
 *  `weights` defaults to the fixed hand-tuned guess (Heurística Gulosa); the Algoritmo Genético mode
 *  reuses this exact same zero-lookahead decision procedure with evolved weights instead - the two
 *  modes differ only in where the weights came from, not in how a move is chosen. */
export function greedyMove(board: Board, size: number, weights: HeuristicWeights = DEFAULT_WEIGHTS): GreedyResult {
  const t0 = performance.now();
  let bestMove: Direction | null = null;
  let bestScore = -Infinity;
  let nodesExplored = 0;

  for (const d of DIRECTIONS) {
    const result = applyMove(board, size, d);
    if (!result.moved) continue;
    nodesExplored++;
    const score = evaluateBoard(result.board, size, weights);
    if (score > bestScore) {
      bestScore = score;
      bestMove = d;
    }
  }

  return { move: bestMove, score: bestMove ? bestScore : 0, nodesExplored, timeMs: performance.now() - t0 };
}

export interface ExpectimaxResult {
  move: Direction | null;
  score: number;
  nodesExplored: number;
  maxDepthReached: number;
  truncated: boolean;
  timeMs: number;
}

/**
 * Expectimax: minimax's stochastic sibling. MAX nodes are the agent's own move choice; CHANCE nodes
 * are the tile that spawns afterward - not an adversary trying to minimize the agent's score, but a
 * random event with a known distribution (90% a "2", 10% a "4", uniform over empty cells).
 *
 * Approximation: a true chance node enumerates every (empty cell x {2,4}) outcome - 2x the empty-cell
 * count per ply, compounding multiplicatively with depth, which is intractable synchronously in a
 * browser tab once a board has more than a handful of empty cells. This only enumerates the dominant
 * "2" outcome (90% of real spawns) at each empty cell, weighted uniformly - halving the branching
 * factor at every ply, at the cost of a small, well-understood optimistic bias (a "4" spawn is
 * marginally worse for the player than a "2", so ignoring it never makes the agent look worse than
 * it actually is). On top of that, a chance node samples at most `MAX_CHANCE_SAMPLES` empty cells
 * (an evenly-spaced subset by index, not random - keeps a run reproducible without touching the
 * game's own RNG stream) instead of every one of them: branching from board emptiness alone would
 * otherwise scale with board size (up to 36 cells on a 6x6 board) and made even depth=2 take over a
 * minute per move on a mostly-empty large board during testing. Sampling caps the branching factor
 * to a constant regardless of board size, trading a bit of chance-node precision for the search
 * actually finishing in a browser tab.
 *
 * `depth` counts MAX+CHANCE pairs, i.e. full turns: depth=1 picks the best move, averages over where
 * the resulting tile could land, and heuristically evaluates each outcome with no further lookahead;
 * each additional depth unit buys one more full turn of real search before falling back to the
 * heuristic. Same `maxNodes` budget/graceful-truncation pattern as game/model.ts's `minimax`.
 */
const MAX_CHANCE_SAMPLES = 4;

export function expectimax(board: Board, size: number, depth: number, maxNodes = 1_500): ExpectimaxResult {
  const t0 = performance.now();
  let nodesExplored = 0;
  let maxDepthReached = 0;
  let truncated = false;

  function maxNode(b: Board, depthRemaining: number, ply: number): number {
    nodesExplored++;
    maxDepthReached = Math.max(maxDepthReached, ply);
    if (nodesExplored > maxNodes) {
      truncated = true;
      return evaluateBoard(b, size);
    }
    const moves = legalMoves(b, size);
    if (moves.length === 0 || depthRemaining <= 0) return evaluateBoard(b, size);

    let best = -Infinity;
    for (const d of moves) {
      const { board: nb } = applyMove(b, size, d);
      best = Math.max(best, chanceNode(nb, depthRemaining - 1, ply));
    }
    return best;
  }

  function chanceNode(b: Board, depthRemaining: number, ply: number): number {
    nodesExplored++;
    if (nodesExplored > maxNodes) {
      truncated = true;
      return evaluateBoard(b, size);
    }
    const empties = emptyCells(b);
    if (empties.length === 0) return maxNode(b, depthRemaining, ply + 1);

    const sampled =
      empties.length <= MAX_CHANCE_SAMPLES
        ? empties
        : Array.from({ length: MAX_CHANCE_SAMPLES }, (_, i) => empties[Math.floor((i * empties.length) / MAX_CHANCE_SAMPLES)]);

    let expected = 0;
    const weight = 1 / sampled.length;
    for (const cell of sampled) {
      const spawned = b.slice();
      spawned[cell] = 2;
      expected += maxNode(spawned, depthRemaining, ply + 1) * weight;
    }
    return expected;
  }

  const moves = legalMoves(board, size);
  let bestMove: Direction | null = null;
  let bestScore = -Infinity;
  for (const d of moves) {
    const { board: nb } = applyMove(board, size, d);
    const score = chanceNode(nb, depth - 1, 1);
    if (score > bestScore) {
      bestScore = score;
      bestMove = d;
    }
  }

  return {
    move: bestMove,
    score: bestMove ? bestScore : 0,
    nodesExplored,
    maxDepthReached,
    truncated,
    timeMs: performance.now() - t0,
  };
}

export const WIN_TILE = 2048;

export interface Game2048Config {
  size: number;
  mode: "greedy" | "expectimax" | "genetic";
  expectimaxDepth: number;
  seed: number;
  /** Safety cap on move count - real games always end (the board eventually fills up), but a
   *  pathological config shouldn't be able to hang the tab. */
  maxMoves: number;
  maxNodes?: number;
  /** Only meaningful for mode "genetic" - the evolved weights to play with (falls back to
   *  DEFAULT_WEIGHTS if omitted, which would make "genetic" behave identically to "greedy"). */
  weights?: HeuristicWeights;
}

export interface Game2048Step {
  /** Board after this move resolved AND the new tile spawned. */
  board: Board;
  direction: Direction;
  scoreDelta: number;
  cumulativeScore: number;
  spawnedIndex: number;
  spawnedValue: 2 | 4;
  /** Slide destinations for the move that produced this step (see TileMove), read against the
   *  *previous* step's board - lets the grid animate tiles sliding instead of jumping in place. */
  moves: TileMove[];
  nodesExplored: number;
  maxDepthReached: number;
  truncated: boolean;
  timeMs: number;
}

export interface Game2048Result {
  initialBoard: Board;
  steps: Game2048Step[];
  finalScore: number;
  maxTile: number;
  totalMoves: number;
  won: boolean;
  /** True if `maxMoves` was hit while the board still had legal moves left. */
  truncated: boolean;
  config: Game2048Config;
}

function createEmptyBoard(size: number): Board {
  return new Array(size * size).fill(0);
}

/** The 2-tile starting position for a given size/seed, with no agent involved - lets the page show
 *  a real board before any run, the same way tsp/rl show their raw instance up front. */
export function startingBoard(size: number, seed: number): Board {
  const rng = seededRng(seed);
  let board = createEmptyBoard(size);
  ({ board } = spawnTile(board, rng));
  ({ board } = spawnTile(board, rng));
  return board;
}

/** Plays a full game autonomously, from an empty board to game-over (or the `maxMoves` safety cap),
 *  one synchronous call producing every step up front - the page scrubs through the finished game
 *  with the Timeline component instead of animating moves as they're decided in real time. */
export function runGame(config: Game2048Config): Game2048Result {
  const rng = seededRng(config.seed);
  let board = createEmptyBoard(config.size);
  ({ board } = spawnTile(board, rng));
  ({ board } = spawnTile(board, rng));
  const initialBoard = board.slice();

  const steps: Game2048Step[] = [];
  let cumulativeScore = 0;

  for (let move = 0; move < config.maxMoves; move++) {
    const legal = legalMoves(board, config.size);
    if (legal.length === 0) break;

    const agentResult =
      config.mode === "expectimax"
        ? expectimax(board, config.size, config.expectimaxDepth, config.maxNodes)
        : { ...greedyMove(board, config.size, config.mode === "genetic" ? config.weights : undefined), maxDepthReached: 0, truncated: false };

    const direction = agentResult.move ?? legal[0];
    const { board: movedBoard, scoreDelta, moves } = applyMove(board, config.size, direction);
    const { board: spawnedBoard, index: spawnedIndex, value: spawnedValue } = spawnTile(movedBoard, rng);

    cumulativeScore += scoreDelta;
    board = spawnedBoard;

    steps.push({
      board,
      direction,
      scoreDelta,
      cumulativeScore,
      spawnedIndex,
      spawnedValue,
      moves,
      nodesExplored: agentResult.nodesExplored,
      maxDepthReached: agentResult.maxDepthReached,
      truncated: agentResult.truncated,
      timeMs: agentResult.timeMs,
    });
  }

  const truncated = steps.length === config.maxMoves && legalMoves(board, config.size).length > 0;
  const maxTile = Math.max(...board);

  return {
    initialBoard,
    steps,
    finalScore: cumulativeScore,
    maxTile,
    totalMoves: steps.length,
    won: maxTile >= WIN_TILE,
    truncated,
    config,
  };
}
