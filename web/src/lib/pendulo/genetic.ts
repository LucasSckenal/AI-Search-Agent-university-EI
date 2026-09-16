import { GaOps } from "../core/genetic";
import { GENOME_LENGTH, decide, extractInputs } from "./agent";
import { PenduloState, createInitialState, stepPendulo } from "./model";

export interface PenduloGaOptions {
  /** Shared initial-tilt seed - every genome in a generation starts from the exact same theta0, so
   *  fitness differences reflect the agent, not luck. */
  runSeed: number;
  maxSteps: number;
  dt: number;
}

/** Small bonus for staying near track center, on top of raw survival time - without it, a genome
 *  that survives the full run by drifting all the way to one edge scores identically to one that
 *  stayed balanced and centered, even though the latter is the better controller. */
const CENTERING_BONUS_WEIGHT = 0.02;

/** Runs one genome to failure (or maxSteps) with a fixed physics timestep, no rendering involved. */
export function simulateHeadless(genome: Float64Array, options: PenduloGaOptions): PenduloState {
  let state = createInitialState(options.runSeed);
  for (let i = 0; i < options.maxSteps && state.alive; i++) {
    const action = decide(genome, extractInputs(state));
    state = stepPendulo(state, action, options.dt);
  }
  return state;
}

/** Same simulation as simulateHeadless, but returns every intermediate state (including the
 *  initial one) so a caller can scrub/play back the run frame-by-frame instead of only seeing the
 *  final outcome. Re-simulating on demand like this - rather than recording frames for every
 *  genome of every generation up front - keeps memory bounded to whatever the user is currently
 *  watching. */
export function simulateFrames(genome: Float64Array, options: PenduloGaOptions): PenduloState[] {
  const frames: PenduloState[] = [createInitialState(options.runSeed)];
  let state = frames[0];
  for (let i = 0; i < options.maxSteps && state.alive; i++) {
    const action = decide(genome, extractInputs(state));
    state = stepPendulo(state, action, options.dt);
    frames.push(state);
  }
  return frames;
}

function penduloFitness(genome: Float64Array, options: PenduloGaOptions): number {
  const final = simulateHeadless(genome, options);
  return final.steps - CENTERING_BONUS_WEIGHT * Math.abs(final.x) * final.steps;
}

function gaussianJitter(rng: () => number, sigma: number): number {
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma;
}

export function buildPenduloGaOps(options: PenduloGaOptions): GaOps<Float64Array> {
  return {
    randomGenome: (rng) => {
      const genome = new Float64Array(GENOME_LENGTH);
      for (let i = 0; i < GENOME_LENGTH; i++) genome[i] = rng() * 2 - 1;
      return genome;
    },
    fitness: (genome) => penduloFitness(genome, options),
    mutate: (genome, rng, rate) => {
      const next = new Float64Array(genome);
      for (let i = 0; i < next.length; i++) {
        if (rng() < rate) next[i] += gaussianJitter(rng, 0.4);
      }
      return next;
    },
    // Uniform per-weight: a weight vector has no positional structure to preserve, so a per-weight
    // coin flip is the natural choice (same reasoning as Goose's genome crossover).
    crossover: (a, b, rng) => {
      const child = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) child[i] = rng() < 0.5 ? a[i] : b[i];
      return child;
    },
  };
}
