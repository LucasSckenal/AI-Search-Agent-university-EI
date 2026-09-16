import {
  GridWorld,
  QLearningResult,
  RLConfig,
  Rollout,
  ValueIterationResult,
  greedyPolicyFromQ,
  greedyRolloutWithReward,
  runQLearning,
  valueIteration,
} from "@/lib/rl/model";

export interface RlRun {
  world: GridWorld;
  config: RLConfig;
  q: QLearningResult;
  qRollout: Rollout;
  vi: ValueIterationResult;
  viRollout: Rollout;
}

/** Runs both real algorithms on the same world/config - the one place every tutorial step that
 *  needs a full comparison (prediction, simulation, inspection, comparison, challenge) goes
 *  through, so none of them duplicate the rollout-from-policy plumbing. */
export function runRlComparison(world: GridWorld, config: RLConfig): RlRun {
  const nStates = world.rows * world.cols;
  const q = runQLearning(world, config);
  const qPolicy = greedyPolicyFromQ(q.finalQ, nStates);
  const qRollout = greedyRolloutWithReward(world, qPolicy, config.maxStepsPerEpisode);
  const vi = valueIteration(world, config.gamma, config.slipChance);
  const viRollout = greedyRolloutWithReward(world, vi.policy, config.maxStepsPerEpisode);
  return { world, config, q, qRollout, vi, viRollout };
}

/** The rollout a Q-table snapshot mid-training would produce if training stopped right there -
 *  what the simulation stage animates as it scrubs through qTableSnapshots. */
export function rolloutForSnapshot(world: GridWorld, snapshotQ: Float32Array, maxSteps: number): Rollout {
  const nStates = world.rows * world.cols;
  const policy = greedyPolicyFromQ(snapshotQ, nStates);
  return greedyRolloutWithReward(world, policy, maxSteps);
}
