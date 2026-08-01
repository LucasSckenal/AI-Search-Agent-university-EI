import { effectiveBranchingFactor } from "../src/lib/core/metrics";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

function approx(a: number, b: number, tol = 0.01) {
  return Math.abs(a - b) <= tol;
}

// Classic textbook example (Russell & Norvig, "AIMA", the 8-puzzle b* table): N=52 nodes
// generated at depth d=5 gives b* ≈ 1.92.
{
  const b = effectiveBranchingFactor(52, 5);
  assert(b !== null && approx(b, 1.92, 0.01), `matches the AIMA textbook example (got ${b})`);
}

// A perfectly linear search (exactly one node generated per depth level, no branching at all)
// must have b* = 1 - the definition's edge case.
{
  const b = effectiveBranchingFactor(10, 10);
  assert(b !== null && approx(b, 1, 1e-6), `linear search (N=depth) gives b*=1 (got ${b})`);
}

// A uniform tree of branching factor 2 and depth 3 generates 1+2+4+8=15 nodes by construction -
// feeding that back in must recover b*=2.
{
  const depth = 3;
  const trueBranching = 2;
  let nodes = 0;
  let level = 1;
  for (let d = 0; d <= depth; d++) {
    nodes += level;
    level *= trueBranching;
  }
  const b = effectiveBranchingFactor(nodes - 1, depth); // function adds 1 back internally
  assert(b !== null && approx(b, trueBranching, 0.01), `round-trips a known uniform branching factor (got ${b})`);
}

// Degenerate inputs (depth 0, or fewer than 2 nodes generated) aren't meaningful - must return
// null rather than NaN or a misleading number.
{
  assert(effectiveBranchingFactor(5, 0) === null, "depth=0 returns null");
  assert(effectiveBranchingFactor(0, 5) === null, "nodesGenerated=0 returns null");
  assert(effectiveBranchingFactor(1, 5) === null, "nodesGenerated=1 returns null");
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll effective-branching-factor tests passed.");
}
