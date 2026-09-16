import { PATTERN_LIBRARY, buildWeights, corrupt, energy, overlap, recall } from "../src/lib/hopfield/model";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

function runToCompletion(W: number[][], initial: number[], seed: number) {
  const iterator = recall(W, initial, seed);
  let next = iterator.next();
  const steps = [];
  while (!next.done) {
    steps.push(next.value);
    next = iterator.next();
  }
  return { steps, result: next.value };
}

// --- Energy never increases under async updates (the classical Hopfield guarantee) ---
{
  const patterns = PATTERN_LIBRARY.slice(0, 3).map((p) => p.values);
  const W = buildWeights(patterns);
  const corrupted = corrupt(patterns[0], 0.25, 1);
  const { steps } = runToCompletion(W, corrupted, 1);
  let violations = 0;
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].energy > steps[i - 1].energy + 1e-9) violations++;
  }
  assert(violations === 0, `energy never increases across ${steps.length} steps (${violations} violations)`);
  assert(steps[steps.length - 1].energy <= steps[0].energy, "final energy is at or below the initial energy");
}

// --- With few stored patterns (well within capacity), recall from noise converges exactly back ---
{
  const stored = PATTERN_LIBRARY.slice(0, 3);
  const patterns = stored.map((p) => p.values);
  const W = buildWeights(patterns);
  let successes = 0;
  for (let i = 0; i < stored.length; i++) {
    const corrupted = corrupt(patterns[i], 0.15, 100 + i);
    const { result } = runToCompletion(W, corrupted, 200 + i);
    const ov = overlap(result.finalState, patterns[i]);
    if (ov > 0.98) successes++;
  }
  assert(successes === stored.length, `with only ${stored.length} patterns stored, recall from 15% noise returns exactly to the original pattern every time (${successes}/${stored.length})`);
}

// --- Storing every pattern in the library at once overloads capacity and recall degrades ---
{
  const fewPatterns = PATTERN_LIBRARY.slice(0, 2).map((p) => p.values);
  const allPatterns = PATTERN_LIBRARY.map((p) => p.values);
  const Wfew = buildWeights(fewPatterns);
  const Wall = buildWeights(allPatterns);

  const avgOverlap = (W: number[][], patterns: number[][]) => {
    let total = 0;
    for (let i = 0; i < patterns.length; i++) {
      const corrupted = corrupt(patterns[i], 0.15, 300 + i);
      const { result } = runToCompletion(W, corrupted, 400 + i);
      total += overlap(result.finalState, patterns[i]);
    }
    return total / patterns.length;
  };

  const fewAvg = avgOverlap(Wfew, fewPatterns);
  const allAvg = avgOverlap(Wall, allPatterns);
  console.log(`  (overlap with only 2 stored: ${fewAvg.toFixed(3)}, with all ${allPatterns.length} stored: ${allAvg.toFixed(3)})`);
  assert(fewAvg > 0.98, `storing only 2 patterns recalls them almost perfectly (avg overlap ${fewAvg.toFixed(3)})`);
  assert(allAvg < fewAvg - 0.02, `storing all ${allPatterns.length} patterns at once measurably hurts recall vs. storing only 2 (${allAvg.toFixed(3)} < ${fewAvg.toFixed(3)})`);
}

// --- corrupt() actually flips roughly the requested fraction of bits ---
{
  const original = PATTERN_LIBRARY[0].values;
  const corrupted = corrupt(original, 0.2, 42);
  const ov = overlap(original, corrupted);
  assert(Math.abs(ov - 0.8) < 0.05, `corrupt(0.2) leaves roughly 80% of bits matching (${ov.toFixed(3)})`);
}

// --- energy() is symmetric-consistent: a stored pattern sits at (near) a local minimum ---
{
  const patterns = PATTERN_LIBRARY.slice(0, 3).map((p) => p.values);
  const W = buildWeights(patterns);
  const e = energy(W, patterns[0]);
  const oneFlip = [...patterns[0]];
  oneFlip[0] *= -1;
  const eFlipped = energy(W, oneFlip);
  assert(eFlipped >= e - 1e-9, `flipping one bit of a stored pattern never lowers its energy (stored ${e.toFixed(2)}, flipped ${eFlipped.toFixed(2)})`);
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll Hopfield tests passed.");
}
