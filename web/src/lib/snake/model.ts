import { search, SearchProblem } from "../core/search";

export const COLS = 20;
export const ROWS = 20;
export const INITIAL_LENGTH = 3;

export type Direction = "up" | "down" | "left" | "right";

/** Fixed iteration order for every direction scan in this file - keeps tie-breaks (which of several
 * equally-good neighbors gets picked) reproducible instead of depending on object-key ordering. */
export const DIRECTIONS: Direction[] = ["up", "right", "down", "left"];

const DIR_VECTORS: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
const OPPOSITE: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };

export function isReversal(current: Direction, next: Direction): boolean {
  return OPPOSITE[current] === next;
}

export function idx(cols: number, r: number, c: number): number {
  return r * cols + c;
}
export function rc(cols: number, i: number): [number, number] {
  return [Math.floor(i / cols), i % cols];
}

export interface SnakeState {
  cols: number;
  rows: number;
  /** Flat indices, body[0] = head, last element = tail. */
  body: number[];
  direction: Direction;
  /** -1 only in the (essentially unreachable) case where the board is entirely full. */
  food: number;
  score: number;
  ticks: number;
  over: boolean;
  won: boolean;
}

export function placeFood(cols: number, rows: number, body: number[], rng: () => number): number {
  const occupied = new Set(body);
  const empties: number[] = [];
  for (let i = 0; i < cols * rows; i++) if (!occupied.has(i)) empties.push(i);
  if (empties.length === 0) return -1;
  return empties[Math.floor(rng() * empties.length)];
}

export function createInitialSnake(cols: number, rows: number, rng: () => number): SnakeState {
  const r0 = Math.floor(rows / 2);
  const c0 = Math.floor(cols / 2);
  const body = [idx(cols, r0, c0), idx(cols, r0, c0 - 1), idx(cols, r0, c0 - 2)];
  return {
    cols,
    rows,
    body,
    direction: "right",
    food: placeFood(cols, rows, body, rng),
    score: 0,
    ticks: 0,
    over: false,
    won: false,
  };
}

/**
 * One tick. `nextDirection` is whatever the caller wants to apply (keyboard pending direction, or
 * an AI's chosen move) - a same-tick 180-degree reversal is rejected here as a safety net (falls
 * back to the current direction) in addition to being rejected at the input layer, so this function
 * can be tested directly without going through keyboard code.
 *
 * Tail-vacate rule: the tail cell is passable UNLESS this move eats food (food doesn't shrink the
 * tail - the snake grows instead, so the tail cell stays occupied that tick). This is the one place
 * naive Snake implementations bug out.
 */
export function tick(state: SnakeState, nextDirection: Direction, rng: () => number): SnakeState {
  if (state.over || state.won) return state;

  const dir = state.body.length > 1 && isReversal(state.direction, nextDirection) ? state.direction : nextDirection;
  const [dc, dr] = DIR_VECTORS[dir];
  const [hr, hc] = rc(state.cols, state.body[0]);
  const nr = hr + dr;
  const nc = hc + dc;

  if (nr < 0 || nr >= state.rows || nc < 0 || nc >= state.cols) {
    return { ...state, direction: dir, over: true };
  }

  const newHead = idx(state.cols, nr, nc);
  const willEat = newHead === state.food;
  const blocked = willEat ? state.body : state.body.slice(0, state.body.length - 1);
  if (blocked.includes(newHead)) {
    return { ...state, direction: dir, over: true };
  }

  const newBody = [newHead, ...(willEat ? state.body : state.body.slice(0, state.body.length - 1))];
  if (willEat && newBody.length === state.cols * state.rows) {
    return { ...state, body: newBody, direction: dir, food: -1, score: state.score + 1, ticks: state.ticks + 1, won: true };
  }
  const newFood = willEat ? placeFood(state.cols, state.rows, newBody, rng) : state.food;
  return {
    ...state,
    body: newBody,
    direction: dir,
    food: newFood,
    score: willEat ? state.score + 1 : state.score,
    ticks: state.ticks + 1,
  };
}

/**
 * Fresh SearchProblem every replan tick, exactly like the maze page's buildMazeProblem does for
 * walls - neighbors() excludes every body cell except the tail (it vacates this tick), computed
 * once as a plain Set outside the returned closure so repeated neighbors() calls during one
 * search() run are O(1) lookups.
 */
export function buildSnakeProblem(state: SnakeState): SearchProblem<number, Direction> {
  const blocked = new Set(state.body.slice(0, state.body.length - 1));
  const [fr, fc] = rc(state.cols, state.food);
  return {
    start: state.body[0],
    isGoal: (s) => s === state.food,
    hash: (s) => String(s),
    heuristic: (s) => {
      const [r, c] = rc(state.cols, s);
      return Math.abs(fr - r) + Math.abs(fc - c);
    },
    neighbors: (s) => {
      const [r, c] = rc(state.cols, s);
      const out: { state: number; action: Direction; cost: number }[] = [];
      for (const dir of DIRECTIONS) {
        const [dc, dr] = DIR_VECTORS[dir];
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= state.rows || nc < 0 || nc >= state.cols) continue;
        const ni = idx(state.cols, nr, nc);
        if (blocked.has(ni)) continue;
        out.push({ state: ni, action: dir, cost: 1 });
      }
      return out;
    },
  };
}

/** BFS reachable-cell count from `from`, same blocked-set rule as buildSnakeProblem (tail passable).
 * Naturally bounded by cols*rows - no maxNodes needed. */
export function floodFillOpenSpace(state: SnakeState, from: number): number {
  const blocked = new Set(state.body.slice(0, state.body.length - 1));
  if (blocked.has(from)) return 0;
  const seen = new Set([from]);
  const q = [from];
  while (q.length > 0) {
    const cur = q.shift()!;
    const [r, c] = rc(state.cols, cur);
    for (const dir of DIRECTIONS) {
      const [dc, dr] = DIR_VECTORS[dir];
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= state.rows || nc < 0 || nc >= state.cols) continue;
      const ni = idx(state.cols, nr, nc);
      if (seen.has(ni) || blocked.has(ni)) continue;
      seen.add(ni);
      q.push(ni);
    }
  }
  return seen.size;
}

export interface AstarPlan {
  /** null only when literally zero legal neighbors exist (a genuine, unavoidable game over). */
  direction: Direction | null;
  stats: { found: boolean; nodesExpanded: number; timeMs: number; truncated: boolean };
}

/**
 * Single entry point the page calls every tick: fresh A* replan (head to food, avoiding the body),
 * first hop of the path if found. If no path exists (the snake has trapped itself), falls back to
 * whichever legal neighbor has the most reachable open space (floodFillOpenSpace) rather than just
 * "first legal direction" - a real fallback, not a coin flip that makes the AI look artificially dumb.
 */
export function planAstarMove(state: SnakeState): AstarPlan {
  const problem = buildSnakeProblem(state);
  const result = search(problem, "astar");
  if (result.found && result.actions.length > 0) {
    return {
      direction: result.actions[0],
      stats: { found: true, nodesExpanded: result.nodesExpanded, timeMs: result.timeMs, truncated: result.truncated },
    };
  }

  const blocked = new Set(state.body.slice(0, state.body.length - 1));
  const [hr, hc] = rc(state.cols, state.body[0]);
  let best: Direction | null = null;
  let bestOpen = -1;
  for (const dir of DIRECTIONS) {
    const [dc, dr] = DIR_VECTORS[dir];
    const nr = hr + dr;
    const nc = hc + dc;
    if (nr < 0 || nr >= state.rows || nc < 0 || nc >= state.cols) continue;
    const ni = idx(state.cols, nr, nc);
    if (blocked.has(ni)) continue;
    const open = floodFillOpenSpace(state, ni);
    if (open > bestOpen) {
      bestOpen = open;
      best = dir;
    }
  }
  return {
    direction: best,
    stats: { found: false, nodesExpanded: result.nodesExpanded, timeMs: result.timeMs, truncated: result.truncated },
  };
}

/**
 * Boustrophedon/"comb" Hamiltonian cycle over an evenH x anyW grid. Row 0: full width left-to-right
 * (including column 0). Comb rows 1..H-2: odd row index sweeps right-to-left ending at column 1
 * (never touching column 0), even row index sweeps left-to-right ending at column W-1 - this
 * requires H-2 to be even (i.e. H even) so the LAST comb row is even and ends at column W-1, from
 * which row H-1 sweeps right-to-left all the way through column 0. Finally column 0 is climbed
 * bottom-to-top (rows H-2..1) back up to (0,0), closing the cycle.
 */
export function buildHamiltonianCycle(cols: number, rows: number): number[] {
  if (rows % 2 !== 0) throw new Error("buildHamiltonianCycle requires an even row count");
  const order: number[] = [];
  for (let c = 0; c < cols; c++) order.push(idx(cols, 0, c));
  for (let r = 1; r <= rows - 2; r++) {
    if (r % 2 === 1) {
      for (let c = cols - 1; c >= 1; c--) order.push(idx(cols, r, c));
    } else {
      for (let c = 1; c <= cols - 1; c++) order.push(idx(cols, r, c));
    }
  }
  for (let c = cols - 1; c >= 0; c--) order.push(idx(cols, rows - 1, c));
  for (let r = rows - 2; r >= 1; r--) order.push(idx(cols, r, 0));
  return order;
}

export function buildCycleIndex(cycle: number[]): number[] {
  const cycleIndex = new Array<number>(cycle.length);
  cycle.forEach((cell, i) => {
    cycleIndex[cell] = i;
  });
  return cycleIndex;
}

/**
 * "Next cell in the cycle" from the head. Always safe by construction: the snake's body is always a
 * contiguous run of cycle positions ending at the head (growth only ever appends in the same cyclic
 * order), so the next cycle cell can never already be part of the body - no blocked-set check needed.
 */
export function nextHamiltonianMove(state: SnakeState, cycle: number[], cycleIndex: number[]): Direction {
  const headPos = cycleIndex[state.body[0]];
  const nextCell = cycle[(headPos + 1) % cycle.length];
  const [hr, hc] = rc(state.cols, state.body[0]);
  const [nr, nc] = rc(state.cols, nextCell);
  for (const dir of DIRECTIONS) {
    const [dc, dr] = DIR_VECTORS[dir];
    if (hr + dr === nr && hc + dc === nc) return dir;
  }
  throw new Error("Hamiltonian cycle produced a non-adjacent next cell - cycle is malformed");
}
