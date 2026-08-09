import {
  generateCities,
  tourLength,
  nearestNeighborTour,
  twoOptSteps,
  heldKarpOptimal,
  HELD_KARP_MAX_CITIES,
  City,
} from "../src/lib/tsp/model";
import { buildTspGaOps } from "../src/lib/tsp/genetic";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function isPermutation(tour: number[], n: number): boolean {
  if (tour.length !== n) return false;
  const seen = new Set(tour);
  if (seen.size !== n) return false;
  for (let i = 0; i < n; i++) if (!seen.has(i)) return false;
  return true;
}

function bruteForceOptimal(cities: City[]): number {
  const n = cities.length;
  const indices = Array.from({ length: n - 1 }, (_, i) => i + 1);
  let best = Infinity;
  const permute = (arr: number[], k: number) => {
    if (k === arr.length) {
      best = Math.min(best, tourLength(cities, [0, ...arr]));
      return;
    }
    for (let i = k; i < arr.length; i++) {
      [arr[k], arr[i]] = [arr[i], arr[k]];
      permute(arr, k + 1);
      [arr[k], arr[i]] = [arr[i], arr[k]];
    }
  };
  permute(indices, 0);
  return best;
}

// --- generateCities ---
const citiesA = generateCities(20, 42);
const citiesB = generateCities(20, 42);
assert(
  citiesA.every((c, i) => c.x === citiesB[i].x && c.y === citiesB[i].y),
  "generateCities is deterministic for a given seed"
);
assert(
  citiesA.every((c) => c.x >= 0 && c.x <= 1000 && c.y >= 0 && c.y <= 1000),
  "generateCities produces coordinates within TSP_WORLD_SIZE"
);

// --- tourLength ---
const square: City[] = [
  { id: 0, x: 0, y: 0 },
  { id: 1, x: 10, y: 0 },
  { id: 2, x: 10, y: 10 },
  { id: 3, x: 0, y: 10 },
];
assert(Math.abs(tourLength(square, [0, 1, 2, 3]) - 40) < 1e-9, "tourLength sums a true closed loop (unit square perimeter)");

// --- nearestNeighborTour ---
for (let seed = 1; seed <= 5; seed++) {
  const cities = generateCities(15, seed * 100);
  const tour = nearestNeighborTour(cities);
  assert(isPermutation(tour, cities.length), `nearestNeighborTour visits every city exactly once [seed ${seed}]`);
}

// --- twoOptSteps ---
for (let seed = 1; seed <= 5; seed++) {
  const cities = generateCities(18, seed * 200);
  const start = nearestNeighborTour(cities);
  const steps = twoOptSteps(cities, start);
  assert(isPermutation(steps[steps.length - 1].tour, cities.length), `twoOptSteps ends on a valid permutation [seed ${seed}]`);
  for (let i = 1; i < steps.length; i++) {
    assert(steps[i].length <= steps[i - 1].length + 1e-9, `twoOptSteps never increases length at step ${i} [seed ${seed}]`);
  }
  // Local optimum: no further improving 2-opt swap should exist on the final tour.
  const finalSteps = twoOptSteps(cities, steps[steps.length - 1].tour);
  assert(finalSteps.length === 1, `twoOptSteps terminates at a local optimum [seed ${seed}]`);
}

// --- heldKarpOptimal ---
for (let n = 3; n <= 8; n++) {
  const cities = generateCities(n, n * 777);
  const result = heldKarpOptimal(cities);
  assert(result !== null, `heldKarpOptimal returns a result for n=${n}`);
  if (result) {
    assert(isPermutation(result.tour, n), `heldKarpOptimal tour is a valid permutation for n=${n}`);
    const brute = bruteForceOptimal(cities);
    assert(Math.abs(result.length - brute) < 1e-6, `heldKarpOptimal matches brute force for n=${n} (${result.length.toFixed(4)} vs ${brute.toFixed(4)})`);
  }
}
assert(heldKarpOptimal(generateCities(HELD_KARP_MAX_CITIES + 1, 1)) === null, "heldKarpOptimal returns null above HELD_KARP_MAX_CITIES");

// --- orderCrossover / mutation permutation validity (via buildTspGaOps) ---
const gaCities = generateCities(12, 555);
const ops = buildTspGaOps(gaCities);
const rng = seeded(9);
for (let trial = 0; trial < 200; trial++) {
  const a = ops.randomGenome(rng);
  const b = ops.randomGenome(rng);
  assert(isPermutation(a, gaCities.length) && isPermutation(b, gaCities.length), `randomGenome produces valid permutations [trial ${trial}]`);
  const child = ops.crossover(a, b, rng);
  assert(isPermutation(child, gaCities.length), `crossover always produces a valid permutation [trial ${trial}]`);
  const mutated = ops.mutate(child, rng, 1);
  assert(isPermutation(mutated, gaCities.length), `mutate always produces a valid permutation [trial ${trial}]`);
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll TSP tests passed.");
}
