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

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll maze tests passed.");
}
