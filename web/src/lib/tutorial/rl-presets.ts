import { GridWorld, RLConfig, generateGridWorld } from "@/lib/rl/model";

/**
 * The tutorial deliberately trains on a SHORT episode budget - well under /aprendizado's own
 * 600-episode default - because that is precisely what makes the lesson's central point visible:
 * a real gap between what Q-learning achieves and what Value Iteration guarantees. Verified
 * empirically (scratch scripts, since deleted) against the real runQLearning()/valueIteration():
 * at the site's own 600-episode default, small grids converge to an exact match almost every time,
 * which would make steps 04/07 (prediction/comparison) pedagogically empty. At 80 episodes, all
 * three presets below show a real, honest gap - never invented, always recomputed live.
 */
export const RL_TUTORIAL_EPISODES = 80;

export const RL_BASE_CONFIG = {
  alpha: 0.5,
  gamma: 0.95,
  epsilonStart: 1,
  epsilonEnd: 0.05,
  slipChance: 0,
} as const;

export interface RlPreset {
  id: string;
  label: string;
  size: number;
  seed: number;
}

/**
 * Each seed was found by sweeping generateGridWorld()'s real output against runQLearning() at
 * RL_TUTORIAL_EPISODES, filtering for a genuine reward gap versus valueIteration() on the same
 * world - not picked by eye. The three form a deliberate arc: a mild inefficiency (still reaches
 * the goal, just a worse path), and two outright failures (times out without ever reaching the
 * goal) on harder grids.
 */
export const RL_PRESETS: RlPreset[] = [
  { id: "pequena", label: "Grade pequena (5×5)", size: 5, seed: 2 },
  { id: "media", label: "Grade média (6×6)", size: 6, seed: 555 },
  { id: "grande", label: "Grade grande (8×8)", size: 8, seed: 99 },
];

export function worldForPreset(preset: Pick<RlPreset, "size" | "seed">): GridWorld {
  return generateGridWorld(preset.size, preset.size, preset.seed);
}

export function configFor(preset: Pick<RlPreset, "size" | "seed">, episodes: number): RLConfig {
  return { ...RL_BASE_CONFIG, episodes, maxStepsPerEpisode: preset.size * preset.size * 4, seed: preset.seed };
}
