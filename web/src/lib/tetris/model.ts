import { seededRng } from "../core/rng";

export const WIDTH = 10;
export const HEIGHT = 20;

/** Flat, row-major, WIDTH*HEIGHT. 0 = empty, else a 1-7 piece-type id (see PIECE_ORDER) used to
 *  pick the locked block's color. */
export type Board = number[];

export type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export const PIECE_ORDER: PieceType[] = ["I", "O", "T", "S", "Z", "J", "L"];

export interface ActivePiece {
  type: PieceType;
  rotation: 0 | 1 | 2 | 3;
  /** Top-left of the piece's 4x4 bounding box, in board coordinates. */
  x: number;
  y: number;
}

// Every piece is defined once, in its spawn orientation, as cells inside a 4x4 box - the other 3
// rotation states are derived (see rotateCells below) instead of hand-transcribed, so there's no
// chance of a typo silently producing a malformed S/Z/J/L at some rotation that only shows up once
// that rotation happens to occur during play.
const BOX = 4;
const SPAWN_CELLS: Record<PieceType, [number, number][]> = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};

/** 90° clockwise rotation of a point inside an N x N box: (x,y) -> (N-1-y, x). */
function rotateCells(cells: [number, number][]): [number, number][] {
  return cells.map(([x, y]): [number, number] => [BOX - 1 - y, x]);
}

const PIECE_ROTATIONS: Record<PieceType, [number, number][][]> = (() => {
  const table = {} as Record<PieceType, [number, number][][]>;
  for (const type of PIECE_ORDER) {
    const states: [number, number][][] = [SPAWN_CELLS[type]];
    for (let i = 1; i < 4; i++) states.push(rotateCells(states[i - 1]));
    table[type] = states;
  }
  return table;
})();

export function emptyBoard(): Board {
  return new Array(WIDTH * HEIGHT).fill(0);
}

function cellsOf(piece: Pick<ActivePiece, "type" | "rotation">): [number, number][] {
  return PIECE_ROTATIONS[piece.type][piece.rotation];
}

/** Every cell a piece occupies, in board coordinates. */
export function absoluteCells(piece: ActivePiece): [number, number][] {
  return cellsOf(piece).map(([dx, dy]): [number, number] => [piece.x + dx, piece.y + dy]);
}

function fitsAt(board: Board, cells: [number, number][], x: number, y: number): boolean {
  for (const [dx, dy] of cells) {
    const ax = x + dx;
    const ay = y + dy;
    if (ax < 0 || ax >= WIDTH || ay < 0 || ay >= HEIGHT) return false;
    if (board[ay * WIDTH + ax] !== 0) return false;
  }
  return true;
}

export function isValidPosition(board: Board, piece: ActivePiece): boolean {
  return fitsAt(board, cellsOf(piece), piece.x, piece.y);
}

/** Spawns a piece centered at the top of the board (row 0 of its own 4x4 box lines up with board
 *  row 0 - no piece's spawn shape has any cell above its own box row 0, so this is always the
 *  highest a piece can appear). Returns null if the spawn cell is already occupied (game over). */
export function spawnPiece(board: Board, type: PieceType): ActivePiece | null {
  const piece: ActivePiece = { type, rotation: 0, x: Math.floor((WIDTH - BOX) / 2), y: 0 };
  return isValidPosition(board, piece) ? piece : null;
}

export function tryMove(board: Board, piece: ActivePiece, dx: number, dy: number): ActivePiece | null {
  const next: ActivePiece = { ...piece, x: piece.x + dx, y: piece.y + dy };
  return isValidPosition(board, next) ? next : null;
}

// Wall kicks are deliberately simple (try the rotation in place, then nudged 1-2 cells sideways)
// rather than the full SRS kick tables - enough to keep rotation from feeling broken against a
// wall or a neighboring stack, without signing up to reproduce competitive-Tetris-exact kick rules.
const KICK_OFFSETS: [number, number][] = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]];

export function tryRotate(board: Board, piece: ActivePiece, dir: 1 | -1): ActivePiece | null {
  const rotation = ((piece.rotation + dir + 4) % 4) as ActivePiece["rotation"];
  const cells = cellsOf({ type: piece.type, rotation });
  for (const [kx, ky] of KICK_OFFSETS) {
    const x = piece.x + kx;
    const y = piece.y + ky;
    if (fitsAt(board, cells, x, y)) return { type: piece.type, rotation, x, y };
  }
  return null;
}

export function hardDropTarget(board: Board, piece: ActivePiece): ActivePiece {
  let current = piece;
  for (;;) {
    const next = tryMove(board, current, 0, 1);
    if (!next) return current;
    current = next;
  }
}

export interface LockResult {
  board: Board;
  linesCleared: number;
}

/** Writes the piece into the board and clears any fully-filled rows. */
export function lockPiece(board: Board, piece: ActivePiece): LockResult {
  const next = board.slice();
  const colorId = PIECE_ORDER.indexOf(piece.type) + 1;
  for (const [ax, ay] of absoluteCells(piece)) next[ay * WIDTH + ax] = colorId;

  const keptRows: number[][] = [];
  let linesCleared = 0;
  for (let row = 0; row < HEIGHT; row++) {
    const cells = next.slice(row * WIDTH, row * WIDTH + WIDTH);
    if (cells.every((c) => c !== 0)) linesCleared++;
    else keptRows.push(cells);
  }
  const cleared = emptyBoard();
  const offset = HEIGHT - keptRows.length;
  for (let i = 0; i < keptRows.length; i++) {
    for (let col = 0; col < WIDTH; col++) cleared[(offset + i) * WIDTH + col] = keptRows[i][col];
  }
  return { board: cleared, linesCleared };
}

// ---------------------------------------------------------------------------------------------
// 7-bag randomizer: every piece exactly once per bag, shuffled - guideline-standard sequencing
// that avoids the long droughts/floods of a piece a pure uniform random draw can produce, and (for
// "IA vs Você") lets two boards share the exact same piece order for a fair race.
// ---------------------------------------------------------------------------------------------

export function shuffledBag(rng: () => number): PieceType[] {
  const bag = PIECE_ORDER.slice();
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export function makePieceQueue(seed: number): { next: () => PieceType } {
  const rng = seededRng(seed);
  let bag: PieceType[] = [];
  return {
    next: () => {
      if (bag.length === 0) bag = shuffledBag(rng);
      return bag.shift()!;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Heuristic - the standard 4-feature board evaluation (lines cleared, aggregate column height,
// holes, bumpiness) used by most introductory Tetris bots. All weights are stored as non-negative
// magnitudes; the sign of each term is fixed in evaluateBoard, not the weight itself - same
// convention 2048's HeuristicWeights uses, so a genetic algorithm mutating these can never flip a
// term's intended direction (e.g. "holes are good, actually") by drifting negative.
// ---------------------------------------------------------------------------------------------

export interface HeuristicWeights {
  lines: number;
  height: number;
  holes: number;
  bumpiness: number;
}

export const DEFAULT_WEIGHTS: HeuristicWeights = { lines: 1.0, height: 0.51, holes: 0.76, bumpiness: 0.18 };

function columnHeights(board: Board): number[] {
  const heights = new Array(WIDTH).fill(0);
  for (let col = 0; col < WIDTH; col++) {
    for (let row = 0; row < HEIGHT; row++) {
      if (board[row * WIDTH + col] !== 0) {
        heights[col] = HEIGHT - row;
        break;
      }
    }
  }
  return heights;
}

function countHoles(board: Board, heights: number[]): number {
  let holes = 0;
  for (let col = 0; col < WIDTH; col++) {
    const topRow = HEIGHT - heights[col];
    for (let row = topRow + 1; row < HEIGHT; row++) {
      if (board[row * WIDTH + col] === 0) holes++;
    }
  }
  return holes;
}

export function evaluateBoard(board: Board, linesCleared: number, weights: HeuristicWeights = DEFAULT_WEIGHTS): number {
  const heights = columnHeights(board);
  const aggregateHeight = heights.reduce((a, b) => a + b, 0);
  const holes = countHoles(board, heights);
  let bumpiness = 0;
  for (let i = 0; i < WIDTH - 1; i++) bumpiness += Math.abs(heights[i] - heights[i + 1]);

  return weights.lines * linesCleared - weights.height * aggregateHeight - weights.holes * holes - weights.bumpiness * bumpiness;
}

// ---------------------------------------------------------------------------------------------
// Placement search - "naive drop" enumeration: for every rotation and every horizontal offset the
// piece fits at, drop it straight down from the top. This is the standard simplification real
// intro Tetris bots use (same spirit as this app's Expectimax-without-full-chance-enumeration in
// 2048): it can't find placements that require sliding a piece under an overhang, but it covers
// the overwhelming majority of real placements and keeps the search a flat, fast loop instead of a
// full move-sequence BFS.
// ---------------------------------------------------------------------------------------------

export interface Placement {
  rotation: 0 | 1 | 2 | 3;
  x: number;
  /** Landing row (top-left of the piece's 4x4 box) before locking - lets a UI replay the drop. */
  y: number;
  board: Board;
  linesCleared: number;
  score: number;
}

function dropColumn(board: Board, cells: [number, number][], x: number): number | null {
  if (!fitsAt(board, cells, x, 0)) return null;
  let y = 0;
  while (fitsAt(board, cells, x, y + 1)) y++;
  return y;
}

export function enumeratePlacements(board: Board, type: PieceType, weights: HeuristicWeights = DEFAULT_WEIGHTS): Placement[] {
  const placements: Placement[] = [];
  const seenRotations = type === "O" ? [0] : type === "I" || type === "S" || type === "Z" ? [0, 1] : [0, 1, 2, 3];

  for (const rotation of seenRotations as (0 | 1 | 2 | 3)[]) {
    const cells = cellsOf({ type, rotation });
    const minDx = Math.min(...cells.map(([dx]) => dx));
    const maxDx = Math.max(...cells.map(([dx]) => dx));
    for (let x = -minDx; x <= WIDTH - 1 - maxDx; x++) {
      const y = dropColumn(board, cells, x);
      if (y === null) continue;
      const { board: locked, linesCleared } = lockPiece(board, { type, rotation, x, y });
      placements.push({ rotation, x, y, board: locked, linesCleared, score: evaluateBoard(locked, linesCleared, weights) });
    }
  }
  return placements;
}

/** Best placement for the current piece by 1-ply heuristic search (no next-piece lookahead) - or
 *  null if the piece has nowhere to go at all (board is topped out). */
export function bestPlacement(board: Board, type: PieceType, weights: HeuristicWeights = DEFAULT_WEIGHTS): Placement | null {
  const placements = enumeratePlacements(board, type, weights);
  if (placements.length === 0) return null;
  return placements.reduce((best, p) => (p.score > best.score ? p : best));
}

// ---------------------------------------------------------------------------------------------
// Full self-play run, for the Heurística/Algoritmo Genético modes' Timeline scrub - one TetrisStep
// per piece placed, same "one frame per accepted step" shape every other page's runGame uses.
// ---------------------------------------------------------------------------------------------

const LINE_SCORES = [0, 100, 300, 500, 800];

export interface TetrisStep {
  board: Board;
  pieceType: PieceType;
  /** Rotation and landing position chosen by the placement search - lets a UI replay the piece
   *  falling into place instead of only ever showing the already-locked result. */
  rotation: 0 | 1 | 2 | 3;
  x: number;
  y: number;
  linesCleared: number;
  scoreDelta: number;
  cumulativeScore: number;
  piecesPlaced: number;
}

export interface TetrisConfig {
  weights: HeuristicWeights;
  seed: number;
  maxPieces: number;
}

export interface TetrisResult {
  initialBoard: Board;
  steps: TetrisStep[];
  finalScore: number;
  totalLines: number;
  piecesPlaced: number;
  /** True if the board topped out (no legal placement for the next piece) before maxPieces. */
  toppedOut: boolean;
  /** True if maxPieces was hit before topping out - a safety valve, not a real end condition. */
  truncated: boolean;
  config: TetrisConfig;
}

export function runGame(config: TetrisConfig): TetrisResult {
  const queue = makePieceQueue(config.seed);
  let board = emptyBoard();
  let score = 0;
  let lines = 0;
  const steps: TetrisStep[] = [];

  for (let i = 0; i < config.maxPieces; i++) {
    const pieceType = queue.next();
    const placement = bestPlacement(board, pieceType, config.weights);
    if (!placement) {
      return { initialBoard: emptyBoard(), steps, finalScore: score, totalLines: lines, piecesPlaced: i, toppedOut: true, truncated: false, config };
    }
    board = placement.board;
    const scoreDelta = LINE_SCORES[placement.linesCleared] ?? 0;
    score += scoreDelta;
    lines += placement.linesCleared;
    steps.push({
      board,
      pieceType,
      rotation: placement.rotation,
      x: placement.x,
      y: placement.y,
      linesCleared: placement.linesCleared,
      scoreDelta,
      cumulativeScore: score,
      piecesPlaced: i + 1,
    });
  }
  return {
    initialBoard: emptyBoard(),
    steps,
    finalScore: score,
    totalLines: lines,
    piecesPlaced: config.maxPieces,
    toppedOut: false,
    truncated: true,
    config,
  };
}

// ---------------------------------------------------------------------------------------------
// Manual play: gravity speed ramps with level (classic-Tetris-style, though simplified - lines
// alone determine level, no scoring multiplier tied to it) - used by the page's setInterval tick,
// not by runGame (the AI plays instantly, piece by piece, with no real-time component at all).
// ---------------------------------------------------------------------------------------------

export function levelForLines(totalLines: number): number {
  return 1 + Math.floor(totalLines / 10);
}

export function dropIntervalMs(level: number): number {
  return Math.max(120, 800 - (level - 1) * 60);
}

export function lineScore(linesCleared: number): number {
  return LINE_SCORES[linesCleared] ?? 0;
}
