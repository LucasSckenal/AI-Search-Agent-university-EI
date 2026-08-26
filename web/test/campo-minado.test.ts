import {
  BoardConfig,
  buildFrontier,
  centerIndex,
  combineComponents,
  computeProbabilities,
  DIFFICULTY_CONFIG,
  enumerateComponent,
  floodReveal,
  Instance,
  isWon,
  logicaSteps,
  makeShell,
  neighborsOf,
  placeMines,
  probabilidadeSteps,
  remainingMines,
  toggleFlag,
} from "../src/lib/campo-minado/model";
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
function close(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) <= eps;
}
function countTrue(arr: boolean[]): number {
  return arr.reduce((n, v) => n + (v ? 1 : 0), 0);
}
function freshInstance(board: BoardConfig, seed: number): Instance {
  return placeMines(makeShell(board), centerIndex(board), seededRng(seed));
}
function lastStep<T>(arr: T[]): T {
  return arr[arr.length - 1];
}

// --- neighborsOf ---
{
  const board: BoardConfig = { width: 5, height: 5, mineCount: 1 };
  assert(neighborsOf(board, 0).length === 3, "corner cell has 3 neighbors");
  assert(neighborsOf(board, 2).length === 5, "top-edge cell has 5 neighbors");
  assert(neighborsOf(board, 12).length === 8, "interior cell has 8 neighbors");
  assert(!neighborsOf(board, 12).includes(12), "neighborsOf never includes the cell itself");
}

// --- placeMines ---
{
  for (const seed of [1, 2, 3]) {
    for (const diff of ["iniciante", "intermediario", "avancado"] as const) {
      const board = DIFFICULTY_CONFIG[diff];
      const safe = centerIndex(board);
      const instance = placeMines(makeShell(board), safe, seededRng(seed));
      const mineCount = countTrue(instance.mines);
      assert(mineCount === board.mineCount, `seed ${seed}/${diff}: exact mine count (got ${mineCount}, want ${board.mineCount})`);
      const excluded = new Set([safe, ...neighborsOf(board, safe)]);
      let safeZoneClean = true;
      for (const i of excluded) if (instance.mines[i]) safeZoneClean = false;
      assert(safeZoneClean, `seed ${seed}/${diff}: safe zone (clicked cell + neighbors) never mined`);

      let adjacentOk = true;
      for (let i = 0; i < instance.mines.length; i++) {
        if (instance.mines[i]) continue;
        const recomputed = neighborsOf(board, i).filter((nb) => instance.mines[nb]).length;
        if (recomputed !== instance.adjacent[i]) adjacentOk = false;
      }
      assert(adjacentOk, `seed ${seed}/${diff}: adjacent counts match independent recomputation from mines`);
    }
  }
  const board = DIFFICULTY_CONFIG.iniciante;
  const a = placeMines(makeShell(board), centerIndex(board), seededRng(42));
  const b = placeMines(makeShell(board), centerIndex(board), seededRng(42));
  assert(JSON.stringify(a.mines) === JSON.stringify(b.mines), "placeMines is deterministic for a fixed seed");
}

// --- floodReveal ---
{
  // 3x3, mine only at the far corner (8), everything else has adjacent<=1 so a click at 0 should
  // cascade through the zero-region and stop at the numbered border next to the mine.
  const board: BoardConfig = { width: 3, height: 3, mineCount: 1 };
  const instance: Instance = { board, mines: [false, false, false, false, false, false, false, false, true], adjacent: [0, 0, 0, 0, 1, 1, 0, 1, 0], minesPlaced: true };
  const revealed = new Array(9).fill(false);
  const flagged = new Array(9).fill(false);
  const { revealed: afterReveal, exploded } = floodReveal(instance, revealed, flagged, 0);
  assert(!exploded, "revealing a zero cell away from the mine does not explode");
  assert(afterReveal[0] && afterReveal[1] && afterReveal[3], "zero-region cascades to its zero neighbors");
  assert(afterReveal[4] && afterReveal[5] && afterReveal[7], "cascade reveals the numbered cells bordering the zero-region");
  assert(!afterReveal[8], "cascade does not reveal the mine itself");

  const mineHit = floodReveal(instance, revealed, flagged, 8);
  assert(mineHit.exploded, "revealing the mine cell directly explodes");
  assert(mineHit.revealed[8] && !mineHit.revealed[0], "exploding does not cascade to other cells");

  const flaggedState = new Array(9).fill(false);
  flaggedState[0] = true;
  const noopFlagged = floodReveal(instance, revealed, flaggedState, 0);
  assert(!noopFlagged.revealed[0], "revealing a flagged cell is a no-op");
  const alreadyRevealed = revealed.slice();
  alreadyRevealed[4] = true;
  const noopRevealed = floodReveal(instance, alreadyRevealed, flagged, 4);
  assert(JSON.stringify(noopRevealed.revealed) === JSON.stringify(alreadyRevealed), "revealing an already-revealed cell is a no-op");
}

// --- toggleFlag / isWon ---
{
  const board: BoardConfig = { width: 2, height: 2, mineCount: 1 };
  const instance: Instance = { board, mines: [true, false, false, false], adjacent: [0, 1, 1, 1], minesPlaced: true };
  const revealed = [false, false, false, false];
  let flagged = [false, false, false, false];
  flagged = toggleFlag(flagged, revealed, 1);
  assert(flagged[1], "toggleFlag flags an unrevealed cell");
  flagged = toggleFlag(flagged, revealed, 1);
  assert(!flagged[1], "toggleFlag un-flags a flagged cell");
  const revealedState = [false, true, false, false];
  const noop = toggleFlag([false, false, false, false], revealedState, 1);
  assert(!noop[1], "toggleFlag is a no-op on an already-revealed cell");

  assert(isWon(instance, [false, true, true, true]), "won once all non-mine cells are revealed, mine cell untouched");
  assert(!isWon(instance, [false, true, true, false]), "not won while any non-mine cell remains hidden");
}

// --- logicaSteps: solves what it can, never explodes ---
{
  for (const seed of [1, 2, 3, 4, 5]) {
    const board = DIFFICULTY_CONFIG.iniciante;
    const instance = freshInstance(board, seed);
    const start = floodReveal(instance, new Array(board.width * board.height).fill(false), new Array(board.width * board.height).fill(false), centerIndex(board));
    const steps = logicaSteps(instance, start.revealed, new Array(board.width * board.height).fill(false));
    const final = lastStep(steps);
    assert(final.action === "solved" || final.action === "stuck", `seed ${seed}: logicaSteps ends in solved or stuck (got ${final.action})`);
    assert(!steps.some((s) => s.action === "exploded"), `seed ${seed}: logicaSteps never explodes`);
  }
}
{
  // Minimal hand-built ambiguous pattern: a 1x3 row, cell 1 revealed as "1" with hidden neighbors
  // {0,2} and only 1 mine between them - single-point can't fire (need=1 != hidden.length=2, need!=0)
  // and there's no second constraint for the subset rule to compare against. Must stall.
  const board: BoardConfig = { width: 3, height: 1, mineCount: 1 };
  const instance: Instance = { board, mines: [true, false, false], adjacent: [0, 1, 0], minesPlaced: true };
  const revealed = [false, true, false];
  const flagged = [false, false, false];
  const steps = logicaSteps(instance, revealed, flagged);
  const final = lastStep(steps);
  assert(final.action === "stuck", `genuinely ambiguous 1-cell pattern stalls logicaSteps (got ${final.action})`);
  assert(final.cellsRevealed === 1, "stalled state reveals no further cells beyond the initial one");
}

// --- probabilidadeSteps: always continues, never stalls ---
{
  let sawGuess = false;
  for (let seed = 1; seed <= 30; seed++) {
    const board = DIFFICULTY_CONFIG.iniciante;
    const instance = freshInstance(board, seed);
    const start = floodReveal(instance, new Array(board.width * board.height).fill(false), new Array(board.width * board.height).fill(false), centerIndex(board));
    const steps = probabilidadeSteps(instance, start.revealed, new Array(board.width * board.height).fill(false));
    const final = lastStep(steps);
    assert(final.action === "solved" || final.action === "exploded", `seed ${seed}: probabilidadeSteps never stalls (got ${final.action})`);
    if (final.action === "exploded") {
      const prior = steps[steps.length - 2];
      assert(prior.action === "guess" && typeof prior.guessProbability === "number", `seed ${seed}: the step right before an explosion is a guess carrying a probability`);
    }
    if (steps.some((s) => s.action === "guess")) sawGuess = true;
  }
  assert(sawGuess, "at least one of the 30 seeds actually required a probability-based guess (exercises the guess path)");
}

// --- structural invariant: probability solver reveals at least as much as pure logic ---
{
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const board = DIFFICULTY_CONFIG.iniciante;
    const emptyRevealed = new Array(board.width * board.height).fill(false);
    const emptyFlagged = new Array(board.width * board.height).fill(false);

    const instanceA = freshInstance(board, seed);
    const startA = floodReveal(instanceA, emptyRevealed, emptyFlagged, centerIndex(board));
    const logica = lastStep(logicaSteps(instanceA, startA.revealed, emptyFlagged));

    const instanceB = freshInstance(board, seed);
    const startB = floodReveal(instanceB, emptyRevealed, emptyFlagged, centerIndex(board));
    const prob = lastStep(probabilidadeSteps(instanceB, startB.revealed, emptyFlagged));

    assert(prob.cellsRevealed >= logica.cellsRevealed, `seed ${seed}: probabilidade reveals >= logica (${prob.cellsRevealed} vs ${logica.cellsRevealed})`);
  }
}

// --- combineComponents: hand-verified worked example ---
{
  // Component 1: cells {a=100,b=101}, constraint "exactly 1 mine among {a,b}".
  // Valid assignments: {a} (count 1), {b} (count 1) -> hist = {1: 2 ways}.
  const comp1 = {
    cellsHist: new Map([
      [100, new Map([[1, 1]])],
      [101, new Map([[1, 1]])],
    ]),
    totalHist: new Map([[1, 2]]),
  };
  // Component 2: cells {c=200,d=201,e=202}, constraints "exactly 1 among {c,d}" and "exactly 1 among
  // {d,e}". Valid assignments: {d} (count 1), {c,e} (count 2) -> hist = {1: 1, 2: 1}.
  const comp2 = {
    cellsHist: new Map([
      [200, new Map([[2, 1]])], // c is a mine only in {c,e} (count 2)
      [201, new Map([[1, 1]])], // d is a mine only in {d} (count 1)
      [202, new Map([[2, 1]])], // e is a mine only in {c,e} (count 2)
    ]),
    totalHist: new Map([
      [1, 1],
      [2, 1],
    ]),
  };
  const { probabilities, freeProbability, expectedFrontierMines } = combineComponents([comp1, comp2], 2, 3);
  assert(close(probabilities.get(100)!, 0.5), `hand-verified: P(a) = 0.5 (got ${probabilities.get(100)})`);
  assert(close(probabilities.get(101)!, 0.5), `hand-verified: P(b) = 0.5 (got ${probabilities.get(101)})`);
  assert(close(probabilities.get(200)!, 1 / 3), `hand-verified: P(c) = 1/3 (got ${probabilities.get(200)})`);
  assert(close(probabilities.get(201)!, 2 / 3), `hand-verified: P(d) = 2/3 (got ${probabilities.get(201)})`);
  assert(close(probabilities.get(202)!, 1 / 3), `hand-verified: P(e) = 1/3 (got ${probabilities.get(202)})`);
  assert(close(freeProbability, 1 / 3), `hand-verified: free-cell probability = 1/3 (got ${freeProbability})`);
  const total = expectedFrontierMines + 2 * freeProbability;
  assert(close(total, 3, 1e-9), `hand-verified: sum of all hidden-cell probabilities equals remaining mines (got ${total})`);
}

// --- enumerateComponent ---
{
  const component = { cells: [10, 11, 12], constraints: [{ source: 0, members: [10, 11, 12], remaining: 1 }] };
  const { assignments, approximated } = enumerateComponent(component);
  assert(!approximated, "a 3-cell component is well within the exact-enumeration cap");
  assert(assignments.length === 3, `"exactly 1 mine among 3 cells" has exactly 3 valid assignments (got ${assignments.length})`);
  assert(
    assignments.every((a) => a.count === 1),
    "every valid assignment for this constraint has exactly 1 mine"
  );
  const capped = enumerateComponent(component, 2);
  assert(capped.approximated, "forcing a cap smaller than the component size marks it approximated");
  assert(capped.assignments.length === 0, "an approximated component returns no enumerated assignments");
}

// --- fuzzed master invariant: probabilities always sum to remaining mines ---
{
  let checked = 0;
  for (let seed = 1; seed <= 15; seed++) {
    const board = DIFFICULTY_CONFIG.iniciante;
    const instance = freshInstance(board, seed);
    const emptyRevealed = new Array(board.width * board.height).fill(false);
    const emptyFlagged = new Array(board.width * board.height).fill(false);
    const start = floodReveal(instance, emptyRevealed, emptyFlagged, centerIndex(board));

    // Snapshot a handful of mid-game states by partially running the pure-logic solver.
    const trace = logicaSteps(instance, start.revealed, emptyFlagged);
    for (const step of [trace[0], trace[Math.floor(trace.length / 2)], lastStep(trace)]) {
      if (step.action === "solved") continue; // no hidden cells left, nothing to check
      const { probabilities, approximatedComponents } = computeProbabilities(instance, step.revealed, step.flagged);
      if (approximatedComponents > 0) continue; // fallback path is a documented approximation, skip exactness check
      let sum = 0;
      let inRange = true;
      for (const p of probabilities.values()) {
        sum += p;
        if (p < -1e-9 || p > 1 + 1e-9) inRange = false;
      }
      // Free cells share one probability value but each contributes individually to the true sum;
      // computeProbabilities already stores one entry per free cell (not one shared entry), so summing
      // every map value directly is correct here.
      const remaining = remainingMines(instance, step.flagged);
      assert(inRange, `seed ${seed}: every computed probability stays within [0,1]`);
      assert(close(sum, remaining, 1e-6), `seed ${seed}: sum of all hidden-cell probabilities equals remaining mines (got ${sum}, want ${remaining})`);
      checked++;
    }
  }
  assert(checked > 0, "the fuzzed invariant actually ran against at least one non-trivial board state");
}

// --- buildFrontier sanity ---
{
  const board = DIFFICULTY_CONFIG.iniciante;
  const instance = freshInstance(board, 7);
  const emptyRevealed = new Array(board.width * board.height).fill(false);
  const emptyFlagged = new Array(board.width * board.height).fill(false);
  const start = floodReveal(instance, emptyRevealed, emptyFlagged, centerIndex(board));
  const { components, freeCells } = buildFrontier(instance, start.revealed, emptyFlagged);
  const frontierCells = new Set(components.flatMap((c) => c.cells));
  const overlap = freeCells.some((c) => frontierCells.has(c));
  assert(!overlap, "free cells and frontier cells are disjoint");
  const totalHidden = countTrue(start.revealed.map((r) => !r));
  assert(frontierCells.size + freeCells.length === totalHidden, "every hidden cell is accounted for as either frontier or free");
}

// --- termination smoke test on the largest board ---
{
  for (const seed of [1, 2]) {
    const board = DIFFICULTY_CONFIG.avancado;
    const instance = freshInstance(board, seed);
    const emptyRevealed = new Array(board.width * board.height).fill(false);
    const emptyFlagged = new Array(board.width * board.height).fill(false);
    const start = floodReveal(instance, emptyRevealed, emptyFlagged, centerIndex(board));
    const logica = logicaSteps(instance, start.revealed, emptyFlagged, 3000);
    const prob = probabilidadeSteps(instance, start.revealed, emptyFlagged, 3000);
    assert(logica.length < 3000, `seed ${seed}: logicaSteps terminates under the step guard on avancado`);
    assert(prob.length < 3000, `seed ${seed}: probabilidadeSteps terminates under the step guard on avancado`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll Campo Minado tests passed.");
}
