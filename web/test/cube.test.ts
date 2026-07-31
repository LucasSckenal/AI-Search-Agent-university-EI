import {
  solvedCube,
  applyMove,
  applyMoves,
  isSolved,
  hashCube,
  generateScramble,
  INVERSE_MOVE,
  ALL_MOVES,
  MoveId,
  buildCubeProblem,
} from "../src/lib/cube/model";
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

// 1. Quarter turns have order 4; half turns have order 2.
for (const base of ["U", "R", "F"] as const) {
  let c = solvedCube();
  for (let i = 0; i < 4; i++) c = applyMove(c, base as MoveId);
  assert(isSolved(c), `${base}^4 = identity`);

  let c2 = solvedCube();
  c2 = applyMove(applyMove(c2, (base + "2") as MoveId), (base + "2") as MoveId);
  assert(isSolved(c2), `${base}2 applied twice = identity`);
}

// 2. Every move composed with its recorded inverse returns to solved.
for (const m of ALL_MOVES) {
  const c = applyMove(applyMove(solvedCube(), m), INVERSE_MOVE[m]);
  assert(isSolved(c), `${m} followed by ${INVERSE_MOVE[m]} = identity`);
}

// 3. A random scramble, undone move-by-move in reverse with each inverse, returns to solved.
const scramble = generateScramble(20, seeded(1));
const scrambled = applyMoves(solvedCube(), scramble);
assert(!isSolved(scrambled), "20-move scramble leaves the cube unsolved");
const undone = applyMoves(
  scrambled,
  [...scramble].reverse().map((m) => INVERSE_MOVE[m])
);
assert(isSolved(undone), "undoing a scramble move-by-move returns to solved");

// 4. Classic commutator sanity check: applying it 6 times returns to solved (order-6 identity,
//    true for any correctly-implemented quarter-turn cube group, independent of sign convention).
{
  const seq: MoveId[] = ["R", "U", "R'", "U'"];
  let c = solvedCube();
  for (let rep = 0; rep < 6; rep++) c = applyMoves(c, seq);
  assert(isSolved(c), "(R U R' U')^6 = identity");
}

// 5. Shallow scrambles are solvable by search, and the found solution actually solves the cube.
for (const depth of [1, 2, 3, 4]) {
  const sc = generateScramble(depth, seeded(100 + depth));
  const start = applyMoves(solvedCube(), sc);
  const problem = buildCubeProblem(start);
  const res = search(problem, "astar", { maxNodes: 400_000 });
  assert(res.found, `astar solves a depth-${depth} scramble`);
  if (res.found) {
    const finalState = applyMoves(start, res.actions as MoveId[]);
    assert(isSolved(finalState), `astar's move sequence for depth-${depth} actually solves the cube`);
    assert(res.actions.length <= depth, `astar solution length (${res.actions.length}) <= scramble depth (${depth})`);
  }
}

// 6. BFS and A* agree on optimal solution length for a shallow scramble (both are optimal).
{
  const sc = generateScramble(4, seeded(55));
  const start = applyMoves(solvedCube(), sc);
  const bfs = search(buildCubeProblem(start), "bfs", { maxNodes: 2_000_000 });
  const astar = search(buildCubeProblem(start), "astar", { maxNodes: 2_000_000 });
  assert(bfs.found && astar.found, "bfs and astar both solve depth-4 scramble");
  assert(bfs.cost === astar.cost, `bfs cost (${bfs.cost}) === astar cost (${astar.cost})`);
  assert(astar.nodesExpanded <= bfs.nodesExpanded, `astar expands <= bfs nodes (${astar.nodesExpanded} vs ${bfs.nodesExpanded})`);
}

if (failures > 0) {
  console.error(`\n${failures} failure(s) in fast tests - skipping exhaustive state-count test`);
  process.exit(1);
}
console.log("\nAll fast cube tests passed. Running exhaustive state-space BFS (this may take a bit)...");

// 7. Gold-standard check: exhaustively BFS the whole reachable state space from solved using the
//    9 generators and confirm the count matches the well-known pocket-cube figure 3,674,160.
{
  const t0 = Date.now();
  const startHash = hashCube(solvedCube());
  const visited = new Set<string>([startHash]);
  let frontier = [solvedCube()];
  let depth = 0;
  while (frontier.length > 0) {
    const nextFrontier: typeof frontier = [];
    for (const state of frontier) {
      for (const m of ALL_MOVES) {
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
  assert(visited.size === 3_674_160, `total reachable states === 3,674,160 (got ${visited.size})`);
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll cube tests passed, including exhaustive state-space verification.");
}
