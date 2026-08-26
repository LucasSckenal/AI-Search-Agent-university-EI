import { search } from "../src/lib/core/search";
import {
  buildCycleIndex,
  buildHamiltonianCycle,
  buildSnakeProblem,
  Direction,
  floodFillOpenSpace,
  idx,
  isReversal,
  nextHamiltonianMove,
  planAstarMove,
  rc,
  SnakeState,
  tick,
} from "../src/lib/snake/model";
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

function stateOf(cols: number, rows: number, body: number[], food: number, direction: Direction = "right"): SnakeState {
  return { cols, rows, body, direction, food, score: 0, ticks: 0, over: false, won: false };
}

const noopRng = () => 0.5;

// --- basic move ---
{
  const s = stateOf(10, 10, [idx(10, 5, 5), idx(10, 5, 4), idx(10, 5, 3)], idx(10, 0, 0), "right");
  const next = tick(s, "right", noopRng);
  assert(!next.over, "basic move does not collide");
  assert(next.body[0] === idx(10, 5, 6), `head moves one cell right (got ${next.body[0]})`);
  assert(next.body.length === 3, "length unchanged without food ahead");
  assert(next.score === 0, "score unchanged without food ahead");
}

// --- growth ---
{
  const head = idx(10, 5, 5);
  const food = idx(10, 5, 6);
  const s = stateOf(10, 10, [head, idx(10, 5, 4), idx(10, 5, 3)], food, "right");
  const next = tick(s, "right", seededRng(1));
  assert(!next.over, "eating does not collide");
  assert(next.body.length === 4, `body grows by 1 on eating (got ${next.body.length})`);
  assert(next.score === 1, "score increments on eating");
  assert(!next.body.includes(next.food) || next.food === -1, "new food is not placed inside the body");
}

// --- wall collision ---
{
  const s = stateOf(10, 10, [idx(10, 0, 5), idx(10, 0, 4), idx(10, 0, 3)], idx(10, 9, 9), "up");
  const next = tick(s, "up", noopRng);
  assert(next.over, "moving off the top edge is a wall collision");
}

// --- self collision (non-tail body cell) ---
{
  // A small loop: head at (1,1) moving left would hit (1,0), which is body[2] here (not the tail).
  const body = [idx(5, 1, 1), idx(5, 0, 1), idx(5, 0, 0), idx(5, 1, 0), idx(5, 2, 0), idx(5, 2, 1)];
  const s = stateOf(5, 5, body, idx(5, 4, 4), "up");
  const next = tick(s, "left", noopRng);
  assert(next.over, "moving into a non-tail body cell is a self-collision");
}

// --- tail-vacate critical case ---
// Direction is "up" (not "right") here on purpose: tick() rejects a same-tick 180-degree reversal
// as a safety net, and the move under test is "left" - starting from "right" would make "left" look
// like a reversal and get silently overridden back to "right", testing the wrong thing entirely.
{
  // 3x1 corridor: head at col1, body at col0 (tail), food elsewhere (not at the tail).
  const cols = 3, rows = 1;
  const body = [idx(cols, 0, 1), idx(cols, 0, 0)]; // head at (0,1), tail at (0,0)
  const s = stateOf(cols, rows, body, /*food*/ idx(cols, 0, 2), "up");
  const next = tick(s, "left", noopRng); // move onto the tail cell (0,0), not eating
  assert(!next.over, "moving onto the current tail cell (not eating) is legal - tail vacates");
}
{
  const cols = 3, rows = 1;
  const body = [idx(cols, 0, 1), idx(cols, 0, 0)];
  const s = stateOf(cols, rows, body, /*food*/ idx(cols, 0, 0), "up"); // food AT the tail cell
  const next = tick(s, "left", noopRng);
  assert(next.over, "moving onto the tail cell while eating is a collision - tail does not vacate when growing");
}

// --- isReversal ---
{
  assert(isReversal("up", "down"), "up/down are opposite");
  assert(isReversal("down", "up"), "down/up are opposite");
  assert(isReversal("left", "right"), "left/right are opposite");
  assert(isReversal("right", "left"), "right/left are opposite");
  assert(!isReversal("up", "left"), "up/left are not opposite");
  assert(!isReversal("up", "right"), "up/right are not opposite");
  assert(!isReversal("up", "up"), "up/up (no turn) is not a reversal");
}

// --- buildHamiltonianCycle ---
for (const [cols, rows] of [
  [6, 4],
  [4, 6],
  [20, 20],
] as const) {
  const cycle = buildHamiltonianCycle(cols, rows);
  assert(cycle.length === cols * rows, `${cols}x${rows}: cycle visits every cell (got ${cycle.length}, want ${cols * rows})`);
  assert(new Set(cycle).size === cols * rows, `${cols}x${rows}: cycle has no repeated cells`);
  let adjacentOk = true;
  for (let i = 0; i < cycle.length; i++) {
    const a = cycle[i];
    const b = cycle[(i + 1) % cycle.length];
    const [ar, ac] = rc(cols, a);
    const [br, bc] = rc(cols, b);
    const manhattan = Math.abs(ar - br) + Math.abs(ac - bc);
    if (manhattan !== 1) adjacentOk = false;
  }
  assert(adjacentOk, `${cols}x${rows}: every consecutive pair (including wraparound to the start) is grid-adjacent`);
}
{
  let threw = false;
  try {
    buildHamiltonianCycle(4, 5);
  } catch {
    threw = true;
  }
  assert(threw, "buildHamiltonianCycle throws for an odd row count");
}

// --- buildSnakeProblem + astar respects the tail-vacate rule ---
{
  // 3x3 grid, body is a straight 3-cell segment across the middle row: head (1,0)=3, middle
  // (1,1)=4, tail (1,2)=5. Food sits AT the tail. The only route there goes around via row 0:
  // 3 -> 0 -> 1 -> 2 -> 5, which requires the tail cell to be passable (it's the goal itself).
  const cols = 3, rows = 3;
  const body = [idx(cols, 1, 0), idx(cols, 1, 1), idx(cols, 1, 2)];
  const s = stateOf(cols, rows, body, idx(cols, 1, 2) /* food at the tail cell */, "down");
  const problem = buildSnakeProblem(s);
  const result = search(problem, "astar");
  assert(result.found, "astar finds a path that steps onto the current tail cell");
}
{
  // Same corridor, but food placed at a body cell that is NOT the tail - must be unreachable.
  const cols = 4, rows = 1;
  const body = [idx(cols, 0, 3), idx(cols, 0, 2), idx(cols, 0, 1), idx(cols, 0, 0)];
  const s = stateOf(cols, rows, body, idx(cols, 0, 1) /* a non-tail body cell as food, pathological but valid for this test */, "right");
  const problem = buildSnakeProblem(s);
  const result = search(problem, "astar");
  assert(!result.found, "astar refuses to route through a non-tail body cell");
}

// --- planAstarMove fallback ---
{
  // Trap the head in a 1x1 pocket with food unreachable outside a wall of body cells.
  // 5x5 grid, snake body forms a ring around the head at (2,2), food far away at (4,4).
  const cols = 5, rows = 5;
  const head = idx(cols, 2, 2);
  const ring = [idx(cols, 1, 2), idx(cols, 2, 1), idx(cols, 2, 3), idx(cols, 3, 2)]; // up/left/right/down of head, "tail" last so one side vacates
  const body = [head, ...ring];
  const s = stateOf(cols, rows, body, idx(cols, 4, 4), "up");
  const plan = planAstarMove(s);
  assert(plan.direction !== null, "planAstarMove picks a fallback direction instead of throwing when boxed in (one side vacates via the tail)");
}
{
  // Fully boxed in with no tail escape: all 4 neighbors are non-tail body cells (a 3x3 grid, snake
  // fills the ring and more so nothing vacates this tick).
  const cols = 3, rows = 3;
  const head = idx(cols, 1, 1);
  // Body: head, then all 4 neighbors, then enough extra cells so none of the 4 neighbors is the tail.
  const body = [head, idx(cols, 0, 1), idx(cols, 1, 0), idx(cols, 1, 2), idx(cols, 2, 1), idx(cols, 0, 0), idx(cols, 0, 2), idx(cols, 2, 0), idx(cols, 2, 2)];
  const s = stateOf(cols, rows, body, -1, "up");
  const plan = planAstarMove(s);
  assert(plan.direction === null, "planAstarMove returns null when literally every neighbor is blocked");
}

// --- fallback with an unreachable goal picks a real direction, not just "doesn't crash" ---
{
  const cols = 7, rows = 1;
  const head = idx(cols, 0, 3);
  const body = [head];
  const s = stateOf(cols, rows, body, -1, "right"); // food = -1 is never a valid neighbor state, so astar always fails to find it here

  const openLeft = floodFillOpenSpace(s, idx(cols, 0, 2));
  const openRight = floodFillOpenSpace(s, idx(cols, 0, 4));
  assert(openLeft === openRight, "sanity: symmetric corridor has equal open space both directions");
  const plan = planAstarMove(s);
  assert(plan.direction !== null, "planAstarMove returns a direction even with no food (unreachable goal)");
}

// --- nextHamiltonianMove: body stays a contiguous cycle run across many ticks ---
{
  const cols = 6, rows = 4;
  const cycle = buildHamiltonianCycle(cols, rows);
  const cycleIndex = buildCycleIndex(cycle);
  // Start with a short body at the beginning of the cycle.
  let body = [cycle[2], cycle[1], cycle[0]];
  let direction: Direction = "right"; // matches cycle[0]->cycle[1]->cycle[2] direction of travel
  let ok = true;
  for (let step = 0; step < cycle.length * 2; step++) {
    const s = stateOf(cols, rows, body, -1, direction);
    const dir = nextHamiltonianMove(s, cycle, cycleIndex);
    const next = tick(s, dir, noopRng);
    direction = next.direction;
    if (next.over) {
      ok = false;
      break;
    }
    // Manually grow by one each step (simulate always having food ahead) so the body stays long
    // enough to meaningfully test self-collision-avoidance, capped at a reasonable size.
    body = next.body.length < 10 ? [next.body[0], ...body] : [next.body[0], ...body.slice(0, 8)];
  }
  assert(ok, "following the Hamiltonian cycle never collides with itself across multiple laps");
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll Snake tests passed.");
}
