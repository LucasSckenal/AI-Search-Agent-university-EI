import {
  solvedCube,
  applyMove,
  applyMoves,
  isSolved,
  hashCube,
  generateScramble,
  INVERSE_MOVE,
  MOVES_2X2,
  MOVES_3X3,
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

// ---------------------------------------------------------------------------
// 2x2 (exhaustively verified below - this is the size the app defaults to)
// ---------------------------------------------------------------------------

// 1. Quarter turns have order 4; half turns have order 2.
for (const base of ["U", "R", "F"] as const) {
  let c = solvedCube(2);
  for (let i = 0; i < 4; i++) c = applyMove(c, base as MoveId);
  assert(isSolved(c), `2x2: ${base}^4 = identity`);

  let c2 = solvedCube(2);
  c2 = applyMove(applyMove(c2, (base + "2") as MoveId), (base + "2") as MoveId);
  assert(isSolved(c2), `2x2: ${base}2 applied twice = identity`);
}

// 2. Every move composed with its recorded inverse returns to solved.
for (const m of MOVES_2X2) {
  const c = applyMove(applyMove(solvedCube(2), m), INVERSE_MOVE[m]);
  assert(isSolved(c), `2x2: ${m} followed by ${INVERSE_MOVE[m]} = identity`);
}

// 3. A random scramble, undone move-by-move in reverse with each inverse, returns to solved.
{
  const scramble = generateScramble(20, 2, seeded(1));
  const scrambled = applyMoves(solvedCube(2), scramble);
  assert(!isSolved(scrambled), "2x2: 20-move scramble leaves the cube unsolved");
  const undone = applyMoves(scrambled, [...scramble].reverse().map((m) => INVERSE_MOVE[m]));
  assert(isSolved(undone), "2x2: undoing a scramble move-by-move returns to solved");
}

// 4. Classic commutator sanity check: applying it 6 times returns to solved (order-6 identity,
//    a known fact about the real cube group, independent of any sign convention of ours).
{
  const seq: MoveId[] = ["R", "U", "R'", "U'"];
  let c = solvedCube(2);
  for (let rep = 0; rep < 6; rep++) c = applyMoves(c, seq);
  assert(isSolved(c), "2x2: (R U R' U')^6 = identity");
}

// 5. Shallow scrambles are solvable by search, and the found solution actually solves the cube.
for (const depth of [1, 2, 3, 4]) {
  const sc = generateScramble(depth, 2, seeded(100 + depth));
  const start = applyMoves(solvedCube(2), sc);
  const problem = buildCubeProblem(start, 2);
  const res = search(problem, "astar", { maxNodes: 400_000 });
  assert(res.found, `2x2: astar solves a depth-${depth} scramble`);
  if (res.found) {
    const finalState = applyMoves(start, res.actions as MoveId[]);
    assert(isSolved(finalState), `2x2: astar's move sequence for depth-${depth} actually solves the cube`);
    assert(res.actions.length <= depth, `2x2: astar solution length (${res.actions.length}) <= scramble depth (${depth})`);
  }
}

// 6. BFS and A* agree on optimal solution length for a shallow scramble (both are optimal).
{
  const sc = generateScramble(4, 2, seeded(55));
  const start = applyMoves(solvedCube(2), sc);
  const bfs = search(buildCubeProblem(start, 2), "bfs", { maxNodes: 2_000_000 });
  const astar = search(buildCubeProblem(start, 2), "astar", { maxNodes: 2_000_000 });
  assert(bfs.found && astar.found, "2x2: bfs and astar both solve depth-4 scramble");
  assert(bfs.cost === astar.cost, `2x2: bfs cost (${bfs.cost}) === astar cost (${astar.cost})`);
  assert(astar.nodesExpanded <= bfs.nodesExpanded, `2x2: astar expands <= bfs nodes (${astar.nodesExpanded} vs ${bfs.nodesExpanded})`);
}

// ---------------------------------------------------------------------------
// 3x3 (all 18 generators: U/D/L/R/F/B). Its state space (~4.3x10^19) makes an
// exhaustive BFS impossible, so this leans on the same group-theoretic sanity
// checks that passed for 2x2, plus solve-and-verify round trips, to build
// confidence in the *same* rotation math now exercised on edges and centers.
// ---------------------------------------------------------------------------

// 7. Quarter turns have order 4; half turns have order 2 - for all six faces.
for (const base of ["U", "D", "L", "R", "F", "B"] as const) {
  let c = solvedCube(3);
  for (let i = 0; i < 4; i++) c = applyMove(c, base as MoveId);
  assert(isSolved(c), `3x3: ${base}^4 = identity`);

  let c2 = solvedCube(3);
  c2 = applyMove(applyMove(c2, (base + "2") as MoveId), (base + "2") as MoveId);
  assert(isSolved(c2), `3x3: ${base}2 applied twice = identity`);
}

// 8. Every one of the 18 moves composed with its recorded inverse returns to solved.
for (const m of MOVES_3X3) {
  const c = applyMove(applyMove(solvedCube(3), m), INVERSE_MOVE[m]);
  assert(isSolved(c), `3x3: ${m} followed by ${INVERSE_MOVE[m]} = identity`);
}

// 9. Opposite faces commute (U D == D U) - only true if U and D were wired to independent
//    layers/signs correctly, since a bug swapping U's and D's layer would break this.
for (const [a, b] of [
  ["U", "D"],
  ["L", "R"],
  ["F", "B"],
] as const) {
  const c1 = applyMoves(solvedCube(3), [a, b] as MoveId[]);
  const c2 = applyMoves(solvedCube(3), [b, a] as MoveId[]);
  assert(hashCube(c1) === hashCube(c2), `3x3: ${a} and ${b} commute (opposite faces)`);
}

// 10. A random 3x3 scramble, undone move-by-move in reverse with each inverse, returns to solved.
{
  const scramble = generateScramble(20, 3, seeded(2));
  const scrambled = applyMoves(solvedCube(3), scramble);
  assert(!isSolved(scrambled), "3x3: 20-move scramble leaves the cube unsolved");
  const undone = applyMoves(scrambled, [...scramble].reverse().map((m) => INVERSE_MOVE[m]));
  assert(isSolved(undone), "3x3: undoing a scramble move-by-move returns to solved");
}

// 11. Same commutator identity as 2x2, now touching edges and a center too.
{
  const seq: MoveId[] = ["R", "U", "R'", "U'"];
  let c = solvedCube(3);
  for (let rep = 0; rep < 6; rep++) c = applyMoves(c, seq);
  assert(isSolved(c), "3x3: (R U R' U')^6 = identity");
}

// 12. Shallow 3x3 scrambles are solvable by A*, and the found solution actually solves the cube.
//     (BFS/UCS are intentionally not exercised here beyond depth 1: on a state space this large
//     they are expected to hit the app's maxNodes safety cutoff almost immediately past that -
//     that's the whole pedagogical point of offering 3x3 alongside 2x2, not a bug.)
for (const depth of [1, 2, 3]) {
  const sc = generateScramble(depth, 3, seeded(200 + depth));
  const start = applyMoves(solvedCube(3), sc);
  const problem = buildCubeProblem(start, 3);
  const res = search(problem, "astar", { maxNodes: 400_000 });
  assert(res.found, `3x3: astar solves a depth-${depth} scramble`);
  if (res.found) {
    const finalState = applyMoves(start, res.actions as MoveId[]);
    assert(isSolved(finalState), `3x3: astar's move sequence for depth-${depth} actually solves the cube`);
  }
}
{
  const sc = generateScramble(1, 3, seeded(9));
  const start = applyMoves(solvedCube(3), sc);
  const bfs = search(buildCubeProblem(start, 3), "bfs", { maxNodes: 2_000_000 });
  assert(bfs.found, "3x3: bfs still solves a depth-1 scramble");
  if (bfs.found) {
    assert(isSolved(applyMoves(start, bfs.actions as MoveId[])), "3x3: bfs's depth-1 solution actually solves the cube");
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s) in fast tests - skipping exhaustive 2x2 state-count test`);
  process.exit(1);
}
console.log("\nAll fast cube tests passed (2x2 and 3x3). Running exhaustive 2x2 state-space BFS (this may take a bit)...");

// 13. Gold-standard check: exhaustively BFS the whole reachable 2x2 state space from solved using
//     the 9 generators and confirm the count matches the well-known pocket-cube figure 3,674,160.
//     (Not attempted for 3x3: ~4.3x10^19 states is many orders of magnitude beyond exhaustive reach.)
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
