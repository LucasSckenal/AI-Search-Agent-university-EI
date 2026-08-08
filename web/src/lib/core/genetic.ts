import { seededRng } from "./rng";

/**
 * Domain-agnostic genetic algorithm engine, reused by both the maze's GA mode and the Goose game's
 * evolved agents. Every domain-specific piece (genome shape, fitness, mutation, crossover) is
 * injected via GaOps; this file only owns the population/selection/elitism/generations bookkeeping.
 */
export interface GaConfig {
  populationSize: number;
  generations: number;
  eliteCount: number;
  mutationRate: number;
  crossoverRate: number;
  tournamentSize: number;
  seed: number;
  /** How many top genomes per generation to keep in `topPerGeneration` (default 1). Only the Goose
   *  page needs more than 1, to replay several agents of the same generation running together. */
  topK?: number;
}

export interface GaOps<G> {
  randomGenome(rng: () => number): G;
  /** Higher is better. */
  fitness(genome: G): number;
  mutate(genome: G, rng: () => number, rate: number): G;
  crossover(a: G, b: G, rng: () => number): G;
}

export interface GaGenerationSummary {
  generation: number;
  bestFitness: number;
  meanFitness: number;
  worstFitness: number;
  stdFitness: number;
}

export interface GaRunResult<G> {
  config: GaConfig;
  generations: GaGenerationSummary[];
  /** Best genome of each generation, in order - lets a caller scrub through the run's history. */
  bestPerGeneration: G[];
  /** Top `config.topK` genomes of each generation (sorted best-first), same length as `bestPerGeneration`. */
  topPerGeneration: G[][];
  bestEverGenome: G;
  bestEverFitness: number;
}

function summarizeFitness(generation: number, fitnesses: number[]): GaGenerationSummary {
  const mean = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
  const variance = fitnesses.reduce((a, b) => a + (b - mean) ** 2, 0) / fitnesses.length;
  return {
    generation,
    bestFitness: Math.max(...fitnesses),
    meanFitness: mean,
    worstFitness: Math.min(...fitnesses),
    stdFitness: Math.sqrt(variance),
  };
}

function tournamentSelect<G>(pool: { genome: G; fitness: number }[], size: number, rng: () => number): G {
  let best = pool[Math.floor(rng() * pool.length)];
  for (let i = 1; i < size; i++) {
    const challenger = pool[Math.floor(rng() * pool.length)];
    if (challenger.fitness > best.fitness) best = challenger;
  }
  return best.genome;
}

/**
 * Evolves a population for `config.generations` generations, yielding a GaGenerationSummary after
 * each one completes. Callers can drain it synchronously (`for (const s of evolve(...))`, cheap
 * runs) or pull `.next()` a few times per tick inside a setTimeout(0) loop (expensive runs) to
 * avoid blocking the main thread - both share this one loop instead of duplicating it.
 */
export function* evolve<G>(config: GaConfig, ops: GaOps<G>): Generator<GaGenerationSummary, GaRunResult<G>, void> {
  const rng = seededRng(config.seed);
  const topK = config.topK ?? 1;
  let population: G[] = Array.from({ length: config.populationSize }, () => ops.randomGenome(rng));

  const summaries: GaGenerationSummary[] = [];
  const bestPerGeneration: G[] = [];
  const topPerGeneration: G[][] = [];
  let bestEverGenome = population[0];
  let bestEverFitness = -Infinity;

  for (let gen = 0; gen < config.generations; gen++) {
    const scored = population
      .map((genome) => ({ genome, fitness: ops.fitness(genome) }))
      .sort((a, b) => b.fitness - a.fitness);

    const summary = summarizeFitness(gen, scored.map((s) => s.fitness));
    summaries.push(summary);
    bestPerGeneration.push(scored[0].genome);
    topPerGeneration.push(scored.slice(0, topK).map((s) => s.genome));
    if (scored[0].fitness > bestEverFitness) {
      bestEverFitness = scored[0].fitness;
      bestEverGenome = scored[0].genome;
    }

    const next: G[] = scored.slice(0, config.eliteCount).map((s) => s.genome);
    while (next.length < config.populationSize) {
      const parentA = tournamentSelect(scored, config.tournamentSize, rng);
      let child: G;
      if (rng() < config.crossoverRate) {
        const parentB = tournamentSelect(scored, config.tournamentSize, rng);
        child = ops.crossover(parentA, parentB, rng);
      } else {
        child = parentA;
      }
      next.push(ops.mutate(child, rng, config.mutationRate));
    }
    population = next;

    yield summary;
  }

  return {
    config,
    generations: summaries,
    bestPerGeneration,
    topPerGeneration,
    bestEverGenome,
    bestEverFitness,
  };
}
