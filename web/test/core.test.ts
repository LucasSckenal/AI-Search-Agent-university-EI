import { search, SearchProblem } from "../src/lib/core/search";

// Tiny 1D line problem: states 0..10, goal = 10, to sanity-check all five algorithms.
type S = number;
const problem: SearchProblem<S, string> = {
  start: 0,
  isGoal: (s) => s === 10,
  neighbors: (s) => {
    const out: { state: S; action: string; cost: number }[] = [];
    if (s + 1 <= 10) out.push({ state: s + 1, action: "+1", cost: 1 });
    if (s + 3 <= 10) out.push({ state: s + 3, action: "+3", cost: 2 });
    return out;
  },
  heuristic: (s) => (10 - s) / 3,
  hash: (s) => String(s),
};

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

for (const algo of ["bfs", "dfs", "ucs", "greedy", "astar"] as const) {
  const res = search(problem, algo);
  assert(res.found, `${algo} finds goal`);
  assert(res.path[res.path.length - 1] === 10, `${algo} path ends at goal`);
  assert(res.path[0] === 0, `${algo} path starts at start`);
}

const ucs = search(problem, "ucs");
const astar = search(problem, "astar");
// Optimal path is 3+3+3+1 (cost 2+2+2+1=7): three cheap +3 moves plus one +1 to close the gap.
assert(ucs.cost === 7, `ucs optimal cost is 7 (got ${ucs.cost})`);
assert(astar.cost === 7, `astar optimal cost is 7 (got ${astar.cost})`);
assert(astar.nodesExpanded <= ucs.nodesExpanded, `astar expands <= ucs nodes (${astar.nodesExpanded} vs ${ucs.nodesExpanded})`);

// Unreachable goal must terminate and report not found.
const impossible: SearchProblem<S, string> = {
  ...problem,
  isGoal: (s) => s === 999,
};
const none = search(impossible, "bfs", { maxNodes: 1000 });
assert(!none.found, "unreachable goal returns found=false");

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll core search tests passed.");
}
