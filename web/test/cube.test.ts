import { solvedCube, applyMove, hashCube, MOVES_2X2 } from "../src/lib/cube/model";
import { runFastCubeChecks } from "./cube-checks";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

runFastCubeChecks(assert);

if (failures > 0) {
  console.error(`\n${failures} failure(s) in fast tests - skipping exhaustive 2x2 state-count test`);
  process.exit(1);
}
console.log("\nAll fast cube tests passed (2x2 and 3x3). Running exhaustive 2x2 state-space BFS (this may take a bit)...");

// Gold-standard check: exhaustively BFS the whole reachable 2x2 state space from solved using
// the 9 generators and confirm the count matches the well-known pocket-cube figure 3,674,160.
// (Not attempted for 3x3: ~4.3x10^19 states is many orders of magnitude beyond exhaustive reach.)
{
  const t0 = Date.now();
  const startHash = hashCube(solvedCube(2));
  const visited = new Set<string>([startHash]);
  let frontier = [solvedCube(2)];
  let depth = 0;
  while (frontier.length > 0) {
    const nextFrontier: typeof frontier = [];
    for (const state of frontier) {
      for (const m of MOVES_2X2) {
        const child = applyMove(state, m);
        const h = hashCube(child);
        if (!visited.has(h)) {
          visited.add(h);
          nextFrontier.push(child);
        }
      }
    }
    frontier = nextFrontier;
    depth++;
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`exhaustive BFS reached ${visited.size} states in ${depth - 1} layers (${elapsed}s)`);
  assert(visited.size === 3_674_160, `total reachable 2x2 states === 3,674,160 (got ${visited.size})`);
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll cube tests passed, including exhaustive 2x2 state-space verification.");
}
