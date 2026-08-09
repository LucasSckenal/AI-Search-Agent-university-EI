import { GaOps } from "../core/genetic";
import { City, tourLength } from "./model";

export type TspGenome = number[];

/**
 * Order Crossover (OX): copies a random contiguous slice from parent A verbatim, then fills the
 * remaining positions in parent B's order, skipping cities already used. Required because a TSP
 * genome is a permutation - maze's single-point crossover would duplicate/drop cities and produce
 * an invalid tour here.
 */
function orderCrossover(a: TspGenome, b: TspGenome, rng: () => number): TspGenome {
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

/**
 * Segment-reversal ("inversion") mutation: with probability `rate`, reverses one random contiguous
 * slice of the whole genome; otherwise returns it unchanged. Must be a whole-genome operation
 * (unlike maze's per-gene reroll) since perturbing a single position independently would break the
 * permutation invariant. This is also the same move 2-opt performs one step at a time, an
 * intentional echo of the standalone local-search algorithm offered alongside the GA.
 */
function invertSegmentMutation(genome: TspGenome, rng: () => number, rate: number): TspGenome {
  if (rng() >= rate) return genome;
  const n = genome.length;
  const i = Math.floor(rng() * n);
  const j = Math.floor(rng() * n);
  const lo = Math.min(i, j);
  const hi = Math.max(i, j);
  const next = genome.slice();
  let a = lo;
  let b = hi;
  while (a < b) {
    [next[a], next[b]] = [next[b], next[a]];
    a++;
    b--;
  }
  return next;
}

export function buildTspGaOps(cities: City[]): GaOps<TspGenome> {
  const n = cities.length;

  return {
    randomGenome: (rng) => {
      const genome = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [genome[i], genome[j]] = [genome[j], genome[i]];
      }
      return genome;
    },
    fitness: (genome) => -tourLength(cities, genome),
    mutate: invertSegmentMutation,
    crossover: orderCrossover,
  };
}
