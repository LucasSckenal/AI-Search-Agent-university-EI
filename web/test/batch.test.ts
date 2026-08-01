import { seededRng } from "../src/lib/core/rng";
import { summarizeBatch } from "../src/lib/core/batch";
import { SearchResult } from "../src/lib/core/search";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

// seededRng: the same seed must reproduce the exact same sequence (that's the whole point - a
// seed cited in a report has to regenerate the same maze/scramble later).
{
  const a = seededRng(42);
  const b = seededRng(42);
  const seqA = Array.from({ length: 10 }, () => a());
  const seqB = Array.from({ length: 10 }, () => b());
  assert(JSON.stringify(seqA) === JSON.stringify(seqB), "seededRng(42) produces the same sequence twice");

  const c = seededRng(43);
  const seqC = Array.from({ length: 10 }, () => c());
  assert(JSON.stringify(seqA) !== JSON.stringify(seqC), "different seeds produce different sequences");

  assert(seqA.every((v) => v >= 0 && v < 1), "seededRng values stay within [0, 1)");
}

// summarizeBatch: build a small set of fake SearchResults by hand and check the aggregate
// statistics match a hand-computed answer, plus that a failed run still counts toward
// nodesExpanded/timeMs stats (searched, just didn't find a goal) but not toward cost/b*.
function fakeResult(found: boolean, cost: number, nodesExpanded: number, nodesGenerated: number, actionsLength: number): SearchResult<number, string> {
  return {
    algorithm: "astar",
    found,
    path: [],
    actions: new Array(actionsLength).fill("x"),
    cost,
    nodesExpanded,
    nodesGenerated,
    maxFrontierSize: 0,
    timeMs: nodesExpanded / 10,
    exploredOrder: [],
    truncated: false,
  };
}

{
  const results = [
    fakeResult(true, 4, 10, 20, 4),
    fakeResult(true, 4, 20, 40, 4),
    fakeResult(false, 0, 300_000, 300_001, 0), // hit the safety cap, no solution found
  ];
  const summary = summarizeBatch("astar", results);
  assert(summary.trials === 3, "trials counts every run, including failures");
  assert(summary.successes === 2, "successes only counts found runs");
  assert(Math.abs(summary.successRate - 2 / 3) < 1e-9, `successRate is successes/trials (got ${summary.successRate})`);
  assert(summary.cost !== null && Math.abs(summary.cost.mean - 4) < 1e-9, "cost mean only averages successful runs");
  assert(
    summary.nodesExpanded !== null && Math.abs(summary.nodesExpanded.mean - (10 + 20 + 300_000) / 3) < 1e-6,
    "nodesExpanded mean includes failed runs too (search effort was still spent)"
  );
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll rng/batch tests passed.");
}
