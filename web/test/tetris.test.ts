import {
  absoluteCells,
  bestPlacement,
  DEFAULT_WEIGHTS,
  emptyBoard,
  enumeratePlacements,
  evaluateBoard,
  hardDropTarget,
  HEIGHT,
  lockPiece,
  PIECE_ORDER,
  runGame,
  spawnPiece,
  tryMove,
  tryRotate,
  WIDTH,
} from "../src/lib/tetris/model";
import { buildTetrisGaOps } from "../src/lib/tetris/genetic";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

function cellKey([x, y]: [number, number]): string {
  return `${x},${y}`;
}

// --- piece shapes: every rotation has exactly 4 cells, and 4 rotations return to the start ---
for (const type of PIECE_ORDER) {
  let piece = { type, rotation: 0 as 0 | 1 | 2 | 3, x: 3, y: 0 };
  const board = emptyBoard();
  const startCells = new Set(absoluteCells(piece).map(cellKey));
  for (let i = 0; i < 4; i++) {
    const cells = absoluteCells(piece);
    assert(cells.length === 4, `${type} rotation ${piece.rotation} has exactly 4 cells`);
    const rotated = tryRotate(board, piece, 1);
    assert(rotated !== null, `${type} can rotate CW in an empty board from rotation ${piece.rotation}`);
    piece = rotated!;
  }
  const endCells = new Set(absoluteCells(piece).map(cellKey));
  assert(
    startCells.size === endCells.size && [...startCells].every((c) => endCells.has(c)),
    `${type} returns to its original cells after 4 clockwise rotations`
  );
}

// --- spawnPiece ---
for (const type of PIECE_ORDER) {
  const piece = spawnPiece(emptyBoard(), type);
  assert(piece !== null, `${type} can spawn on an empty board`);
}
{
  const full = new Array(WIDTH * HEIGHT).fill(1);
  const piece = spawnPiece(full, "O");
  assert(piece === null, "spawnPiece returns null when the spawn area is already occupied");
}

// --- tryMove: bounds ---
{
  const board = emptyBoard();
  const piece = spawnPiece(board, "T")!;
  assert(tryMove(board, piece, 1, 0) !== null, "tryMove right succeeds in an empty board");
  assert(tryMove(board, piece, 0, 1) !== null, "tryMove down succeeds in an empty board");
  let leftmost = piece;
  for (let i = 0; i < 20; i++) {
    const next = tryMove(board, leftmost, -1, 0);
    if (!next) break;
    leftmost = next;
  }
  assert(tryMove(board, leftmost, -1, 0) === null, "a piece run all the way left can't move further left");
  assert(leftmost.x >= 0, "the leftmost reachable position never has a negative box x (though individual cells may sit at column 0)");
}

// --- hardDropTarget ---
{
  const board = emptyBoard();
  const piece = spawnPiece(board, "O")!;
  const dropped = hardDropTarget(board, piece);
  const cells = absoluteCells(dropped);
  assert(Math.max(...cells.map(([, y]) => y)) === HEIGHT - 1, "hardDropTarget rests the piece's lowest cell on the board floor");
  assert(tryMove(board, dropped, 0, 1) === null, "a hard-dropped piece can't move down any further");
}

// --- lockPiece: writes cells and clears full rows ---
{
  const board = emptyBoard();
  for (let col = 0; col < 6; col++) board[(HEIGHT - 1) * WIDTH + col] = 1;
  const { board: locked, linesCleared } = lockPiece(board, { type: "I", rotation: 0, x: 6, y: HEIGHT - 2 });
  assert(linesCleared === 1, "completing the last 4 cells of an otherwise-full row clears exactly 1 line");
  assert(locked.slice((HEIGHT - 1) * WIDTH, HEIGHT * WIDTH).every((c) => c === 0), "the cleared row is empty again after clearing (shifted down from above, which was empty)");
  assert(locked.every((c) => c === 0), "a single-row board with no rows above it is entirely empty after that one row clears");
}
{
  // A lock that doesn't complete any row just writes the piece in place. O's spawn cells sit at
  // box-columns 1-2 (not 0-1), so x=0 lands the piece at board columns 1-2.
  const board = emptyBoard();
  const { board: locked, linesCleared } = lockPiece(board, { type: "O", rotation: 0, x: 0, y: HEIGHT - 2 });
  assert(linesCleared === 0, "lockPiece reports 0 cleared lines when no row became full");
  assert(locked[(HEIGHT - 1) * WIDTH + 1] !== 0 && locked[(HEIGHT - 1) * WIDTH + 2] !== 0, "the locked piece's cells are written into the board");
}

// --- evaluateBoard: fewer holes/lower height should score higher, all else equal ---
{
  const flat = emptyBoard();
  for (let col = 0; col < WIDTH; col++) flat[(HEIGHT - 1) * WIDTH + col] = 1;
  const withHole = flat.slice();
  withHole[(HEIGHT - 1) * WIDTH + 3] = 0;
  withHole[(HEIGHT - 3) * WIDTH + 3] = 1; // a block floating above an empty cell = a hole
  assert(evaluateBoard(flat, 0) > evaluateBoard(withHole, 0), "evaluateBoard scores a board with a hole worse than an otherwise-equal flat board");
}
{
  const short = emptyBoard();
  for (let col = 0; col < WIDTH; col++) short[(HEIGHT - 1) * WIDTH + col] = 1;
  const tall = emptyBoard();
  for (let col = 0; col < WIDTH; col++) {
    tall[(HEIGHT - 1) * WIDTH + col] = 1;
    tall[(HEIGHT - 2) * WIDTH + col] = 1;
  }
  assert(evaluateBoard(short, 0) > evaluateBoard(tall, 0), "evaluateBoard scores a shorter stack higher than a taller one, all else equal");
}
{
  const board = emptyBoard();
  assert(evaluateBoard(board, 4) > evaluateBoard(board, 0), "evaluateBoard rewards clearing lines on an otherwise-identical board");
}

// --- enumeratePlacements / bestPlacement ---
{
  const placements = enumeratePlacements(emptyBoard(), "T");
  assert(placements.length > 0, "enumeratePlacements finds placements for T on an empty board");
  assert(placements.every((p) => p.board.length === WIDTH * HEIGHT), "every enumerated placement's board is a full-size board");
}
{
  const best = bestPlacement(emptyBoard(), "I", DEFAULT_WEIGHTS);
  assert(best !== null, "bestPlacement finds a placement for I on an empty board");
}
{
  // Rows 2+ are solid EXCEPT column 0 (so no row starts pre-filled - a real reachable board can
  // never have a fully-filled row just sitting there uncleared). Rows 0-1 are fully open. Nothing
  // can drop past row 1, and completing column 0 alone can't fill any of those rows either since
  // O is 2 cells wide - so no placement should ever clear a line here.
  const topped = new Array(WIDTH * HEIGHT).fill(1);
  for (let row = 0; row < HEIGHT; row++) topped[row * WIDTH + 0] = 0;
  for (let col = 0; col < WIDTH; col++) {
    topped[0 * WIDTH + col] = 0;
    topped[1 * WIDTH + col] = 0;
  }
  const best = bestPlacement(topped, "O");
  assert(best !== null && best.linesCleared === 0, "dropping onto a mostly-full board lands in the open rows without spuriously clearing an already-full row");
}

// --- runGame: termination, determinism, non-decreasing score ---
for (const seed of [1, 2, 3]) {
  const result = runGame({ weights: DEFAULT_WEIGHTS, seed, maxPieces: 400 });
  assert(result.steps.length <= 400, `runGame respects maxPieces [seed ${seed}]`);
  assert(result.toppedOut !== result.truncated || result.steps.length === 0, `runGame's toppedOut/truncated flags are mutually exclusive for a run that actually placed pieces [seed ${seed}]`);
  assert(result.finalScore >= 0, `runGame produces a non-negative final score [seed ${seed}]`);
  for (let i = 1; i < result.steps.length; i++) {
    assert(result.steps[i].cumulativeScore >= result.steps[i - 1].cumulativeScore, `runGame's cumulative score never decreases at step ${i} [seed ${seed}]`);
  }
}
{
  const a = runGame({ weights: DEFAULT_WEIGHTS, seed: 42, maxPieces: 150 });
  const b = runGame({ weights: DEFAULT_WEIGHTS, seed: 42, maxPieces: 150 });
  const strip = (r: typeof a) => r.steps.map(({ board, linesCleared, cumulativeScore }) => ({ board, linesCleared, cumulativeScore }));
  assert(JSON.stringify(strip(a)) === JSON.stringify(strip(b)), "runGame is deterministic for a fixed config (same seed, same trajectory)");
}
{
  // Heavier hole/height penalties (a much more conservative genome) shouldn't ever place a piece
  // into a hole-creating spot when a hole-free alternative exists on an otherwise-empty board -
  // spot-checked via score comparison across a few seeds rather than one exact trajectory.
  const seeds = [10, 20, 30];
  let goodTotal = 0;
  let badTotal = 0;
  const badWeights = { lines: 0.1, height: 0.05, holes: 0.05, bumpiness: 0.01 };
  for (const seed of seeds) {
    goodTotal += runGame({ weights: DEFAULT_WEIGHTS, seed, maxPieces: 300 }).finalScore;
    badTotal += runGame({ weights: badWeights, seed, maxPieces: 300 }).finalScore;
  }
  assert(goodTotal >= badTotal, `Reasonable default weights score at least as well on average (${(goodTotal / seeds.length).toFixed(0)}) as a near-random weighting (${(badTotal / seeds.length).toFixed(0)})`);
}

// --- genetic ops: sanity ---
{
  const ops = buildTetrisGaOps({ seed: 1, maxPieces: 60 });
  const rng = (() => {
    let s = 7;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  })();
  const genome = ops.randomGenome(rng);
  assert(genome.lines >= 0 && genome.height >= 0 && genome.holes >= 0 && genome.bumpiness >= 0, "randomGenome produces non-negative weights");
  const f = ops.fitness(genome);
  assert(typeof f === "number" && f >= 0, "fitness runs a full evaluation game and returns a non-negative score");
  const mutated = ops.mutate(genome, rng, 1);
  assert(mutated.lines >= 0 && mutated.height >= 0 && mutated.holes >= 0 && mutated.bumpiness >= 0, "mutate never produces a negative weight even at rate=1");
  const child = ops.crossover(genome, mutated, rng);
  assert(child.lines >= 0 && child.height >= 0 && child.holes >= 0 && child.bumpiness >= 0, "crossover never produces a negative weight");
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll Tetris tests passed.");
}
