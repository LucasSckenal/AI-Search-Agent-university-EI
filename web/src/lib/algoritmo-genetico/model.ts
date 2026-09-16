import { GaOps } from "../core/genetic";

/**
 * The domain for this explainer: an "explorer" genome is a fixed-length sequence of move genes -
 * gene i is the i-th step of a walk from START toward TARGET. Order matters (unlike Pêndulo/Goose's
 * NN-weight genomes, where a gene is just "one connection's weight" with no sequence to it), which
 * is what makes single-point crossover (below) the natural operator here instead of uniform-per-gene.
 * `evolve()` (core/genetic.ts) is reused completely unmodified - this file only supplies the
 * domain-specific GaOps it needs.
 */
export const GENE_COUNT = 16;
export const START: readonly [number, number] = [0, 0];
export const TARGET: readonly [number, number] = [6, 6];

export type Genome = Uint8Array;

// N, S, E, W - one unit step each.
const DIRS: readonly [number, number][] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

/** Every point visited, START included - length GENE_COUNT + 1. What the arena actually draws. */
export function simulatePath(genome: Genome): [number, number][] {
  const path: [number, number][] = [[START[0], START[1]]];
  let x = START[0];
  let y = START[1];
  for (let i = 0; i < genome.length; i++) {
    const [dx, dy] = DIRS[genome[i] % DIRS.length];
    x += dx;
    y += dy;
    path.push([x, y]);
  }
  return path;
}

export function finalDistance(genome: Genome): number {
  const path = simulatePath(genome);
  const [fx, fy] = path[path.length - 1];
  return Math.hypot(fx - TARGET[0], fy - TARGET[1]);
}

export function buildExplorerGaOps(): GaOps<Genome> {
  return {
    randomGenome(rng) {
      const g = new Uint8Array(GENE_COUNT) as Genome;
      for (let i = 0; i < GENE_COUNT; i++) g[i] = Math.floor(rng() * DIRS.length);
      return g;
    },
    fitness(genome) {
      return -finalDistance(genome);
    },
    mutate(genome, rng, rate) {
      const g = genome.slice() as Genome;
      for (let i = 0; i < g.length; i++) {
        if (rng() < rate) g[i] = Math.floor(rng() * DIRS.length);
      }
      return g;
    },
    crossover(a, b, rng) {
      // Single-point: everything before a random cut comes from parent A's walk, everything from
      // the cut onward from parent B's - the classic operator for a genome whose genes form a
      // sequence, splicing two partial walks into one instead of shuffling individual steps.
      const point = 1 + Math.floor(rng() * (GENE_COUNT - 1));
      const g = new Uint8Array(GENE_COUNT) as Genome;
      for (let i = 0; i < GENE_COUNT; i++) g[i] = i < point ? a[i] : b[i];
      return g;
    },
  };
}
