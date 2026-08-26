import {
  ACTIONS,
  Action,
  GridCell,
  GridWorld,
  SPIKE_REWARD,
  applyAction,
  generateGridWorld,
  greedyRollout,
  greedyRolloutWithReward,
  runQLearning,
  stateIndex,
  valueIteration,
} from "../src/lib/rl/model";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

function buildWorld(
  rows: number,
  cols: number,
  walls: [number, number][],
  pits: [number, number][],
  spikes: [number, number][] = []
): GridWorld {
  const cells: GridCell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({ r, c, type: "empty" as const }))
  );
  for (const [r, c] of walls) cells[r][c] = { r, c, type: "wall" };
  for (const [r, c] of pits) cells[r][c] = { r, c, type: "pit" };
  for (const [r, c] of spikes) cells[r][c] = { r, c, type: "spike" };
  cells[rows - 1][cols - 1] = { r: rows - 1, c: cols - 1, type: "goal" };
  return { rows, cols, cells, start: [0, 0] };
}

// --- generateGridWorld: deterministic per seed, always connects start to goal ---
for (const seed of [1, 2, 3, 42, 12345]) {
  const w1 = generateGridWorld(6, 6, seed);
  const w2 = generateGridWorld(6, 6, seed);
  assert(JSON.stringify(w1.cells) === JSON.stringify(w2.cells), `generateGridWorld(seed=${seed}) is deterministic`);
}
for (let i = 0; i < 20; i++) {
  const w = generateGridWorld(6, 6, i * 991 + 7);
  // BFS from start must reach the goal cell (same check generateGridWorld itself uses internally).
  const seen = new Set<string>();
  const queue: [number, number][] = [w.start];
  seen.add(`${w.start[0]},${w.start[1]}`);
  let reached = false;
  while (queue.length) {
    const [r, c] = queue.shift()!;
    if (w.cells[r][c].type === "goal") reached = true;
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= w.rows || nc < 0 || nc >= w.cols) continue;
      const key = `${nr},${nc}`;
      if (seen.has(key) || w.cells[nr][nc].type === "wall") continue;
      seen.add(key);
      queue.push([nr, nc]);
    }
  }
  assert(reached, `generateGridWorld(seed=${i}) keeps the goal reachable from start`);
}

// --- applyAction: bounces off walls and the grid edge instead of leaving the grid ---
{
  const w = buildWorld(3, 3, [[0, 1]], []);
  const hitWall = applyAction(w, 0, 0, "E");
  assert(hitWall.r === 0 && hitWall.c === 0, "applyAction bounces back off a wall");
  const hitEdge = applyAction(w, 0, 0, "N");
  assert(hitEdge.r === 0 && hitEdge.c === 0, "applyAction bounces back off the grid edge");
  const intoGoal = applyAction(buildWorld(2, 2, [], []), 1, 0, "E");
  assert(intoGoal.done && intoGoal.reward > 0, "applyAction reaching the goal is terminal with positive reward");
  const intoPit = applyAction(buildWorld(2, 2, [], [[0, 1]]), 0, 0, "E");
  assert(intoPit.done && intoPit.reward < 0, "applyAction reaching a pit is terminal with negative reward");
  const intoSpike = applyAction(buildWorld(2, 2, [], [], [[0, 1]]), 0, 0, "E");
  assert(!intoSpike.done && intoSpike.reward === SPIKE_REWARD, "applyAction stepping on a spike is non-terminal with the spike penalty");
}

// --- spikes hurt but never end the walk, and a rollout that crosses one reports it in spikeHits ---
{
  const w = buildWorld(1, 4, [], [], [[0, 1]]);
  const policy = new Int8Array(w.rows * w.cols).fill(2); // always "E"
  const rollout = greedyRolloutWithReward(w, policy, 10);
  assert(rollout.reachedGoal, "a rollout that crosses a spike can still reach the goal afterwards");
  assert(rollout.outcome === "goal", "Rollout.outcome is 'goal' when the walk ends on the goal cell");
  assert(
    rollout.spikeHits.length === 1 && rollout.spikeHits[0][0] === 0 && rollout.spikeHits[0][1] === 1,
    "Rollout.spikeHits records the cell where the spike was crossed"
  );
}

// --- generateGridWorld's mix produces spikes (not just walls/pits) across a handful of seeds ---
{
  let sawSpike = false;
  for (let i = 0; i < 15 && !sawSpike; i++) {
    const w = generateGridWorld(8, 8, i * 733 + 3);
    sawSpike = w.cells.some((row) => row.some((cell) => cell.type === "spike"));
  }
  assert(sawSpike, "generateGridWorld produces spike cells across sampled seeds");
}

// --- valueIteration: policy never points off-grid or into a wall ---
{
  const w = generateGridWorld(7, 7, 99);
  const vi = valueIteration(w, 0.95);
  for (let r = 0; r < w.rows; r++) {
    for (let c = 0; c < w.cols; c++) {
      const cell = w.cells[r][c];
      if (cell.type === "wall") continue;
      const s = stateIndex(w, r, c);
      if (cell.type === "goal" || cell.type === "pit") {
        assert(vi.policy[s] === -1, `valueIteration leaves terminal cell (${r},${c}) with no policy action`);
        continue;
      }
      const a = vi.policy[s];
      assert(a >= 0 && a < 4, `valueIteration assigns a valid action index at (${r},${c})`);
      const result = applyAction(w, r, c, ACTIONS[a] as Action);
      const target = w.cells[result.r][result.c];
      assert(target.type !== "wall", `valueIteration's policy at (${r},${c}) never walks into a wall`);
    }
  }
}

// --- greedyRollout: terminates and stays on the grid ---
{
  const w = generateGridWorld(6, 6, 7);
  const vi = valueIteration(w, 0.95);
  const path = greedyRollout(w, vi.policy, 100);
  assert(path.length > 0 && path.length <= 101, "greedyRollout produces a bounded path");
  for (const [r, c] of path) {
    assert(r >= 0 && r < w.rows && c >= 0 && c < w.cols, "greedyRollout never leaves the grid");
  }
  const last = path[path.length - 1];
  assert(w.cells[last[0]][last[1]].type !== "wall", "greedyRollout never ends on a wall");
}

// --- Q-learning converges near Value Iteration's optimal reward on a small deterministic grid ---
{
  const w = buildWorld(
    4,
    4,
    [
      [1, 1],
      [2, 1],
    ],
    [[0, 3]]
  );
  const vi = valueIteration(w, 0.95, 0);
  // vi.values is the *discounted* return, not directly comparable to an episode's raw summed
  // reward - roll the greedy policy out (deterministic here, slipChance=0) and sum its actual
  // per-step rewards instead, the same undiscounted total an episode's totalReward tracks.
  const optimalPath = greedyRollout(w, vi.policy, 60);
  let optimalReturn = 0;
  {
    let [r, c] = w.start;
    for (let i = 1; i < optimalPath.length; i++) {
      const [nr, nc] = optimalPath[i];
      const action = (["N", "S", "E", "W"] as const).find(
        (a) => applyAction(w, r, c, a).r === nr && applyAction(w, r, c, a).c === nc
      )!;
      optimalReturn += applyAction(w, r, c, action).reward;
      r = nr;
      c = nc;
    }
  }

  const result = runQLearning(w, {
    alpha: 0.5,
    gamma: 0.95,
    epsilonStart: 1,
    epsilonEnd: 0.05,
    episodes: 800,
    maxStepsPerEpisode: 60,
    slipChance: 0,
    seed: 123,
  });

  const last50 = result.episodes.slice(-50);
  const avgRecentReward = last50.reduce((a, e) => a + e.totalReward, 0) / last50.length;
  assert(
    Math.abs(avgRecentReward - optimalReturn) < 0.15,
    `Q-learning's late-training average reward (${avgRecentReward.toFixed(3)}) is close to optimal (${optimalReturn.toFixed(3)})`
  );

  assert(result.episodes.length === 800, "runQLearning returns one summary per episode");
  assert(result.qTableSnapshots.length > 1 && result.qTableSnapshots.length < 800, "qTableSnapshots is sampled, not one-per-episode");
  assert(result.qTableSnapshots[result.qTableSnapshots.length - 1].episode === 799, "qTableSnapshots always includes the final episode");

  // Deterministic per seed.
  const result2 = runQLearning(w, {
    alpha: 0.5,
    gamma: 0.95,
    epsilonStart: 1,
    epsilonEnd: 0.05,
    episodes: 800,
    maxStepsPerEpisode: 60,
    slipChance: 0,
    seed: 123,
  });
  assert(
    JSON.stringify(Array.from(result.finalQ)) === JSON.stringify(Array.from(result2.finalQ)),
    "runQLearning is deterministic for a fixed seed"
  );
}

if (failures > 0) {
  console.error(`\n${failures} RL test(s) failed.`);
  process.exit(1);
} else {
  console.log("\nAll RL tests passed.");
}
