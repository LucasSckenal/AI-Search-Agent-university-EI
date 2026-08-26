import { applyMove, evaluateBoard, legalMoves, runGame, Board, Direction } from "../src/lib/game2048/model";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

function rowBoard(row: number[], size = 4): Board {
  const board = new Array(size * size).fill(0);
  for (let i = 0; i < row.length; i++) board[i] = row[i];
  return board;
}

// --- applyMove: slide/merge correctness ---
{
  const { board, scoreDelta, moved } = applyMove(rowBoard([2, 2, 4, 0]), 4, "left");
  assert(board[0] === 4 && board[1] === 4 && board[2] === 0 && board[3] === 0, "applyMove left slides and merges [2,2,4,0] -> [4,4,0,0]");
  assert(scoreDelta === 4, "applyMove left reports the merge score delta");
  assert(moved, "applyMove reports moved=true when the board changes");
}
{
  const { board, scoreDelta } = applyMove(rowBoard([2, 2, 2, 0]), 4, "left");
  assert(board[0] === 4 && board[1] === 2 && board[2] === 0 && board[3] === 0, "applyMove left merges only the first pair, not the freshly-created tile [2,2,2,0] -> [4,2,0,0]");
  assert(scoreDelta === 4, "applyMove left reports a single merge's score delta for [2,2,2,0]");
}
{
  const { board, scoreDelta } = applyMove(rowBoard([0, 2, 2, 2]), 4, "right");
  assert(board[1] === 0 && board[2] === 2 && board[3] === 4, "applyMove right mirrors the same merge-once rule [0,2,2,2] -> [0,0,2,4]");
  assert(scoreDelta === 4, "applyMove right reports the merge score delta");
}
{
  const full = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
  const { moved, moves } = applyMove(full, 4, "left");
  assert(!moved, "applyMove reports moved=false on a full board with no legal slide/merge");
  assert(moves.length === 0, "applyMove reports no TileMoves for an illegal move");
}

// --- applyMove: TileMove from/to mapping feeds the grid's slide animation ---
{
  const { moves } = applyMove(rowBoard([2, 2, 4, 0]), 4, "left");
  const byFrom = new Map(moves.map((m) => [m.from, m.to]));
  assert(byFrom.get(0) === 0 && byFrom.get(1) === 0, "a merge's two source cells (indices 0 and 1) share the same destination (0)");
  assert(byFrom.get(2) === 1, "the unmerged tile (index 2) slides to the next free destination (1)");
  assert(moves.length === 3, "TileMove has one entry per originally-occupied cell (3 tiles in), including both merge sources");
}
{
  // Within an otherwise-legal move, a tile with no empty cells ahead of it still reports a
  // from===to TileMove (the grid needs this to know "nothing to animate here", not "cell
  // disappeared") - moves is only fully empty when the *whole* move was illegal (see above).
  const { moves } = applyMove(rowBoard([2, 0, 4, 0]), 4, "left");
  const byFrom = new Map(moves.map((m) => [m.from, m.to]));
  assert(byFrom.get(0) === 0, "a tile already at the wall (index 0) reports a from===to TileMove");
  assert(byFrom.get(2) === 1, "the other tile (index 2) still slides normally to the next free cell (1)");
}
{
  // "down" exercises both the column transform and the reversal path together.
  const board = rowBoard([2, 0, 0, 0]); // single tile at (row 0, col 0)
  const { moves } = applyMove(board, 4, "down");
  assert(moves.length === 1 && moves[0].from === 0 && moves[0].to === 12, "applyMove down slides a lone column tile from row 0 to row 3 (index 0 -> 12)");
}

// --- runGame: termination, validity, determinism, and Expectimax vs Greedy ---
for (const mode of ["greedy", "expectimax"] as const) {
  for (const seed of [1, 2, 3]) {
    const result = runGame({ size: 4, mode, expectimaxDepth: 1, seed, maxMoves: 500 });
    assert(result.steps.length <= 500, `runGame respects maxMoves [${mode}, seed ${seed}]`);
    const finalBoard = result.steps.length > 0 ? result.steps[result.steps.length - 1].board : result.initialBoard;
    const stoppedNaturally = legalMoves(finalBoard, 4).length === 0;
    assert(
      result.truncated ? !stoppedNaturally : stoppedNaturally || result.steps.length < 500,
      `runGame's truncated flag matches whether the board actually ran out of legal moves [${mode}, seed ${seed}]`
    );
    assert(result.finalScore >= 0, `runGame produces a non-negative final score [${mode}, seed ${seed}]`);
    assert(result.maxTile >= 2, `runGame's board reaches at least one tile [${mode}, seed ${seed}]`);
    for (let i = 1; i < result.steps.length; i++) {
      assert(
        result.steps[i].cumulativeScore >= result.steps[i - 1].cumulativeScore,
        `runGame's cumulative score never decreases at step ${i} [${mode}, seed ${seed}]`
      );
    }
    if (result.steps.length > 0) {
      assert(result.steps[0].moves.length > 0, `runGame's first step carries TileMove data for the grid's slide animation [${mode}, seed ${seed}]`);
    }
  }
}

{
  // timeMs is real wall-clock and never matches between runs, so determinism is checked on the
  // actual game trajectory (board/direction/score/spawn) rather than the raw step objects.
  const strip = (steps: ReturnType<typeof runGame>["steps"]) =>
    steps.map(({ board, direction, scoreDelta, cumulativeScore, spawnedIndex, spawnedValue }) => ({
      board,
      direction,
      scoreDelta,
      cumulativeScore,
      spawnedIndex,
      spawnedValue,
    }));
  const a = runGame({ size: 4, mode: "expectimax", expectimaxDepth: 1, seed: 42, maxMoves: 200 });
  const b = runGame({ size: 4, mode: "expectimax", expectimaxDepth: 1, seed: 42, maxMoves: 200 });
  assert(JSON.stringify(strip(a.steps)) === JSON.stringify(strip(b.steps)), "runGame is deterministic for a fixed config (same seed, same trajectory)");
}

{
  // Expectimax should out-perform Greedy on average - a tolerance across several seeds, not a
  // seed-by-seed guarantee (same tolerant-comparison spirit as rl.test.ts's convergence check).
  const seeds = [10, 20, 30, 40, 50];
  let greedyTotal = 0;
  let expectimaxTotal = 0;
  for (const seed of seeds) {
    greedyTotal += runGame({ size: 4, mode: "greedy", expectimaxDepth: 1, seed, maxMoves: 1000 }).finalScore;
    expectimaxTotal += runGame({ size: 4, mode: "expectimax", expectimaxDepth: 1, seed, maxMoves: 1000 }).finalScore;
  }
  assert(expectimaxTotal >= greedyTotal, `Expectimax's average score (${(expectimaxTotal / seeds.length).toFixed(0)}) is at least Greedy's (${(greedyTotal / seeds.length).toFixed(0)}) across seeds`);
}

// --- evaluateBoard: more empty cells (rest equal) should score higher ---
{
  const size = 4;
  const sparse: Board = new Array(size * size).fill(0);
  sparse[0] = 2;
  sparse[1] = 4;
  const dense: Board = sparse.slice();
  dense[2] = 8;
  dense[3] = 8;
  dense[4] = 16;
  assert(evaluateBoard(sparse, size) > evaluateBoard(dense, size), "evaluateBoard scores an otherwise-similar board with more empty cells higher");
}

// --- legalMoves is exercised indirectly through applyMove's `moved` flag above; sanity-check a
// single illegal direction on an obviously-blocked line ---
{
  const blocked: Board = rowBoard([2, 4, 2, 4]);
  const { moved } = applyMove(blocked, 4, "left" as Direction);
  assert(!moved, "applyMove(left) is illegal on a fully alternating, already-slid row");
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll 2048 tests passed.");
}
