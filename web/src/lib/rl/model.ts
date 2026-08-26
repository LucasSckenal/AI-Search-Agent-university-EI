import { seededRng } from "../core/rng";

/**
 * Grid-world for the Q-learning module: start (row 0, col 0), goal (bottom-right, terminal +reward),
 * pits (terminal -reward) and walls (impassable) scattered on everything else. Mirrors maze/model.ts's
 * generateRandomMaze shape (retry-until-connected, seeded) but keeps its own cell vocabulary since the
 * semantics (terminal reward cells, not "shortest path only") are RL-specific, not maze-specific.
 */
export type CellType = "empty" | "wall" | "pit" | "spike" | "goal";

export interface GridCell {
  r: number;
  c: number;
  type: CellType;
}

export interface GridWorld {
  rows: number;
  cols: number;
  cells: GridCell[][]; // cells[r][c]
  start: [number, number];
}

export const ACTIONS = ["N", "S", "E", "W"] as const;
export type Action = (typeof ACTIONS)[number];

const ACTION_DELTAS: Record<Action, [number, number]> = {
  N: [-1, 0],
  S: [1, 0],
  E: [0, 1],
  W: [0, -1],
};

/** The two actions perpendicular to a given one - where `slipChance` sends the agent instead. */
const PERPENDICULAR: Record<Action, [Action, Action]> = {
  N: ["E", "W"],
  S: ["E", "W"],
  E: ["N", "S"],
  W: ["N", "S"],
};

export const STEP_REWARD = -0.02;
export const GOAL_REWARD = 1;
export const PIT_REWARD = -1;
/** Spikes hurt but aren't terminal - the agent keeps going, just poorer off. Distinct from a pit's
 *  instant-death penalty, so there are two different flavors of "mistake" for the agent to learn to
 *  avoid: a survivable one it can path around inefficiently, and a fatal one. */
export const SPIKE_REWARD = -0.3;

export function stateIndex(world: Pick<GridWorld, "cols">, r: number, c: number): number {
  return r * world.cols + c;
}

export function isTerminal(cell: GridCell): boolean {
  return cell.type === "goal" || cell.type === "pit";
}

function cellAt(world: GridWorld, r: number, c: number): GridCell | null {
  if (r < 0 || r >= world.rows || c < 0 || c >= world.cols) return null;
  return world.cells[r][c];
}

/** Where an agent at (r,c) ends up after `action` actually executes (post-slip). Walls and the grid
 *  edge bounce the agent back to the same cell (still pays the per-step reward, no free pass). */
export function applyAction(
  world: GridWorld,
  r: number,
  c: number,
  action: Action
): { r: number; c: number; reward: number; done: boolean } {
  const [dr, dc] = ACTION_DELTAS[action];
  const target = cellAt(world, r + dr, c + dc);
  if (!target || target.type === "wall") {
    return { r, c, reward: STEP_REWARD, done: false };
  }
  const reward =
    target.type === "goal" ? GOAL_REWARD : target.type === "pit" ? PIT_REWARD : target.type === "spike" ? SPIKE_REWARD : STEP_REWARD;
  return { r: target.r, c: target.c, reward, done: isTerminal(target) };
}

function bfsReachesGoal(world: GridWorld): boolean {
  const seen = new Set<string>();
  const [sr, sc] = world.start;
  const queue: [number, number][] = [[sr, sc]];
  seen.add(`${sr},${sc}`);
  while (queue.length) {
    const [r, c] = queue.shift()!;
    if (world.cells[r][c].type === "goal") return true;
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= world.rows || nc < 0 || nc >= world.cols) continue;
      const key = `${nr},${nc}`;
      if (seen.has(key) || world.cells[nr][nc].type === "wall") continue;
      seen.add(key);
      queue.push([nr, nc]);
    }
  }
  return false;
}

function blankGrid(rows: number, cols: number): GridCell[][] {
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => ({ r, c, type: "empty" as CellType })));
}

/** Random walls/pits/spikes sprinkled on an empty grid, regenerated (like generateRandomMaze) until
 *  the goal is reachable from start - a grid-world with an unreachable goal would make both
 *  algorithms "fail" for an uninteresting reason unrelated to what the page is trying to
 *  demonstrate. Two hazard flavors (fatal pits, survivable-but-costly spikes) give the agent more
 *  than one kind of mistake to learn to avoid, instead of a single binary "safe or dead" grid. */
export function generateGridWorld(rows: number, cols: number, seed: number): GridWorld {
  const rng = seededRng(seed);
  const start: [number, number] = [0, 0];
  const goal: [number, number] = [rows - 1, cols - 1];

  for (let attempt = 0; attempt < 150; attempt++) {
    const cells = blankGrid(rows, cols);
    cells[goal[0]][goal[1]].type = "goal";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r === start[0] && c === start[1]) || (r === goal[0] && c === goal[1])) continue;
        const roll = rng();
        if (roll < 0.15) cells[r][c].type = "wall";
        else if (roll < 0.15 + 0.08) cells[r][c].type = "pit";
        else if (roll < 0.15 + 0.08 + 0.08) cells[r][c].type = "spike";
      }
    }
    const world: GridWorld = { rows, cols, cells, start };
    if (bfsReachesGoal(world)) return world;
  }

  const cells = blankGrid(rows, cols);
  cells[goal[0]][goal[1]].type = "goal";
  return { rows, cols, cells, start };
}

function maxQ(q: Float32Array, s: number): number {
  let best = q[s * 4];
  for (let a = 1; a < 4; a++) best = Math.max(best, q[s * 4 + a]);
  return best;
}

function argmaxQ(q: Float32Array, s: number): number {
  let bestA = 0;
  let bestV = q[s * 4];
  for (let a = 1; a < 4; a++) {
    if (q[s * 4 + a] > bestV) {
      bestV = q[s * 4 + a];
      bestA = a;
    }
  }
  return bestA;
}

/** Reduces a (nStates*4) Q-table to one max-Q value per state - what a canvas heatmap or a greedy
 *  policy actually cares about, not the four per-action values individually. */
export function maxQPerState(q: Float32Array, nStates: number): Float32Array {
  const out = new Float32Array(nStates);
  for (let s = 0; s < nStates; s++) out[s] = maxQ(q, s);
  return out;
}

/** The greedy (argmax) action per state from a Q-table snapshot - same shape as
 *  ValueIterationResult.policy, so a snapshot mid-training can drive greedyRollout exactly like a
 *  finished Value Iteration policy can. */
export function greedyPolicyFromQ(q: Float32Array, nStates: number): Int8Array {
  const out = new Int8Array(nStates);
  for (let s = 0; s < nStates; s++) out[s] = argmaxQ(q, s);
  return out;
}

function applySlip(action: Action, slipChance: number, rng: () => number): Action {
  if (slipChance <= 0 || rng() >= slipChance) return action;
  const [a, b] = PERPENDICULAR[action];
  return rng() < 0.5 ? a : b;
}

export interface RLConfig {
  alpha: number;
  gamma: number;
  epsilonStart: number;
  epsilonEnd: number;
  episodes: number;
  maxStepsPerEpisode: number;
  /** 0 = deterministic transitions; >0 = chance the executed move is one of the two perpendicular
   *  actions instead of the intended one (FrozenLake-style "ice"). */
  slipChance: number;
  seed: number;
}

export interface EpisodeSummary {
  episode: number;
  totalReward: number;
  steps: number;
  epsilon: number;
}

export interface QLearningResult {
  episodes: EpisodeSummary[];
  /** Q-table sampled every ~5% of episodes (not every episode - would explode memory on long runs)
   *  so a Timeline can scrub through how the value heatmap evolved over the course of training. */
  qTableSnapshots: { episode: number; q: Float32Array }[];
  finalQ: Float32Array;
}

/**
 * Tabular Q-learning: the agent never sees `world`'s reward/transition structure directly, only the
 * (state, reward, next state) tuples its own actions produce - model-free, learned purely from
 * repeated trial and error. Epsilon decays linearly from `epsilonStart` to `epsilonEnd` across
 * `config.episodes` so early episodes explore and late episodes mostly exploit the learned policy.
 *
 * If the greedy policy still hasn't reached the goal by the end of that configured budget (an
 * unlucky seed, or a harder grid than the budget was tuned for), training keeps extending in
 * single-episode steps - holding epsilon at its final, mostly-greedy value - until it does, capped
 * at 5x the configured episode count so a genuinely pathological instance can't run forever. A run
 * should never end "stuck" the way a hard episode cap could otherwise leave one.
 */
export function runQLearning(world: GridWorld, config: RLConfig): QLearningResult {
  const rng = seededRng(config.seed);
  const nStates = world.rows * world.cols;
  const q = new Float32Array(nStates * 4);
  const episodes: EpisodeSummary[] = [];
  const qTableSnapshots: { episode: number; q: Float32Array }[] = [];
  const snapshotEvery = Math.max(1, Math.round(config.episodes * 0.05));
  const maxEpisodes = config.episodes * 5;

  const epsilonFor = (ep: number): number => {
    const t = config.episodes <= 1 ? 1 : Math.min(ep, config.episodes - 1) / (config.episodes - 1);
    return config.epsilonStart + (config.epsilonEnd - config.epsilonStart) * t;
  };

  const runEpisode = (ep: number) => {
    const epsilon = epsilonFor(ep);
    let [r, c] = world.start;
    let totalReward = 0;
    let steps = 0;

    for (; steps < config.maxStepsPerEpisode; steps++) {
      const s = stateIndex(world, r, c);
      const actionIdx = rng() < epsilon ? Math.floor(rng() * 4) : argmaxQ(q, s);
      const executed = applySlip(ACTIONS[actionIdx], config.slipChance, rng);
      const result = applyAction(world, r, c, executed);
      const sNext = stateIndex(world, result.r, result.c);
      const targetNext = result.done ? 0 : maxQ(q, sNext);

      const qIdx = s * 4 + actionIdx;
      q[qIdx] += config.alpha * (result.reward + config.gamma * targetNext - q[qIdx]);

      totalReward += result.reward;
      r = result.r;
      c = result.c;
      if (result.done) {
        steps++;
        break;
      }
    }

    episodes.push({ episode: ep, totalReward, steps, epsilon });
    if (ep % snapshotEvery === 0) qTableSnapshots.push({ episode: ep, q: q.slice() });
  };

  for (let ep = 0; ep < config.episodes; ep++) runEpisode(ep);

  let ep = config.episodes;
  while (ep < maxEpisodes && !rolloutFrom(world, (s) => argmaxQ(q, s), config.maxStepsPerEpisode).reachedGoal) {
    runEpisode(ep);
    ep++;
  }

  // Whatever the actual last episode turned out to be (base training or an extension), the
  // Timeline should always be able to scrub to it - the periodic sampling above can easily miss it.
  const lastEpisode = episodes[episodes.length - 1].episode;
  if (qTableSnapshots[qTableSnapshots.length - 1]?.episode !== lastEpisode) {
    qTableSnapshots.push({ episode: lastEpisode, q: q.slice() });
  }

  return { episodes, qTableSnapshots, finalQ: q };
}

export interface ValueIterationResult {
  values: Float32Array;
  /** Best action index per state, -1 for walls/terminal cells (nothing to decide there). */
  policy: Int8Array;
  sweeps: number;
}

/**
 * Value Iteration: knows the full transition model (including slip probabilities) up front and
 * converges by repeated Bellman-optimal backups - the model-based reference answer Q-learning is
 * compared against, playing the same role Held-Karp plays for the TSP page.
 */
export function valueIteration(
  world: GridWorld,
  gamma: number,
  slipChance = 0,
  theta = 1e-4,
  maxSweeps = 1000
): ValueIterationResult {
  const nStates = world.rows * world.cols;
  const values = new Float32Array(nStates);
  const policy = new Int8Array(nStates).fill(-1);

  const outcomesFor = (r: number, c: number, actionIdx: number) => {
    const action = ACTIONS[actionIdx];
    const [p1, p2] = PERPENDICULAR[action];
    const branches: { prob: number; action: Action }[] =
      slipChance > 0
        ? [
            { prob: 1 - slipChance, action },
            { prob: slipChance / 2, action: p1 },
            { prob: slipChance / 2, action: p2 },
          ]
        : [{ prob: 1, action }];
    return branches.map(({ prob, action: a }) => ({ prob, ...applyAction(world, r, c, a) }));
  };

  let sweeps = 0;
  for (; sweeps < maxSweeps; sweeps++) {
    let delta = 0;
    for (let r = 0; r < world.rows; r++) {
      for (let c = 0; c < world.cols; c++) {
        const cell = world.cells[r][c];
        if (cell.type === "wall" || isTerminal(cell)) continue;
        const s = stateIndex(world, r, c);

        let bestV = -Infinity;
        let bestA = 0;
        for (let a = 0; a < 4; a++) {
          let v = 0;
          for (const outcome of outcomesFor(r, c, a)) {
            const sNext = stateIndex(world, outcome.r, outcome.c);
            const nextV = outcome.done ? 0 : values[sNext];
            v += outcome.prob * (outcome.reward + gamma * nextV);
          }
          if (v > bestV) {
            bestV = v;
            bestA = a;
          }
        }

        delta = Math.max(delta, Math.abs(bestV - values[s]));
        values[s] = bestV;
        policy[s] = bestA;
      }
    }
    sweeps++;
    if (delta < theta) break;
  }

  return { values, policy, sweeps };
}

export interface Rollout {
  path: [number, number][];
  /** Sum of raw per-step rewards along the walk - undiscounted, unlike Value Iteration's `values`
   *  (which are discounted returns), so it's directly comparable to an EpisodeSummary.totalReward. */
  reward: number;
  reachedGoal: boolean;
  /** How the walk ended - "timeout" means it neither reached the goal nor fell in a pit within
   *  maxSteps, still wandering when the budget ran out. Lets the UI show a specific kind of mistake
   *  instead of just a generic "didn't reach the goal". */
  outcome: "goal" | "pit" | "timeout";
  /** Cells where the walk stepped on a spike - survivable, but each one is a concrete mistake worth
   *  pointing out (unlike a pit, the agent kept going, so these only show up as a worse `reward`). */
  spikeHits: [number, number][];
}

function rolloutFrom(world: GridWorld, policy: Int8Array | ((s: number) => number), maxSteps: number): Rollout {
  const path: [number, number][] = [[world.start[0], world.start[1]]];
  let [r, c] = world.start;
  let reward = 0;
  const spikeHits: [number, number][] = [];
  for (let i = 0; i < maxSteps; i++) {
    if (isTerminal(world.cells[r][c])) break;
    const s = stateIndex(world, r, c);
    const a = typeof policy === "function" ? policy(s) : policy[s];
    if (a < 0) break;
    const result = applyAction(world, r, c, ACTIONS[a]);
    reward += result.reward;
    r = result.r;
    c = result.c;
    path.push([r, c]);
    if (world.cells[r][c].type === "spike") spikeHits.push([r, c]);
    if (result.done) break;
  }
  const finalType = world.cells[r][c].type;
  const outcome: Rollout["outcome"] = finalType === "goal" ? "goal" : finalType === "pit" ? "pit" : "timeout";
  return { path, reward, reachedGoal: finalType === "goal", outcome, spikeHits };
}

/** Walks the greedy policy from `world.start` until a terminal cell or `maxSteps` - used by the
 *  canvas to animate the agent once training/planning is done. */
export function greedyRollout(world: GridWorld, policy: Int8Array | ((s: number) => number), maxSteps = 200): [number, number][] {
  return rolloutFrom(world, policy, maxSteps).path;
}

/** Same walk as greedyRollout, but also reports the reward collected and whether it reached the
 *  goal - what the comparison modal needs to show an undiscounted "achieved reward" figure. */
export function greedyRolloutWithReward(world: GridWorld, policy: Int8Array | ((s: number) => number), maxSteps = 200): Rollout {
  return rolloutFrom(world, policy, maxSteps);
}
