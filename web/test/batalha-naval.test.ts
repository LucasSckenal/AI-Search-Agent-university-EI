import {
  BOARD_SIZE,
  buildHeatmap,
  cellIndex,
  CellState,
  colOf,
  detectSunkRun,
  emptyShots,
  enumeratePlacements,
  FLEET,
  fireAt,
  generateFleet,
  heuristicoSteps,
  isFleetSunk,
  nextHuntCell,
  orthogonalNeighbors,
  pickBestCell,
  probabilisticoSteps,
  rowOf,
  shipCells,
  shotsFiredCount,
} from "../src/lib/batalha-naval/model";
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
function lastStep<T>(arr: T[]): T {
  return arr[arr.length - 1];
}
function sameSet(a: number[], b: number[]): boolean {
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
}

// --- cellIndex / rowOf / colOf / orthogonalNeighbors ---
{
  assert(orthogonalNeighbors(BOARD_SIZE, 0).length === 2, "corner cell has 2 orthogonal neighbors");
  assert(orthogonalNeighbors(BOARD_SIZE, 5).length === 3, "top-edge cell has 3 orthogonal neighbors");
  assert(orthogonalNeighbors(BOARD_SIZE, 55).length === 4, "interior cell has 4 orthogonal neighbors");
  assert(!orthogonalNeighbors(BOARD_SIZE, 55).includes(55), "orthogonalNeighbors never includes the cell itself");
  assert(rowOf(BOARD_SIZE, cellIndex(BOARD_SIZE, 3, 7)) === 3 && colOf(BOARD_SIZE, cellIndex(BOARD_SIZE, 3, 7)) === 7, "cellIndex/rowOf/colOf round-trip");
}

// --- generateFleet ---
{
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
    const instance = generateFleet(BOARD_SIZE, FLEET, seededRng(seed));
    const totalCells = instance.occupied.filter(Boolean).length;
    assert(totalCells === 17, `seed ${seed}: fleet occupies exactly 17 cells (got ${totalCells})`);

    for (const ship of FLEET) {
      const cells = shipCells(instance, ship.id);
      assert(cells.length === ship.length, `seed ${seed}: ${ship.name} has ${ship.length} cells`);
      const rows = new Set(cells.map((c) => rowOf(BOARD_SIZE, c)));
      const cols = new Set(cells.map((c) => colOf(BOARD_SIZE, c)));
      assert(
        (rows.size === 1 && cols.size === ship.length) || (cols.size === 1 && rows.size === ship.length),
        `seed ${seed}: ${ship.name} forms a straight contiguous line`
      );
      if (rows.size === 1) {
        const sortedCols = cells.map((c) => colOf(BOARD_SIZE, c)).sort((a, b) => a - b);
        for (let i = 1; i < sortedCols.length; i++) assert(sortedCols[i] === sortedCols[i - 1] + 1, `seed ${seed}: ${ship.name} columns are consecutive`);
      } else {
        const sortedRows = cells.map((c) => rowOf(BOARD_SIZE, c)).sort((a, b) => a - b);
        for (let i = 1; i < sortedRows.length; i++) assert(sortedRows[i] === sortedRows[i - 1] + 1, `seed ${seed}: ${ship.name} rows are consecutive`);
      }
    }

    // sem sobreposição: cada célula ocupada pertence a exatamente um navio
    for (let i = 0; i < instance.occupied.length; i++) {
      if (instance.occupied[i]) assert(instance.cellShip[i] !== null, `seed ${seed}: occupied cell ${i} maps to a shipId`);
    }

    const again = generateFleet(BOARD_SIZE, FLEET, seededRng(seed));
    assert(JSON.stringify(instance.placements) === JSON.stringify(again.placements), `seed ${seed}: generateFleet is deterministic for a fixed seed`);
  }
}

// --- fireAt ---
{
  const instance = generateFleet(BOARD_SIZE, FLEET, seededRng(42));
  let shots = emptyShots(BOARD_SIZE);
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
    const r = fireAt(instance, shots, i);
    assert(r.hit === instance.occupied[i], `fireAt(${i}) hit matches instance.occupied`);
    shots = r.shots;
  }
  assert(isFleetSunk(instance, shots) === true, "firing every cell sinks the whole fleet");

  // disparar célula já disparada é no-op
  const shots2 = emptyShots(BOARD_SIZE);
  const first = fireAt(instance, shots2, 17);
  const again = fireAt(instance, first.shots, 17);
  assert(again.hit === false && JSON.stringify(again.shots) === JSON.stringify(first.shots), "firing an already-shot cell is a no-op");

  // afundar um navio inteiro: só o último tiro dispara sunk:true
  const ship = instance.ships[0];
  const cells = shipCells(instance, ship.id);
  let s = emptyShots(BOARD_SIZE);
  for (let k = 0; k < cells.length - 1; k++) {
    const r = fireAt(instance, s, cells[k]);
    s = r.shots;
    assert(r.sunk === false, `firing ship cell ${k}/${cells.length} does not sink it yet`);
  }
  const finalShot = fireAt(instance, s, cells[cells.length - 1]);
  assert(finalShot.sunk === true && finalShot.shipId === ship.id, "the last cell of a ship sinks it with the right shipId");
}

// --- heuristicoSteps: sempre resolve, nunca dispara duas vezes ---
{
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
    const instance = generateFleet(BOARD_SIZE, FLEET, seededRng(seed));
    const steps = heuristicoSteps(instance);
    assert(lastStep(steps).action === "solved", `heuristicoSteps seed ${seed} ends in "solved"`);

    const fired = steps.filter((s) => s.action === "fire" || s.action === "sunk").map((s) => s.index as number);
    assert(new Set(fired).size === fired.length, `heuristicoSteps seed ${seed} never fires the same cell twice`);

    for (const step of steps) {
      if (step.action === "sunk" && step.shipId !== undefined && step.shipId !== null) {
        const cells = shipCells(instance, step.shipId);
        assert(cells.every((c) => step.shots[c] === "hit"), `heuristicoSteps seed ${seed}: "sunk" step's ship cells are all hit`);
      }
    }
    assert(steps.length < BOARD_SIZE * BOARD_SIZE + 10, `heuristicoSteps seed ${seed} terminates well under the maxSteps guard`);
  }
}

// --- probabilisticoSteps: sempre resolve, nunca dispara duas vezes ---
{
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
    const instance = generateFleet(BOARD_SIZE, FLEET, seededRng(seed));
    const steps = probabilisticoSteps(instance);
    assert(lastStep(steps).action === "solved", `probabilisticoSteps seed ${seed} ends in "solved"`);

    const fired = steps.filter((s) => s.action === "fire" || s.action === "sunk").map((s) => s.index as number);
    assert(new Set(fired).size === fired.length, `probabilisticoSteps seed ${seed} never fires the same cell twice`);
    assert(steps.length < BOARD_SIZE * BOARD_SIZE + 10, `probabilisticoSteps seed ${seed} terminates well under the maxSteps guard`);
  }
}

// --- invariante comparativo de eficiência: densidade gasta menos tiros, em média, que caça-e-alvo ---
{
  const seeds = Array.from({ length: 20 }, (_, i) => i + 100);
  let totalHeuristico = 0;
  let totalProbabilistico = 0;
  for (const seed of seeds) {
    const instance = generateFleet(BOARD_SIZE, FLEET, seededRng(seed));
    totalHeuristico += shotsFiredCount(lastStep(heuristicoSteps(instance)).shots);
    totalProbabilistico += shotsFiredCount(lastStep(probabilisticoSteps(instance)).shots);
  }
  const avgH = totalHeuristico / seeds.length;
  const avgP = totalProbabilistico / seeds.length;
  assert(avgP < avgH, `probabilistico usa menos tiros em média que heuristico (${avgP.toFixed(1)} vs ${avgH.toFixed(1)})`);
}

// --- exemplo verificado à mão #1: heatmap irrestrito ---
{
  const size = 4;
  const shots: CellState[] = new Array(16).fill("unknown");
  shots[0] = "miss";
  shots[15] = "miss";

  const placements = enumeratePlacements(size, 3, shots, new Set());
  const expected = [
    [1, 2, 3],
    [4, 5, 6],
    [5, 6, 7],
    [8, 9, 10],
    [9, 10, 11],
    [12, 13, 14],
    [4, 8, 12],
    [1, 5, 9],
    [5, 9, 13],
    [2, 6, 10],
    [6, 10, 14],
    [3, 7, 11],
  ];
  assert(placements.length === 12, `hand-verified #1: exactly 12 valid placements (got ${placements.length})`);
  assert(
    expected.every((exp) => placements.some((p) => sameSet(p, exp))),
    "hand-verified #1: every expected placement is present"
  );

  const { heatmap, restrictedToActiveHits } = buildHeatmap(size, [3], shots, new Set());
  assert(restrictedToActiveHits === false, "hand-verified #1: no active hits yet, heatmap is unrestricted");
  assert(JSON.stringify(heatmap) === JSON.stringify([0, 2, 2, 2, 2, 4, 4, 2, 2, 4, 4, 2, 2, 2, 2, 0]), `hand-verified #1: heatmap matches (got ${JSON.stringify(heatmap)})`);
  assert(pickBestCell(size, shots, heatmap) === 5, "hand-verified #1: pickBestCell chooses cell 5");
}

// --- exemplo verificado à mão #2: refinamento de mira ---
{
  const size = 4;
  const shots: CellState[] = new Array(16).fill("unknown");
  shots[0] = "miss";
  shots[15] = "miss";
  shots[6] = "hit";

  const { heatmap, restrictedToActiveHits, placementCount } = buildHeatmap(size, [3], shots, new Set());
  assert(restrictedToActiveHits === true, "hand-verified #2: an active hit exists, heatmap is restricted");
  assert(placementCount === 4, `hand-verified #2: exactly 4 placements cover the active hit (got ${placementCount})`);
  assert(JSON.stringify(heatmap) === JSON.stringify([0, 0, 1, 0, 1, 2, 4, 1, 0, 0, 2, 0, 0, 0, 1, 0]), `hand-verified #2: heatmap matches (got ${JSON.stringify(heatmap)})`);
  assert(pickBestCell(size, shots, heatmap) === 5, "hand-verified #2: pickBestCell chooses cell 5, not the already-hit cell 6");
}

// --- detectSunkRun ---
{
  const size = 10;
  {
    const shots: CellState[] = new Array(100).fill("unknown");
    shots[3] = "miss";
    shots[7] = "miss";
    shots[4] = "hit";
    shots[5] = "hit";
    shots[6] = "hit";
    const run = detectSunkRun(size, shots, [4, 5, 6], [3, 2]);
    assert(!!run && run.length === 3 && sameSet(run.cells, [4, 5, 6]), "detectSunkRun: bounded run of 3 with length 3 in remaining is detected");
  }
  {
    const shots: CellState[] = new Array(100).fill("unknown");
    shots[4] = "hit";
    shots[5] = "hit";
    shots[6] = "hit";
    const run = detectSunkRun(size, shots, [4, 5, 6], [3, 2]);
    assert(run === null, "detectSunkRun: run without bounding misses/edges is not confirmed");
  }
  {
    const shots: CellState[] = new Array(100).fill("unknown");
    shots[3] = "miss";
    shots[7] = "miss";
    shots[4] = "hit";
    shots[5] = "hit";
    shots[6] = "hit";
    const run = detectSunkRun(size, shots, [4, 5, 6], [5, 4, 2]);
    assert(run === null, "detectSunkRun: bounded run whose length isn't in remaining is not confirmed");
  }
}

// --- nextHuntCell ---
{
  const size = 10;
  const empty = emptyShots(size);
  const first = nextHuntCell(size, empty);
  assert(first !== null && (rowOf(size, first) + colOf(size, first)) % 2 === 0, "nextHuntCell starts on parity 0");

  const parity0Fired = empty.slice();
  for (let i = 0; i < size * size; i++) {
    if ((rowOf(size, i) + colOf(size, i)) % 2 === 0) parity0Fired[i] = "miss";
  }
  const next = nextHuntCell(size, parity0Fired);
  assert(next !== null && (rowOf(size, next) + colOf(size, next)) % 2 === 1, "nextHuntCell falls back to parity 1 once parity 0 is exhausted");

  const allFired = new Array<CellState>(size * size).fill("miss");
  assert(nextHuntCell(size, allFired) === null, "nextHuntCell returns null once the whole board is fired");
}

if (failures > 0) {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
} else {
  console.log("\nAll batalha-naval tests passed.");
}
