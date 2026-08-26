import { GaOps } from "../core/genetic";
import { HeuristicWeights, runGame } from "./model";

export interface TetrisGaOptions {
  seed: number;
  maxPieces: number;
}

function clampWeight(v: number): number {
  return Math.max(0, v);
}

function fitness(genome: HeuristicWeights, options: TetrisGaOptions): number {
  return runGame({ weights: genome, seed: options.seed, maxPieces: options.maxPieces }).finalScore;
}

function gaussianJitter(rng: () => number, sigma: number): number {
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma;
}

export function buildTetrisGaOps(options: TetrisGaOptions): GaOps<HeuristicWeights> {
  return {
    randomGenome: (rng) => ({
      lines: rng() * 2,
      height: rng() * 1.2,
      holes: rng() * 1.5,
      bumpiness: rng() * 0.6,
    }),
    fitness: (genome) => fitness(genome, options),
    mutate: (genome, rng, rate) => ({
      lines: rng() < rate ? clampWeight(genome.lines + gaussianJitter(rng, 0.3)) : genome.lines,
      height: rng() < rate ? clampWeight(genome.height + gaussianJitter(rng, 0.2)) : genome.height,
      holes: rng() < rate ? clampWeight(genome.holes + gaussianJitter(rng, 0.25)) : genome.holes,
      bumpiness: rng() < rate ? clampWeight(genome.bumpiness + gaussianJitter(rng, 0.15)) : genome.bumpiness,
    }),
    crossover: (a, b, rng) => ({
      lines: rng() < 0.5 ? a.lines : b.lines,
      height: rng() < 0.5 ? a.height : b.height,
      holes: rng() < 0.5 ? a.holes : b.holes,
      bumpiness: rng() < 0.5 ? a.bumpiness : b.bumpiness,
    }),
  };
}
