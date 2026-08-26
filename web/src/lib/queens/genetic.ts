import { GaOps } from "../core/genetic";
import { conflicts } from "./model";

/** genome[col] = row of the queen in that column - a permutation of rows, so row/column conflicts
 *  are impossible by construction and the GA only ever has to fight diagonal conflicts. */
export type QueensGenome = number[];

/**
 * Order Crossover (OX) - identical to tsp/genetic.ts's own orderCrossover, copied rather than
 * imported since it's tied conceptually to "genome is a permutation" and not to TSP specifically:
 * copies a random contiguous slice from parent A verbatim, then fills the rest in parent B's order,
 * skipping rows already used.
 */
function orderCrossover(a: QueensGenome, b: QueensGenome, rng: () => number): QueensGenome {
  const n = a.length;
  const i = Math.floor(rng() * n);
  const j = Math.floor(rng() * n);
  const lo = Math.min(i, j);
  const hi = Math.max(i, j);

  const child = new Array<number>(n).fill(-1);
  const used = new Set<number>();
  for (let k = lo; k <= hi; k++) {
    child[k] = a[k];
    used.add(a[k]);
  }

  let pos = (hi + 1) % n;
  for (let k = 0; k < n; k++) {
    const gene = b[(hi + 1 + k) % n];
    if (used.has(gene)) continue;
    child[pos] = gene;
    pos = (pos + 1) % n;
  }

  return child;
}

/** Swaps two random positions with probability `rate` - simpler than TSP's segment reversal, but
 *  equally permutation-safe; either move is a fine mutation operator for a permutation genome. */
function swapMutation(genome: QueensGenome, rng: () => number, rate: number): QueensGenome {
  if (rng() >= rate) return genome;
  const n = genome.length;
  const i = Math.floor(rng() * n);
  const j = Math.floor(rng() * n);
  const next = genome.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function buildQueensGaOps(n: number): GaOps<QueensGenome> {
  return {
    randomGenome: (rng) => {
      const genome = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [genome[i], genome[j]] = [genome[j], genome[i]];
      }
      return genome;
    },
    fitness: (genome) => -conflicts(genome).length,
    mutate: swapMutation,
    crossover: orderCrossover,
  };
}
