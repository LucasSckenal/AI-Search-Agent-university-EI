import { generatePerfectMaze, generateRandomMaze, buildMazeProblem } from "../src/lib/maze/model";
import { search } from "../src/lib/core/search";

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

const perfect = generatePerfectMaze(15, 15, seeded(42));
const problem = buildMazeProblem(perfect, { allowDiagonal: false, heuristic: "manhattan" });
const bfs = search(problem, "bfs");
const astar = search(problem, "astar");
assert(bfs.found, "perfect maze: bfs finds goal");
assert(astar.found, "perfect maze: astar finds goal");
assert(astar.cost <= bfs.cost + 1e-9, `astar cost (${astar.cost}) <= bfs cost (${bfs.cost})`);

const random = generateRandomMaze(20, 20, 0.25, seeded(7));
const rProblem = buildMazeProblem(random, { allowDiagonal: true, heuristic: "octile" });
const rAstar = search(rProblem, "astar");
assert(rAstar.found, "random maze (density 0.25) stays solvable and astar finds a path");

for (const algo of ["bfs", "dfs", "ucs", "greedy", "astar"] as const) {
  const r = search(problem, algo);
  assert(r.found, `${algo} solves the perfect maze`);
}

// Regression test for a real bug found while writing the heuristic-consistency proof: Manhattan
// distance overestimates cost once diagonal shortcuts exist (a diagonal step covers 2 units of
// Manhattan distance for only √2x the cost of 1 orthogonal step), which is inadmissible and can
// make A* return a worse-than-optimal path - confirmed empirically (A* lost to UCS in ~18.6% of
// 500 random-maze trials before the fix). labirinto/page.tsx now hides "Manhattan" from the
// heuristic picker whenever diagonal movement is on; this locks in that the heuristics still
// offered there (Euclidean, Chebyshev, Octile) all stay admissible+consistent with diagonal moves,
// by checking A* always matches UCS's heuristic-independent optimal cost across several instances.
for (const heuristic of ["euclidean", "chebyshev", "octile"] as const) {
  for (let seed = 1; seed <= 8; seed++) {
    const m = generateRandomMaze(12, 12, 0.25, seeded(seed * 1000));
    const diagProblem = buildMazeProblem(m, { allowDiagonal: true, heuristic });
    const ucsCost = search(diagProblem, "ucs").cost;
    const astarCost = search(diagProblem, "astar").cost;
    assert(
      astarCost <= ucsCost + 1e-6,
      `${heuristic} + diagonal: astar (${astarCost.toFixed(4)}) matches UCS optimum (${ucsCost.toFixed(4)}) [seed ${seed}]`
    );
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll maze tests passed.");
}
