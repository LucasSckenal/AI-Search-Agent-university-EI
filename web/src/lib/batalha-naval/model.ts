/**
 * Batalha Naval: um tabuleiro 10x10 esconde uma frota clássica de 5 navios. Dois algoritmos
 * clássicos de "resolver Batalha Naval sozinho" competem em eficiência de tiros (nunca em
 * sobrevivência - afundar a frota inteira é sempre garantido, não há como "perder"):
 *
 * - heuristicoSteps: Caça e Alvo - varre em paridade de tabuleiro de xadrez até acertar, depois
 *   isola e estende a linha do navio atingido. Simples, correto, mas reexamina paridade que já não
 *   pode mais esconder navio.
 * - probabilisticoSteps: Mapa de Densidade - enumera todos os posicionamentos válidos da frota
 *   restante a cada passo e dispara sempre na célula coberta por mais deles (restringindo a
 *   posicionamentos que tocam um acerto ainda não afundado, quando existe algum). Provadamente mais
 *   eficiente em tiros.
 */
export const BOARD_SIZE = 10;

export interface ShipDef {
  id: number;
  name: string;
  length: number;
}

export const FLEET: ShipDef[] = [
  { id: 0, name: "Porta-Aviões", length: 5 },
  { id: 1, name: "Encouraçado", length: 4 },
  { id: 2, name: "Cruzador", length: 3 },
  { id: 3, name: "Submarino", length: 3 },
  { id: 4, name: "Contratorpedeiro", length: 2 },
];

export type Orientation = "H" | "V";

export interface Placement {
  shipId: number;
  row: number;
  col: number;
  orientation: Orientation;
  cells: number[];
}

export interface Instance {
  size: number;
  ships: ShipDef[];
  placements: Placement[];
  occupied: boolean[];
  cellShip: (number | null)[];
}

export function cellIndex(size: number, row: number, col: number): number {
  return row * size + col;
}

export function rowOf(size: number, i: number): number {
  return Math.floor(i / size);
}

export function colOf(size: number, i: number): number {
  return i % size;
}

export function orthogonalNeighbors(size: number, i: number): number[] {
  const row = rowOf(size, i);
  const col = colOf(size, i);
  const out: number[] = [];
  if (row > 0) out.push(cellIndex(size, row - 1, col));
  if (row < size - 1) out.push(cellIndex(size, row + 1, col));
  if (col > 0) out.push(cellIndex(size, row, col - 1));
  if (col < size - 1) out.push(cellIndex(size, row, col + 1));
  return out;
}

function placementCells(size: number, row: number, col: number, orientation: Orientation, length: number): number[] | null {
  const cells: number[] = [];
  for (let k = 0; k < length; k++) {
    const r = orientation === "V" ? row + k : row;
    const c = orientation === "H" ? col + k : col;
    if (r >= size || c >= size) return null;
    cells.push(cellIndex(size, r, c));
  }
  return cells;
}

function tryPlaceShip(size: number, length: number, occupied: boolean[], rng: () => number): { row: number; col: number; orientation: Orientation; cells: number[] } | null {
  const orientation: Orientation = rng() < 0.5 ? "H" : "V";
  const maxRow = orientation === "V" ? size - length : size - 1;
  const maxCol = orientation === "H" ? size - length : size - 1;
  if (maxRow < 0 || maxCol < 0) return null;
  const row = Math.floor(rng() * (maxRow + 1));
  const col = Math.floor(rng() * (maxCol + 1));
  const cells = placementCells(size, row, col, orientation, length);
  if (!cells) return null;
  if (cells.some((c) => occupied[c])) return null;
  return { row, col, orientation, cells };
}

/**
 * Coloca cada navio da frota em posição/orientação aleatórias, sem sobrepor (navios podem se tocar -
 * regra clássica real, não a variante "sem toque"). Se um navio não encontra posição livre depois de
 * muitas tentativas, reinicia a colocação inteira do zero (nunca trunca no meio com uma frota
 * incompleta) - mesmo espírito do Campo Minado.
 */
export function generateFleet(size: number, ships: ShipDef[], rng: () => number, maxAttempts = 500): Instance {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const occupied = new Array<boolean>(size * size).fill(false);
    const cellShip = new Array<number | null>(size * size).fill(null);
    const placements: Placement[] = [];
    let ok = true;
    for (const ship of ships) {
      let placed: { row: number; col: number; orientation: Orientation; cells: number[] } | null = null;
      for (let tries = 0; tries < 200; tries++) {
        placed = tryPlaceShip(size, ship.length, occupied, rng);
        if (placed) break;
      }
      if (!placed) {
        ok = false;
        break;
      }
      for (const c of placed.cells) {
        occupied[c] = true;
        cellShip[c] = ship.id;
      }
      placements.push({ shipId: ship.id, row: placed.row, col: placed.col, orientation: placed.orientation, cells: placed.cells });
    }
    if (ok) return { size, ships, placements, occupied, cellShip };
  }
  throw new Error("generateFleet: não foi possível posicionar a frota");
}

export function shipCells(instance: Instance, shipId: number): number[] {
  const placement = instance.placements.find((p) => p.shipId === shipId);
  return placement ? placement.cells : [];
}

export type CellState = "unknown" | "hit" | "miss";

export function emptyShots(size: number): CellState[] {
  return new Array<CellState>(size * size).fill("unknown");
}

/** No-op (mesmo shots) se a célula já foi disparada. `sunk`/`shipId` são verdade de tabuleiro -
 * legítimo, Batalha Naval real sempre anuncia quando um navio afunda. */
export function fireAt(instance: Instance, shots: CellState[], idx: number): { shots: CellState[]; hit: boolean; shipId: number | null; sunk: boolean } {
  if (shots[idx] !== "unknown") return { shots, hit: false, shipId: null, sunk: false };
  const next = shots.slice();
  const shipId = instance.cellShip[idx];
  if (shipId === null) {
    next[idx] = "miss";
    return { shots: next, hit: false, shipId: null, sunk: false };
  }
  next[idx] = "hit";
  const cells = shipCells(instance, shipId);
  const sunk = cells.every((c) => next[c] === "hit");
  return { shots: next, hit: true, shipId, sunk };
}

export function isFleetSunk(instance: Instance, shots: CellState[]): boolean {
  return instance.ships.every((ship) => shipCells(instance, ship.id).every((c) => shots[c] === "hit"));
}

export function shotsFiredCount(shots: CellState[]): number {
  return shots.filter((s) => s !== "unknown").length;
}

export function shipsSunkCount(instance: Instance, shots: CellState[]): number {
  return instance.ships.filter((ship) => shipCells(instance, ship.id).every((c) => shots[c] === "hit")).length;
}

function sunkCellSet(instance: Instance, shots: CellState[]): Set<number> {
  const set = new Set<number>();
  for (const ship of instance.ships) {
    const cells = shipCells(instance, ship.id);
    if (cells.every((c) => shots[c] === "hit")) cells.forEach((c) => set.add(c));
  }
  return set;
}

function remainingLengths(instance: Instance, shots: CellState[]): number[] {
  return instance.ships.filter((ship) => !shipCells(instance, ship.id).every((c) => shots[c] === "hit")).map((s) => s.length);
}

// --- motor de densidade, exportado pra testes diretos e hand-verificáveis ---

/** Todos os posicionamentos (H e V) de `length` cujo conjunto de células não contém nenhum `miss` nem
 * célula em `sunkCells`. Não exige que o posicionamento cubra nenhuma célula de acerto. */
export function enumeratePlacements(size: number, length: number, shots: CellState[], sunkCells: Set<number>): number[][] {
  const out: number[][] = [];
  for (const orientation of ["H", "V"] as Orientation[]) {
    const maxRow = orientation === "V" ? size - length : size - 1;
    const maxCol = orientation === "H" ? size - length : size - 1;
    if (maxRow < 0 || maxCol < 0) continue;
    for (let row = 0; row <= maxRow; row++) {
      for (let col = 0; col <= maxCol; col++) {
        const cells = placementCells(size, row, col, orientation, length);
        if (!cells) continue;
        if (cells.some((c) => shots[c] === "miss" || sunkCells.has(c))) continue;
        out.push(cells);
      }
    }
  }
  return out;
}

/** Se existe alguma célula "hit" fora de sunkCells, restringe a posicionamentos que cobrem pelo menos
 * uma delas (`restrictedToActiveHits:true`); senão usa todos os posicionamentos válidos de cada
 * comprimento em `remainingLengths`. */
export function buildHeatmap(size: number, lengths: number[], shots: CellState[], sunkCells: Set<number>): { heatmap: number[]; restrictedToActiveHits: boolean; placementCount: number } {
  const activeHits: number[] = [];
  for (let i = 0; i < shots.length; i++) {
    if (shots[i] === "hit" && !sunkCells.has(i)) activeHits.push(i);
  }
  const restrictedToActiveHits = activeHits.length > 0;
  const activeHitSet = new Set(activeHits);
  const heatmap = new Array<number>(size * size).fill(0);
  let placementCount = 0;
  for (const length of lengths) {
    const placements = enumeratePlacements(size, length, shots, sunkCells);
    for (const cells of placements) {
      if (restrictedToActiveHits && !cells.some((c) => activeHitSet.has(c))) continue;
      placementCount++;
      for (const c of cells) heatmap[c]++;
    }
  }
  return { heatmap, restrictedToActiveHits, placementCount };
}

/** Argmax do heatmap restrito a células "unknown", empate por menor índice; fallback defensivo (nunca
 * deveria disparar, board pequeno e sem cap) = menor índice "unknown" se o heatmap for todo zero. */
export function pickBestCell(size: number, shots: CellState[], heatmap: number[]): number {
  let best = -1;
  let bestValue = -1;
  for (let i = 0; i < size * size; i++) {
    if (shots[i] !== "unknown") continue;
    if (heatmap[i] > bestValue) {
      bestValue = heatmap[i];
      best = i;
    }
  }
  return best;
}

// --- motor de caça-e-alvo, exportado pra testes diretos ---

/** `activeHits` ordenado; se formar linha reta contígua cercada por erro/borda nas duas pontas E o
 * comprimento estiver em `lengths`, devolve {length, cells}; senão null (ainda não confirmado). */
export function detectSunkRun(size: number, shots: CellState[], activeHits: number[], lengths: number[]): { length: number; cells: number[] } | null {
  // A frota não tem navio de comprimento 1, então um único acerto isolado nunca confirma afundamento.
  if (activeHits.length < 2) return null;
  const sorted = activeHits.slice().sort((a, b) => a - b);
  const rows = new Set(sorted.map((c) => rowOf(size, c)));
  const cols = new Set(sorted.map((c) => colOf(size, c)));
  let axis: "row" | "col";
  if (rows.size === 1) axis = "row";
  else if (cols.size === 1) axis = "col";
  else return null;

  // confirma contiguidade (sem buracos) ao longo do eixo
  if (axis === "row") {
    const row = rowOf(size, sorted[0]);
    for (let i = 1; i < sorted.length; i++) {
      if (colOf(size, sorted[i]) !== colOf(size, sorted[i - 1]) + 1) return null;
    }
    if (!sorted.every((c) => rowOf(size, c) === row)) return null;
  } else {
    const col = colOf(size, sorted[0]);
    for (let i = 1; i < sorted.length; i++) {
      if (rowOf(size, sorted[i]) !== rowOf(size, sorted[i - 1]) + 1) return null;
    }
    if (!sorted.every((c) => colOf(size, c) === col)) return null;
  }

  if (!lengths.includes(sorted.length)) return null;
  if (!isFullyBounded(size, shots, sorted, axis)) return null;
  return { length: sorted.length, cells: sorted };
}

function isFullyBounded(size: number, shots: CellState[], run: number[], axis: "row" | "col"): boolean {
  const first = run[0];
  const last = run[run.length - 1];
  const before = axis === "row" ? (colOf(size, first) > 0 ? cellIndex(size, rowOf(size, first), colOf(size, first) - 1) : null) : rowOf(size, first) > 0 ? cellIndex(size, rowOf(size, first) - 1, colOf(size, first)) : null;
  const after = axis === "row" ? (colOf(size, last) < size - 1 ? cellIndex(size, rowOf(size, last), colOf(size, last) + 1) : null) : rowOf(size, last) < size - 1 ? cellIndex(size, rowOf(size, last) + 1, colOf(size, last)) : null;
  const beforeOk = before === null || shots[before] === "miss";
  const afterOk = after === null || shots[after] === "miss";
  return beforeOk && afterOk;
}

/** Primeira célula "unknown" em ordem row-major de paridade 0; se esgotada, paridade 1; null só se o
 * tabuleiro inteiro já foi disparado. */
export function nextHuntCell(size: number, shots: CellState[]): number | null {
  for (let parity = 0; parity <= 1; parity++) {
    for (let i = 0; i < size * size; i++) {
      if (shots[i] !== "unknown") continue;
      const row = rowOf(size, i);
      const col = colOf(size, i);
      if ((row + col) % 2 === parity) return i;
    }
  }
  return null;
}

// --- traço de passos, consumido pelo Timeline ---

export type BattleshipAction = "fire" | "sunk" | "solved";

export interface BattleshipStep {
  shots: CellState[];
  action: BattleshipAction;
  index: number | null;
  hit: boolean | null;
  reason: string;
  shipId?: number | null;
  shipName?: string;
  phase?: "hunt" | "target";
  heatmap?: number[] | null;
  restrictedToActiveHits?: boolean;
  shotsFired: number;
  shipsSunk: number;
}

function makeStep(instance: Instance, shots: CellState[], action: BattleshipAction, index: number | null, hit: boolean | null, reason: string, extra?: Partial<BattleshipStep>): BattleshipStep {
  return {
    shots: shots.slice(),
    action,
    index,
    hit,
    reason,
    shotsFired: shotsFiredCount(shots),
    shipsSunk: shipsSunkCount(instance, shots),
    ...extra,
  };
}

/** As duas células logo além das pontas da linha de `activeHits` (já colineares), filtradas às ainda
 * "unknown" - a fronteira que o Alvo precisa testar pra tentar fechar o cerco de um lado ou do outro. */
function axisEnds(size: number, shots: CellState[], activeHits: number[]): number[] {
  const sorted = activeHits.slice().sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const axis: "row" | "col" = rowOf(size, first) === rowOf(size, last) ? "row" : "col";
  const ends: number[] = [];
  if (axis === "row") {
    if (colOf(size, first) > 0) ends.push(cellIndex(size, rowOf(size, first), colOf(size, first) - 1));
    if (colOf(size, last) < size - 1) ends.push(cellIndex(size, rowOf(size, last), colOf(size, last) + 1));
  } else {
    if (rowOf(size, first) > 0) ends.push(cellIndex(size, rowOf(size, first) - 1, colOf(size, first)));
    if (rowOf(size, last) < size - 1) ends.push(cellIndex(size, rowOf(size, last) + 1, colOf(size, last)));
  }
  return ends.filter((n) => shots[n] === "unknown");
}

/**
 * Caça (paridade de xadrez) + Alvo (extensão de eixo). Como navios podem se tocar, o primeiro acerto
 * de uma sequência pode ter um vizinho que já é acerto de OUTRO navio (`detectSunkRun` sozinho não
 * consegue distinguir essa coincidência geométrica de um navio genuíno - por isso é só um utilitário
 * testável à parte, não a fonte da verdade aqui). O afundamento em si é lido de `fireAt` (verdade de
 * tabuleiro), exatamente como um jogo real de Batalha Naval sempre anuncia "afundou!" na hora - a
 * diferença real entre este modo e o probabilistico está em ONDE mirar, não em COMO descobrir que
 * afundou.
 */
export function heuristicoSteps(instance: Instance, maxSteps = BOARD_SIZE * BOARD_SIZE + 10): BattleshipStep[] {
  const size = instance.size;
  let shots = emptyShots(size);
  const steps: BattleshipStep[] = [makeStep(instance, shots, "fire", null, null, "Início: tabuleiro totalmente desconhecido.", { phase: "hunt" })];

  let targetQueue: number[] = [];
  let activeHits: number[] = [];
  let phase: "hunt" | "target" = "hunt";
  let guard = 0;

  while (guard < maxSteps) {
    guard++;
    if (isFleetSunk(instance, shots)) break;

    let idx: number | null = null;
    if (phase === "target" && targetQueue.length > 0) {
      idx = targetQueue.shift()!;
      while (idx !== null && shots[idx] !== "unknown") {
        idx = targetQueue.length > 0 ? targetQueue.shift()! : null;
      }
    }
    if (idx === null) {
      phase = "hunt";
      idx = nextHuntCell(size, shots);
    }
    if (idx === null) break; // tabuleiro inteiro disparado

    const result = fireAt(instance, shots, idx);
    shots = result.shots;

    if (result.sunk && result.shipId !== null) {
      const shipName = instance.ships.find((s) => s.id === result.shipId)?.name;
      steps.push(makeStep(instance, shots, "sunk", idx, true, `Célula ${idx} afundou o ${shipName}.`, { shipId: result.shipId, shipName, phase: "target" }));
      const sunkCells = shipCells(instance, result.shipId);
      activeHits = activeHits.filter((c) => !sunkCells.includes(c));
      if (activeHits.length === 0) {
        phase = "hunt";
        targetQueue = [];
      } else if (activeHits.length === 1) {
        phase = "target";
        targetQueue = orthogonalNeighbors(size, activeHits[0]).filter((n) => shots[n] === "unknown");
      } else {
        phase = "target";
        targetQueue = axisEnds(size, shots, activeHits);
      }
    } else if (result.hit) {
      activeHits.push(idx);
      steps.push(makeStep(instance, shots, "fire", idx, true, `Acerto em ${idx}. Ainda não afundou - explorando os vizinhos.`, { phase: "target" }));
      phase = "target";
      // eixo ainda desconhecido (1º acerto da sequência): testa os 4 vizinhos ortogonais.
      // eixo já conhecido (2º+ acerto colinear): só estende pelas duas pontas da linha.
      targetQueue = activeHits.length === 1 ? orthogonalNeighbors(size, idx).filter((n) => shots[n] === "unknown") : axisEnds(size, shots, activeHits);
    } else {
      steps.push(makeStep(instance, shots, "fire", idx, false, `Erro em ${idx}.`, { phase }));
      if (activeHits.length >= 2) {
        // esse erro pode ter sido justamente a ponta que faltava; se ainda restar uma ponta em
        // aberto, continua tentando ela antes de voltar pra caça.
        targetQueue = axisEnds(size, shots, activeHits);
      }
    }
  }

  steps.push(makeStep(instance, shots, "solved", null, null, `Frota afundada em ${shotsFiredCount(shots)} tiros (Caça e Alvo).`));
  return steps;
}

/** Mapa de densidade + refinamento de mira. Afundamento lido direto do retorno de fireAt (verdade de
 * tabuleiro) - escolha deliberada e mais simples, diferente da detecção própria do heuristico. */
export function probabilisticoSteps(instance: Instance, maxSteps = BOARD_SIZE * BOARD_SIZE + 10): BattleshipStep[] {
  const size = instance.size;
  let shots = emptyShots(size);
  const steps: BattleshipStep[] = [makeStep(instance, shots, "fire", null, null, "Início: tabuleiro totalmente desconhecido.")];

  let guard = 0;
  while (guard < maxSteps) {
    guard++;
    if (isFleetSunk(instance, shots)) break;

    const sunkCells = sunkCellSet(instance, shots);
    const lengths = remainingLengths(instance, shots);
    const { heatmap, restrictedToActiveHits, placementCount } = buildHeatmap(size, lengths, shots, sunkCells);
    const idx = pickBestCell(size, shots, heatmap);
    if (idx < 0) break; // defensivo: nunca deveria acontecer num tabuleiro 10x10 sem cap

    const result = fireAt(instance, shots, idx);
    shots = result.shots;

    if (result.sunk && result.shipId !== null) {
      const shipName = instance.ships.find((s) => s.id === result.shipId)?.name;
      steps.push(makeStep(instance, shots, "sunk", idx, true, `Célula ${idx} (densidade ${heatmap[idx]} de ${placementCount} posicionamentos) afundou o ${shipName}.`, { shipId: result.shipId, shipName, heatmap, restrictedToActiveHits }));
    } else {
      steps.push(makeStep(instance, shots, "fire", idx, result.hit, `Célula ${idx} escolhida por densidade máxima (${heatmap[idx]} de ${placementCount} posicionamentos válidos)${restrictedToActiveHits ? ", restrito a posicionamentos que tocam um acerto ativo" : ""}. ${result.hit ? "Acerto." : "Erro."}`, { heatmap, restrictedToActiveHits }));
    }
  }

  steps.push(makeStep(instance, shots, "solved", null, null, `Frota afundada em ${shotsFiredCount(shots)} tiros (Mapa de Densidade).`));
  return steps;
}
