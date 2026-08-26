import { attackedCells, conflicts, backtrackingSteps, forwardCheckingSteps, minConflictsSteps, QueensStep } from "../src/lib/queens/model";
import { buildQueensGaOps } from "../src/lib/queens/genetic";

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

function isPermutation(genome: number[], n: number): boolean {
  if (genome.length !== n) return false;
  const seen = new Set(genome);
  if (seen.size !== n) return false;
  for (let i = 0; i < n; i++) if (!seen.has(i)) return false;
  return true;
}

function lastStep(steps: QueensStep[]): QueensStep {
  return steps[steps.length - 1];
}

// --- conflicts() ---
assert(conflicts([0, 1, 2, 3]).length === 6, "conflicts: every pair of a straight diagonal attacks (4x4 identity board)");
assert(conflicts([1, 3, 0, 2]).length === 0, "conflicts: a known 4-queens solution has zero conflicts");
assert(conflicts([0, 0, 1, 1]).length === 3, "conflicts: same-row pairs are counted (cols 0/1, cols 2/3, plus a diagonal between cols 1/2)");
assert(conflicts([-1, -1, 0, 1]).length === 1, "conflicts: unplaced (-1) columns are skipped");

// --- attackedCells() ---
{
  // Empty board: nothing is under attack.
  const set = attackedCells([-1, -1, -1, -1]);
  assert(set.size === 0, "attackedCells: an empty board attacks nothing");
}
{
  // A lone queen at (col 0, row 0) on a 4x4 board attacks: its whole row (cols 1-3, row 0), its
  // whole column (col 0, rows 1-3 - the full four-direction reach of a real chess queen, even
  // though this board representation can never actually produce a same-column conflict), and both
  // diagonals from (0,0): (1,1) (2,2) (3,3).
  const set = attackedCells([0, -1, -1, -1]);
  assert(set.has("1,0") && set.has("2,0") && set.has("3,0"), "attackedCells: a queen's row is fully attacked");
  assert(set.has("1,1") && set.has("2,2") && set.has("3,3"), "attackedCells: a queen's descending diagonal is attacked");
  assert(set.has("0,1") && set.has("0,2") && set.has("0,3"), "attackedCells: a queen's own column is fully attacked");
  assert(!set.has("0,0"), "attackedCells: a queen's own square isn't self-attacked");
}
{
  // Two mutually-attacking queens: each queen's own square shows up in the set (attacked by the
  // other), which is what lets manual play flag an unsafe placement including the piece itself.
  const set = attackedCells([0, 0, -1, -1]);
  assert(set.has("0,0") && set.has("1,0"), "attackedCells: two queens on the same row mutually attack each other's own squares");
}
{
  // A known 4-queens solution: no queen attacks another queen's square (all four are safe from
  // each other), even though plenty of *other* empty cells are attacked.
  const set = attackedCells([1, 3, 0, 2]);
  assert(!set.has("0,1") && !set.has("1,3") && !set.has("2,0") && !set.has("3,2"), "attackedCells: a valid solution's own queen squares are never attacked");
}

// --- backtrackingSteps: solvable N ---
for (const n of [4, 5, 6, 8]) {
  const steps = backtrackingSteps(n);
  const final = lastStep(steps);
  assert(final.action === "solved", `backtrackingSteps finds a solution for n=${n}`);
  assert(conflicts(final.board).length === 0, `backtrackingSteps's final board has zero conflicts for n=${n}`);
  assert(final.board.every((r) => r >= 0), `backtrackingSteps's final board is fully placed for n=${n}`);
}
// --- backtrackingSteps: unsolvable N ---
for (const n of [2, 3]) {
  const steps = backtrackingSteps(n);
  assert(!steps.some((s) => s.action === "solved"), `backtrackingSteps correctly finds no solution for n=${n}`);
}

// --- forwardCheckingSteps: solvable N + never expands more nodes than plain backtracking ---
for (const n of [4, 5, 6, 8, 10]) {
  const btSteps = backtrackingSteps(n);
  const fcSteps = forwardCheckingSteps(n);
  const btFinal = lastStep(btSteps);
  const fcFinal = lastStep(fcSteps);
  assert(fcFinal.action === "solved", `forwardCheckingSteps finds a solution for n=${n}`);
  assert(conflicts(fcFinal.board).length === 0, `forwardCheckingSteps's final board has zero conflicts for n=${n}`);
  assert(
    fcFinal.nodesExpanded <= btFinal.nodesExpanded,
    `forwardCheckingSteps never expands more nodes than plain backtracking for n=${n} (${fcFinal.nodesExpanded} vs ${btFinal.nodesExpanded})`
  );
}
for (const n of [2, 3]) {
  const steps = forwardCheckingSteps(n);
  assert(!steps.some((s) => s.action === "solved"), `forwardCheckingSteps correctly finds no solution for n=${n}`);
}

// --- minConflictsSteps: solvable N (local-search repair, should converge well within budget) ---
for (const n of [4, 5, 8, 20, 50]) {
  const result = minConflictsSteps(n, n * 31 + 7);
  assert(result.solved, `minConflictsSteps converges to a solution for n=${n}`);
  assert(conflicts(lastStep(result.steps).board).length === 0, `minConflictsSteps's final board has zero conflicts for n=${n}`);
}
// --- minConflictsSteps: unsolvable N terminates (doesn't loop forever) without falsely claiming success ---
for (const n of [2, 3]) {
  const result = minConflictsSteps(n, 99, 500);
  assert(!result.solved, `minConflictsSteps correctly gives up on unsolvable n=${n}`);
}
// --- minConflictsSteps: deterministic for a given seed ---
const mcA = minConflictsSteps(12, 555);
const mcB = minConflictsSteps(12, 555);
assert(
  JSON.stringify(lastStep(mcA.steps).board) === JSON.stringify(lastStep(mcB.steps).board),
  "minConflictsSteps is deterministic for a given seed"
);

// --- GA: randomGenome / crossover / mutate permutation validity (via buildQueensGaOps) ---
const gaOps = buildQueensGaOps(10);
const rng = seeded(9);
for (let trial = 0; trial < 200; trial++) {
  const a = gaOps.randomGenome(rng);
  const b = gaOps.randomGenome(rng);
  assert(isPermutation(a, 10) && isPermutation(b, 10), `randomGenome produces valid permutations [trial ${trial}]`);
  const child = gaOps.crossover(a, b, rng);
  assert(isPermutation(child, 10), `crossover always produces a valid permutation [trial ${trial}]`);
  const mutated = gaOps.mutate(child, rng, 1);
  assert(isPermutation(mutated, 10), `mutate always produces a valid permutation [trial ${trial}]`);
}
// --- GA: fitness of a known zero-conflict permutation is 0 ---
assert(gaOps.fitness([1, 3, 0, 2].concat([4, 5, 6, 7, 8, 9])) <= 0, "fitness is non-positive (higher-is-better, 0 = no conflicts)");
assert(buildQueensGaOps(4).fitness([1, 3, 0, 2]) === 0, "fitness is exactly 0 for a known 4-queens solution");

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll Queens tests passed.");
}
