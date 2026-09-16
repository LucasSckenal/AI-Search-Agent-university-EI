import { search, SearchProblem, AlgorithmId } from "../src/lib/core/search";
import { traceSearch } from "../src/lib/core/search-trace";
import { buildMazeProblem, generatePerfectMaze } from "../src/lib/maze/model";
import { seededRng } from "../src/lib/core/rng";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

function drain<S, A>(problem: SearchProblem<S, A>, algorithm: AlgorithmId) {
  const iterator = traceSearch(problem, algorithm);
  const steps = [];
  let next = iterator.next();
  while (!next.done) {
    steps.push(next.value);
    next = iterator.next();
  }
  return { steps, result: next.value };
}

const ALGOS: AlgorithmId[] = ["bfs", "dfs", "ucs", "greedy", "astar"];

// Same tiny 1D line problem test/core.test.ts already uses for search() itself.
type S = number;
const lineProblem: SearchProblem<S, string> = {
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

const maze = generatePerfectMaze(9, 9, seededRng(42));
const mazeProblem = buildMazeProblem(maze, { allowDiagonal: false, heuristic: "manhattan" });

for (const [label, problem] of [
  ["line", lineProblem],
  ["maze", mazeProblem],
] as const) {
  for (const algo of ALGOS) {
    const real = search(problem, algo);
    const { steps, result } = drain(problem, algo);

    assert(result.found === real.found, `${label}/${algo}: found matches (${result.found} vs ${real.found})`);
    if (real.found) {
      assert(
        JSON.stringify(result.path) === JSON.stringify(real.path),
        `${label}/${algo}: path matches search()'s`
      );
      assert(Math.abs(result.cost - real.cost) < 1e-9, `${label}/${algo}: cost matches (${result.cost} vs ${real.cost})`);
      assert(
        result.nodesExpanded === real.nodesExpanded,
        `${label}/${algo}: nodesExpanded matches search()'s exactly (${result.nodesExpanded} vs ${real.nodesExpanded})`
      );
    }

    // Per-step invariants, regardless of algorithm.
    let monotonic = true;
    let fConsistent = true;
    let frontierSorted = true;
    let lastVisited = 0;
    for (const step of steps) {
      if (Math.abs(step.f - (step.g + step.h)) > 1e-9) fConsistent = false;
      if (step.visitedCount < lastVisited) monotonic = false;
      lastVisited = step.visitedCount;
      for (let i = 1; i < step.frontier.length; i++) {
        const a = step.frontier[i - 1];
        const b = step.frontier[i];
        const key = step.basis === "g" ? "g" : step.basis === "h" ? "h" : "f";
        // fifo/lifo frontiers are arrival-ordered, not sorted by any number - skip those.
        if ((step.basis === "g" || step.basis === "h" || step.basis === "f") && a[key] > b[key] + 1e-9) {
          frontierSorted = false;
        }
      }
    }
    assert(fConsistent, `${label}/${algo}: every step has f === g + h`);
    assert(monotonic, `${label}/${algo}: visitedCount never decreases`);
    assert(frontierSorted, `${label}/${algo}: frontier sorted by ${label === "line" ? "basis" : "basis"} where applicable`);
    assert(
      steps.length === 0 || steps[steps.length - 1].isGoal === real.found,
      `${label}/${algo}: last step's isGoal matches whether the goal was found`
    );
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll search-trace tests passed.");
}
