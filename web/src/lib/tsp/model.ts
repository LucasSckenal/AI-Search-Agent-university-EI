import { seededRng } from "../core/rng";

/** Logical square the cities live in; TspCanvas maps this into pixels, same convention as Goose's world units. */
export const TSP_WORLD_SIZE = 1000;

export interface City {
  id: number;
  x: number;
  y: number;
}

export function generateCities(count: number, seed: number): City[] {
  const rng = seededRng(seed);
  return Array.from({ length: count }, (_, id) => ({
    id,
    x: rng() * TSP_WORLD_SIZE,
    y: rng() * TSP_WORLD_SIZE,
  }));
}

export function distance(a: City, b: City): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** `tour` is a permutation of city indices; the route is a closed loop (last city connects back to the first). */
export function tourLength(cities: City[], tour: number[]): number {
  let total = 0;
  for (let i = 0; i < tour.length; i++) {
    const a = cities[tour[i]];
    const b = cities[tour[(i + 1) % tour.length]];
    total += distance(a, b);
  }
  return total;
}

export function nearestNeighborTour(cities: City[], startIndex = 0): number[] {
  const n = cities.length;
  if (n === 0) return [];
  const visited = new Array<boolean>(n).fill(false);
  const tour: number[] = [startIndex];
  visited[startIndex] = true;

  for (let step = 1; step < n; step++) {
    const cur = cities[tour[tour.length - 1]];
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const d = distance(cur, cities[i]);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    visited[best] = true;
    tour.push(best);
  }
  return tour;
}

export interface TourStep {
  tour: number[];
  length: number;
  /** City-id pairs formed by this step's swap; absent on step 0 (the untouched starting tour). */
  newEdges?: [number, number][];
}

/**
 * First-improvement 2-opt local search: repeatedly reverses the segment between two edges whenever
 * that reversal shortens the tour, until no such swap exists (a local optimum). Returns one TourStep
 * per accepted swap so the caller can scrub through the "untangling" frame by frame - step 0 is the
 * untouched starting tour. Synchronous rather than a generator: at the city counts this app's slider
 * allows (<=120), even the worst case finishes well under a frame budget.
 */
export function twoOptSteps(cities: City[], initialTour: number[], maxIterations = 2000): TourStep[] {
  const tour = initialTour.slice();
  const n = tour.length;
  const steps: TourStep[] = [{ tour: tour.slice(), length: tourLength(cities, tour) }];
  if (n < 4) return steps;

  let improved = true;
  let iterations = 0;
  while (improved && iterations < maxIterations) {
    improved = false;
    for (let i = 0; i < n - 1 && !improved; i++) {
      for (let j = i + 2; j < n && !improved; j++) {
        if (i === 0 && j === n - 1) continue; // adjacent wrap-around edge, not a real swap

        const a = cities[tour[i]];
        const b = cities[tour[i + 1]];
        const c = cities[tour[j]];
        const d = cities[tour[(j + 1) % n]];

        const before = distance(a, b) + distance(c, d);
        const after = distance(a, c) + distance(b, d);

        if (after + 1e-9 < before) {
          // Reverse the segment (i+1..j) so edges (a,b) and (c,d) become (a,c) and (b,d).
          let lo = i + 1;
          let hi = j;
          while (lo < hi) {
            [tour[lo], tour[hi]] = [tour[hi], tour[lo]];
            lo++;
            hi--;
          }
          steps.push({
            tour: tour.slice(),
            length: tourLength(cities, tour),
            newEdges: [
              [a.id, c.id],
              [b.id, d.id],
            ],
          });
          improved = true;
          iterations++;
        }
      }
    }
  }
  return steps;
}

export const HELD_KARP_MAX_CITIES = 12;

export interface HeldKarpResult {
  tour: number[];
  length: number;
}

/**
 * Exact DP over (visited-bitmask x ending-city), city 0 fixed as the start to kill rotational
 * symmetry. O(n^2 * 2^n) - trivially fast at n<=12 (49,152 states). Returns null above the cap (the
 * UI disables "Ótimo" mode instead of erroring) or when there aren't at least 2 cities.
 */
export function heldKarpOptimal(cities: City[]): HeldKarpResult | null {
  const n = cities.length;
  if (n < 2 || n > HELD_KARP_MAX_CITIES) return null;

  const dist: number[][] = Array.from({ length: n }, (_, i) => cities.map((c) => distance(cities[i], c)));

  const numMasks = 1 << n;
  const dp: Float64Array[] = Array.from({ length: numMasks }, () => new Float64Array(n).fill(Infinity));
  const parent: Int16Array[] = Array.from({ length: numMasks }, () => new Int16Array(n).fill(-1));

  dp[1 << 0][0] = 0;

  for (let mask = 1; mask < numMasks; mask++) {
    if ((mask & 1) === 0) continue; // city 0 must always be part of the visited set
    for (let last = 0; last < n; last++) {
      if ((mask & (1 << last)) === 0) continue;
      const cur = dp[mask][last];
      if (!Number.isFinite(cur)) continue;
      for (let next = 0; next < n; next++) {
        if (mask & (1 << next)) continue;
        const nextMask = mask | (1 << next);
        const candidate = cur + dist[last][next];
        if (candidate < dp[nextMask][next]) {
          dp[nextMask][next] = candidate;
          parent[nextMask][next] = last;
        }
      }
    }
  }

  const fullMask = numMasks - 1;
  let bestLast = -1;
  let bestLength = Infinity;
  for (let last = 1; last < n; last++) {
    const candidate = dp[fullMask][last] + dist[last][0];
    if (candidate < bestLength) {
      bestLength = candidate;
      bestLast = last;
    }
  }
  if (n === 1) {
    bestLast = 0;
    bestLength = 0;
  }

  const tour: number[] = [];
  let mask = fullMask;
  let cur = bestLast;
  while (cur !== -1) {
    tour.push(cur);
    const prevCur = cur;
    cur = parent[mask][cur];
    mask ^= 1 << prevCur;
  }
  tour.reverse();

  return { tour, length: bestLength };
}
