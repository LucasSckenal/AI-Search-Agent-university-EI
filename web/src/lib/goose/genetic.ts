import { GaOps } from "../core/genetic";
import { GENOME_LENGTH, decide, extractInputs } from "./agent";
import { GooseRunState, createInitialState, stepGame } from "./model";

export interface GooseGaOptions {
  /** Shared obstacle-sequence seed - every genome in a generation is evaluated against the exact
   *  same obstacles, so fitness differences reflect the agent, not luck. */
  runSeed: number;
  maxSteps: number;
  dtSeconds: number;
}

const OBSTACLE_CLEAR_BONUS = 50;

/** Runs one genome to death (or maxSteps) with a fixed physics timestep, no rendering involved. */
export function simulateHeadless(genome: Float64Array, options: GooseGaOptions): GooseRunState {
  let state = createInitialState(options.runSeed);
  for (let i = 0; i < options.maxSteps && state.alive; i++) {
    const action = decide(genome, extractInputs(state));
    state = stepGame(state, action, options.dtSeconds);
  }
  return state;
}

/** Same simulation as simulateHeadless, but returns every intermediate state (including the
 *  initial one) so a caller can scrub/play back the run frame-by-frame instead of only seeing the
 *  final outcome. Re-simulating on demand like this - rather than recording frames for every
 *  genome of every generation up front - keeps memory bounded to whatever the user is currently
 *  watching. */
export function simulateFrames(genome: Float64Array, options: GooseGaOptions): GooseRunState[] {
  const frames: GooseRunState[] = [createInitialState(options.runSeed)];
  let state = frames[0];
  for (let i = 0; i < options.maxSteps && state.alive; i++) {
    const action = decide(genome, extractInputs(state));
    state = stepGame(state, action, options.dtSeconds);
    frames.push(state);
  }
  return frames;
}

function gooseFitness(genome: Float64Array, options: GooseGaOptions): number {
  const final = simulateHeadless(genome, options);
  return final.distance + final.obstaclesCleared * OBSTACLE_CLEAR_BONUS;
}

function gaussianJitter(rng: () => number, sigma: number): number {
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma;
}

export function buildGooseGaOps(options: GooseGaOptions): GaOps<Float64Array> {
  return {
    randomGenome: (rng) => {
      const genome = new Float64Array(GENOME_LENGTH);
      for (let i = 0; i < GENOME_LENGTH; i++) genome[i] = rng() * 2 - 1;
      return genome;
    },
    fitness: (genome) => gooseFitness(genome, options),
    mutate: (genome, rng, rate) => {
      const next = new Float64Array(genome);
      for (let i = 0; i < next.length; i++) {
        if (rng() < rate) next[i] += gaussianJitter(rng, 0.4);
      }
      return next;
    },
    // Uniform per-weight: unlike the maze's spatially-ordered move sequence, a weight vector has
    // no positional structure to preserve, so a per-weight coin flip is the natural choice.
    crossover: (a, b, rng) => {
      const child = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) child[i] = rng() < 0.5 ? a[i] : b[i];
      return child;
    },
  };
}
