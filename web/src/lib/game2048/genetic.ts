import { GaOps } from "../core/genetic";
import { HeuristicWeights, runGame } from "./model";

/** The genome IS the heuristic's weight vector - evolution searches for a better set of weights
 *  for the exact same zero-lookahead decision procedure Heurística Gulosa already uses, rather
 *  than a different algorithm. Fitness plays one full game with the genome's weights on the page's
 *  current board size/seed (same "optimize for this instance" convention TSP's own GA uses), capped
 *  at `evalMaxMoves` - much shorter than a showcase run's cap, since a generation evaluates the
 *  whole population and a mediocre genome can otherwise wander for thousands of moves before it
 *  gets stuck, which would make evolution far too slow to run in a browser tab. */
function clampWeight(v: number): number {
  return Math.max(0, v);
}

export function buildGame2048GaOps(size: number, seed: number, evalMaxMoves: number): GaOps<HeuristicWeights> {
  return {
    randomGenome(rng) {
      return {
        empty: 0.5 + rng() * 3.5,
        mono: rng() * 2.5,
        smooth: rng() * 0.5,
        corner: rng() * 2.5,
      };
    },
    fitness(genome) {
      const result = runGame({ size, mode: "genetic", weights: genome, seed, expectimaxDepth: 1, maxMoves: evalMaxMoves });
      return result.finalScore;
    },
    mutate(genome, rng, rate) {
      const jitter = (v: number, spread: number) => (rng() < rate ? clampWeight(v + (rng() - 0.5) * spread) : v);
      return {
        empty: jitter(genome.empty, 1.2),
        mono: jitter(genome.mono, 0.8),
        smooth: jitter(genome.smooth, 0.2),
        corner: jitter(genome.corner, 0.8),
      };
    },
    crossover(a, b, rng) {
      const mix = (x: number, y: number) => (rng() < 0.5 ? x : y);
      return { empty: mix(a.empty, b.empty), mono: mix(a.mono, b.mono), smooth: mix(a.smooth, b.smooth), corner: mix(a.corner, b.corner) };
    },
  };
}
