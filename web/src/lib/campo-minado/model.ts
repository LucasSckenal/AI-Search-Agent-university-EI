/**
 * Campo Minado (Minesweeper). Two solver families, both genuinely new to this site: pure logical
 * deduction over adjacency-count constraints (single-point + subset/difference rules), and - when
 * logic alone stalls - exact mine-probability inference via combinatorial enumeration over the
 * frontier's connected constraint components. Unlike Sudoku's CSP (which always converges to one
 * unique solution) this board can genuinely require a real, risky guess.
 */

export type Difficulty = "iniciante" | "intermediario" | "avancado";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export interface BoardConfig {
  width: number;
  height: number;
  mineCount: number;
}

export const DIFFICULTY_CONFIG: Record<Difficulty, BoardConfig> = {
  iniciante: { width: 9, height: 9, mineCount: 10 },
  intermediario: { width: 16, height: 16, mineCount: 40 },
  avancado: { width: 30, height: 16, mineCount: 99 },
};

export interface Instance {
  board: BoardConfig;
  /** length width*height; all-false means mines haven't been placed yet (a "shell"). */
  mines: boolean[];
  /** Adjacent mine count per cell; only meaningful once minesPlaced. */
  adjacent: number[];
  minesPlaced: boolean;
}

export function cellIndex(board: BoardConfig, row: number, col: number): number {
  return row * board.width + col;
}
export function rowOf(board: BoardConfig, i: number): number {
  return Math.floor(i / board.width);
}
export function colOf(board: BoardConfig, i: number): number {
  return i % board.width;
}

export function neighborsOf(board: BoardConfig, i: number): number[] {
  const r = rowOf(board, i);
  const c = colOf(board, i);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= board.height || nc < 0 || nc >= board.width) continue;
      out.push(cellIndex(board, nr, nc));
    }
  }
  return out;
}

export function makeShell(board: BoardConfig): Instance {
  const n = board.width * board.height;
  return { board, mines: new Array(n).fill(false), adjacent: new Array(n).fill(0), minesPlaced: false };
}

export function centerIndex(board: BoardConfig): number {
  return cellIndex(board, Math.floor(board.height / 2), Math.floor(board.width / 2));
}

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Places mines excluding the safe cell AND its neighbors (guarantees an opening), then computes
 * adjacency counts. Pure - returns a new Instance, same shape as Sudoku's generatePuzzle digging a
 * fresh grid rather than mutating one in place.
 */
export function placeMines(instance: Instance, safeIdx: number, rng: () => number): Instance {
  const { board } = instance;
  const n = board.width * board.height;
  const excluded = new Set<number>([safeIdx, ...neighborsOf(board, safeIdx)]);
  const candidates: number[] = [];
  for (let i = 0; i < n; i++) if (!excluded.has(i)) candidates.push(i);
  shuffle(candidates, rng);

  const mines = new Array<boolean>(n).fill(false);
  for (const i of candidates.slice(0, board.mineCount)) mines[i] = true;

  const adjacent = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (mines[i]) continue;
    let count = 0;
    for (const nb of neighborsOf(board, i)) if (mines[nb]) count++;
    adjacent[i] = count;
  }
  return { board, mines, adjacent, minesPlaced: true };
}

/**
 * Stack-based flood fill: reveals `idx`, and if it has zero adjacent mines, cascades outward through
 * every unrevealed, unflagged, non-mine neighbor - a neighbor that itself has a nonzero count gets
 * revealed but does not cascade further (standard Minesweeper open-region behavior). Flagged cells
 * block the cascade (a flag is a deliberate "don't touch this" marker).
 */
export function floodReveal(instance: Instance, revealed: boolean[], flagged: boolean[], idx: number): { revealed: boolean[]; exploded: boolean } {
  const next = revealed.slice();
  if (next[idx] || flagged[idx]) return { revealed: next, exploded: false };
  if (instance.mines[idx]) {
    next[idx] = true;
    return { revealed: next, exploded: true };
  }
  const stack = [idx];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (next[cur] || flagged[cur]) continue;
    next[cur] = true;
    if (instance.adjacent[cur] === 0) {
      for (const nb of neighborsOf(instance.board, cur)) {
        if (!next[nb] && !flagged[nb] && !instance.mines[nb]) stack.push(nb);
      }
    }
  }
  return { revealed: next, exploded: false };
}

export function toggleFlag(flagged: boolean[], revealed: boolean[], idx: number): boolean[] {
  if (revealed[idx]) return flagged.slice();
  const next = flagged.slice();
  next[idx] = !next[idx];
  return next;
}

export function remainingMines(instance: Instance, flagged: boolean[]): number {
  let flaggedCount = 0;
  for (const f of flagged) if (f) flaggedCount++;
  return instance.board.mineCount - flaggedCount;
}

export function isWon(instance: Instance, revealed: boolean[]): boolean {
  for (let i = 0; i < instance.mines.length; i++) {
    if (!instance.mines[i] && !revealed[i]) return false;
  }
  return true;
}

// --- solver trace ---

export type MinesweeperAction = "reveal" | "flag" | "guess" | "exploded" | "solved" | "stuck";

export interface MinesweeperStep {
  revealed: boolean[];
  flagged: boolean[];
  action: MinesweeperAction;
  /** Cells touched this step (a rule fire is usually a batch, not one cell). */
  indices: number[];
  reason: string;
  rule?: "single-point" | "subset" | "probability";
  /** "guess" steps only: the computed mine-probability of the cell that was guessed. */
  guessProbability?: number;
  /** Sparse, probabilidade mode only: every frontier probability computed this pass. */
  probabilities?: (number | null)[];
  cellsRevealed: number;
  cellsFlagged: number;
}

function makeStep(revealed: boolean[], flagged: boolean[], action: MinesweeperAction, indices: number[], reason: string, rule?: MinesweeperStep["rule"]): MinesweeperStep {
  let cellsRevealed = 0;
  for (const r of revealed) if (r) cellsRevealed++;
  let cellsFlagged = 0;
  for (const f of flagged) if (f) cellsFlagged++;
  return { revealed: revealed.slice(), flagged: flagged.slice(), action, indices, reason, rule, cellsRevealed, cellsFlagged };
}

function hiddenNeighbors(instance: Instance, revealed: boolean[], flagged: boolean[], i: number): number[] {
  return neighborsOf(instance.board, i).filter((nb) => !revealed[nb] && !flagged[nb]);
}
function flaggedNeighborCount(instance: Instance, flagged: boolean[], i: number): number {
  let count = 0;
  for (const nb of neighborsOf(instance.board, i)) if (flagged[nb]) count++;
  return count;
}

/**
 * A revealed numbered cell whose remaining-mine-need equals its hidden-neighbor count -> all hidden
 * neighbors are mines. One whose need is already 0 (satisfied by flags) -> all hidden neighbors are
 * safe. Returns the FIRST firing instance found (row-major scan), so each call is one deduction.
 */
function applySinglePoint(instance: Instance, revealed: boolean[], flagged: boolean[]): { indices: number[]; kind: "flag" | "reveal"; source: number } | null {
  const n = instance.board.width * instance.board.height;
  for (let i = 0; i < n; i++) {
    if (!revealed[i] || instance.adjacent[i] <= 0) continue;
    const hidden = hiddenNeighbors(instance, revealed, flagged, i);
    if (hidden.length === 0) continue;
    const need = instance.adjacent[i] - flaggedNeighborCount(instance, flagged, i);
    if (need === hidden.length && need > 0) return { indices: hidden, kind: "flag", source: i };
    if (need === 0) return { indices: hidden, kind: "reveal", source: i };
  }
  return null;
}

/**
 * For two revealed numbered cells A, B whose hidden-neighbor sets satisfy hidden(A) ⊂ hidden(B), the
 * set difference must contain exactly need(B)-need(A) mines - if that's 0 the difference is all safe,
 * if it equals the difference's size the difference is all mines. Strictly more powerful than
 * single-point alone (that's the whole reason it exists as a second rule).
 */
function applySubsetRule(instance: Instance, revealed: boolean[], flagged: boolean[]): { indices: number[]; kind: "flag" | "reveal"; sourceA: number; sourceB: number } | null {
  const n = instance.board.width * instance.board.height;
  const frontier: { i: number; hidden: Set<number>; need: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (!revealed[i] || instance.adjacent[i] <= 0) continue;
    const hiddenArr = hiddenNeighbors(instance, revealed, flagged, i);
    if (hiddenArr.length === 0) continue;
    const need = instance.adjacent[i] - flaggedNeighborCount(instance, flagged, i);
    frontier.push({ i, hidden: new Set(hiddenArr), need });
  }
  for (const a of frontier) {
    for (const b of frontier) {
      if (a.i === b.i || a.hidden.size >= b.hidden.size) continue;
      let isSubset = true;
      for (const x of a.hidden) if (!b.hidden.has(x)) { isSubset = false; break; }
      if (!isSubset) continue;
      const diff = [...b.hidden].filter((x) => !a.hidden.has(x));
      const neededDiff = b.need - a.need;
      if (neededDiff === diff.length && neededDiff > 0) return { indices: diff, kind: "flag", sourceA: a.i, sourceB: b.i };
      if (neededDiff === 0 && diff.length > 0) return { indices: diff, kind: "reveal", sourceA: a.i, sourceB: b.i };
    }
  }
  return null;
}

function revealAll(instance: Instance, revealed: boolean[], flagged: boolean[], indices: number[]): boolean[] {
  let rev = revealed;
  for (const idx of indices) rev = floodReveal(instance, rev, flagged, idx).revealed;
  return rev;
}
function diffTouched(before: boolean[], after: boolean[]): number[] {
  const touched: number[] = [];
  for (let i = 0; i < after.length; i++) if (after[i] && !before[i]) touched.push(i);
  return touched;
}

function initialStep(revealed: boolean[], flagged: boolean[]): MinesweeperStep {
  const indices: number[] = [];
  for (let i = 0; i < revealed.length; i++) if (revealed[i]) indices.push(i);
  return makeStep(revealed, flagged, "reveal", indices, "Estado inicial revelado.");
}

/**
 * Deduces to a fixed point using single-point then subset/difference rules, one rule-fire per step.
 * Never guesses - when a full pass finds neither rule firing, records "stuck" and stops. That stall
 * is an honest, intended outcome: some boards genuinely can't be solved by pure logic alone.
 */
export function logicaSteps(instance: Instance, revealed: boolean[], flagged: boolean[], maxSteps = 5000): MinesweeperStep[] {
  const steps: MinesweeperStep[] = [initialStep(revealed, flagged)];
  let rev = revealed.slice();
  const flg = flagged.slice();
  for (let guard = 0; guard < maxSteps; guard++) {
    if (isWon(instance, rev)) {
      steps.push(makeStep(rev, flg, "solved", [], "Todas as células seguras foram reveladas."));
      return steps;
    }
    const sp = applySinglePoint(instance, rev, flg);
    if (sp) {
      if (sp.kind === "flag") {
        for (const idx of sp.indices) flg[idx] = true;
        steps.push(makeStep(rev, flg, "flag", sp.indices, `célula ${sp.source} precisa de ${sp.indices.length} mina(s) nas vizinhas ocultas restantes → todas são minas`, "single-point"));
      } else {
        const before = rev;
        rev = revealAll(instance, rev, flg, sp.indices);
        steps.push(makeStep(rev, flg, "reveal", diffTouched(before, rev), `célula ${sp.source} já tem todas as suas minas marcadas → vizinhas ocultas restantes são seguras`, "single-point"));
      }
      continue;
    }
    const ss = applySubsetRule(instance, rev, flg);
    if (ss) {
      if (ss.kind === "flag") {
        for (const idx of ss.indices) flg[idx] = true;
        steps.push(makeStep(rev, flg, "flag", ss.indices, `diferença entre as células ${ss.sourceA} e ${ss.sourceB} força ${ss.indices.length} mina(s)`, "subset"));
      } else {
        const before = rev;
        rev = revealAll(instance, rev, flg, ss.indices);
        steps.push(makeStep(rev, flg, "reveal", diffTouched(before, rev), `diferença entre as células ${ss.sourceA} e ${ss.sourceB} não contém minas → seguras`, "subset"));
      }
      continue;
    }
    steps.push(makeStep(rev, flg, "stuck", [], "Nenhuma dedução lógica disponível — seria preciso arriscar um palpite."));
    return steps;
  }
  steps.push(makeStep(rev, flg, "stuck", [], "Limite de passos atingido."));
  return steps;
}

// --- probability engine ---

export interface FrontierConstraint {
  source: number;
  members: number[];
  /** Mines still needed among `members` (adjacent count minus already-flagged neighbors). */
  remaining: number;
}
export interface FrontierComponent {
  cells: number[];
  constraints: FrontierConstraint[];
}

/** Partitions frontier cells (hidden, unflagged, adjacent to a revealed number) into connected
 * components - two cells are connected if they co-occur in a constraint - plus the "free" cells that
 * touch no constraint at all. */
export function buildFrontier(instance: Instance, revealed: boolean[], flagged: boolean[]): { components: FrontierComponent[]; freeCells: number[] } {
  const n = instance.board.width * instance.board.height;
  const constraints: FrontierConstraint[] = [];
  const frontierCellSet = new Set<number>();
  for (let i = 0; i < n; i++) {
    if (!revealed[i] || instance.adjacent[i] <= 0) continue;
    const hidden = hiddenNeighbors(instance, revealed, flagged, i);
    if (hidden.length === 0) continue;
    const remaining = instance.adjacent[i] - flaggedNeighborCount(instance, flagged, i);
    constraints.push({ source: i, members: hidden, remaining });
    for (const h of hidden) frontierCellSet.add(h);
  }

  const parent = new Map<number, number>();
  for (const c of frontierCellSet) parent.set(c, c);
  function find(x: number): number {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    while (parent.get(x) !== root) {
      const next = parent.get(x)!;
      parent.set(x, root);
      x = next;
    }
    return root;
  }
  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  for (const c of constraints) for (let k = 1; k < c.members.length; k++) union(c.members[0], c.members[k]);

  const groups = new Map<number, number[]>();
  for (const c of frontierCellSet) {
    const root = find(c);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(c);
  }
  const constraintsByRoot = new Map<number, FrontierConstraint[]>();
  for (const c of constraints) {
    const root = find(c.members[0]);
    if (!constraintsByRoot.has(root)) constraintsByRoot.set(root, []);
    constraintsByRoot.get(root)!.push(c);
  }
  const components: FrontierComponent[] = [];
  for (const [root, cells] of groups) components.push({ cells, constraints: constraintsByRoot.get(root) ?? [] });

  const freeCells: number[] = [];
  for (let i = 0; i < n; i++) {
    if (revealed[i] || flagged[i] || frontierCellSet.has(i)) continue;
    freeCells.push(i);
  }
  return { components, freeCells };
}

export const EXACT_ENUMERATION_CAP = 20;

/**
 * DFS over a component's cells with constraint-based pruning at every partial assignment (not just at
 * leaves) - this produces exactly the same set of valid leaf-assignments a brute-force 2^k scan would
 * (a pruned branch can never contain a valid completion), just faster. Caps component size BEFORE
 * enumerating - never truncates mid-search, which would silently corrupt the result.
 */
export function enumerateComponent(component: FrontierComponent, cap: number = EXACT_ENUMERATION_CAP): { assignments: { mines: Set<number>; count: number }[]; approximated: boolean } {
  const cells = component.cells;
  if (cells.length > cap) return { assignments: [], approximated: true };

  const posOf = new Map<number, number>();
  cells.forEach((c, i) => posOf.set(c, i));
  const decided: (boolean | undefined)[] = new Array(cells.length).fill(undefined);
  const results: { mines: Set<number>; count: number }[] = [];

  function constraintsConsistent(requireComplete: boolean): boolean {
    for (const c of component.constraints) {
      let assignedMines = 0;
      let undecided = 0;
      for (const m of c.members) {
        const d = decided[posOf.get(m)!];
        if (d === true) assignedMines++;
        else if (d === undefined) undecided++;
      }
      if (assignedMines > c.remaining) return false;
      if (assignedMines + undecided < c.remaining) return false;
      if (requireComplete && undecided === 0 && assignedMines !== c.remaining) return false;
    }
    return true;
  }

  function dfs(pos: number): void {
    if (pos === cells.length) {
      if (constraintsConsistent(true)) {
        const mines = new Set<number>();
        let count = 0;
        for (let i = 0; i < cells.length; i++) {
          if (decided[i]) {
            mines.add(cells[i]);
            count++;
          }
        }
        results.push({ mines, count });
      }
      return;
    }
    for (const val of [false, true]) {
      decided[pos] = val;
      if (constraintsConsistent(false)) dfs(pos + 1);
      decided[pos] = undefined;
    }
  }
  dfs(0);
  return { assignments: results, approximated: false };
}

function buildComponentHistograms(assignments: { mines: Set<number>; count: number }[], cells: number[]): { cellsHist: Map<number, Map<number, number>>; totalHist: Map<number, number> } {
  const totalHist = new Map<number, number>();
  const cellsHist = new Map<number, Map<number, number>>();
  for (const cell of cells) cellsHist.set(cell, new Map());
  for (const a of assignments) {
    totalHist.set(a.count, (totalHist.get(a.count) ?? 0) + 1);
    for (const cell of a.mines) {
      const h = cellsHist.get(cell)!;
      h.set(a.count, (h.get(a.count) ?? 0) + 1);
    }
  }
  return { cellsHist, totalHist };
}

function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
  return result;
}

function convolve(a: Map<number, number>, b: Map<number, number>): Map<number, number> {
  const result = new Map<number, number>();
  for (const [ta, wa] of a) for (const [tb, wb] of b) result.set(ta + tb, (result.get(ta + tb) ?? 0) + wa * wb);
  return result;
}
function combineHistList(hists: Map<number, number>[]): Map<number, number> {
  let acc = new Map<number, number>([[0, 1]]);
  for (const h of hists) acc = convolve(acc, h);
  return acc;
}

/**
 * The combinatorial core, hand-verified against a worked example before implementation (see
 * test/campo-minado.test.ts): combine every component's mine-count histogram by convolution, weight
 * each combined total T by C(freeCells, remainingMines-T) (the number of ways to place the rest of
 * the mines among the free cells), and a cell's probability is the weighted share of combinations
 * where it's a mine. Invariant: sum of every returned probability (frontier + free*freeCells) equals
 * remainingMines exactly, for any input - reused as a fuzz-tested correctness check.
 */
export function combineComponents(
  components: { cellsHist: Map<number, Map<number, number>>; totalHist: Map<number, number> }[],
  freeCells: number,
  remainingMines: number
): { probabilities: Map<number, number>; freeProbability: number; expectedFrontierMines: number } {
  const totalHists = components.map((c) => c.totalHist);
  const allHist = combineHistList(totalHists);

  let Z = 0;
  for (const [T, ways] of allHist) {
    const need = remainingMines - T;
    if (need < 0 || need > freeCells) continue;
    Z += ways * comb(freeCells, need);
  }

  const probabilities = new Map<number, number>();
  let expectedFrontierMines = 0;
  if (Z > 0) {
    for (let j = 0; j < components.length; j++) {
      const restHist = combineHistList(totalHists.filter((_, idx) => idx !== j));
      for (const [cell, cellHist] of components[j].cellsHist) {
        let numerator = 0;
        for (const [tj, ways] of cellHist) {
          for (const [trest, waysRest] of restHist) {
            const need = remainingMines - (tj + trest);
            if (need < 0 || need > freeCells) continue;
            numerator += ways * waysRest * comb(freeCells, need);
          }
        }
        const p = numerator / Z;
        probabilities.set(cell, p);
        expectedFrontierMines += p;
      }
    }
  }
  const freeProbability = freeCells > 0 ? Math.max(0, Math.min(1, (remainingMines - expectedFrontierMines) / freeCells)) : 0;
  return { probabilities, freeProbability, expectedFrontierMines };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function computeProbabilities(instance: Instance, revealed: boolean[], flagged: boolean[]): { probabilities: Map<number, number>; approximatedComponents: number } {
  const { components, freeCells } = buildFrontier(instance, revealed, flagged);
  let remaining = remainingMines(instance, flagged);
  let approximatedComponents = 0;
  const histComponents: { cellsHist: Map<number, Map<number, number>>; totalHist: Map<number, number> }[] = [];
  const approxProbabilities = new Map<number, number>();

  for (const comp of components) {
    const { assignments, approximated } = enumerateComponent(comp);
    if (approximated) {
      approximatedComponents++;
      // Fallback for a component too large to enumerate exactly: average local mine density from its
      // own constraints. Documented approximation, not silently treated as exact.
      const avgDensity = comp.constraints.length > 0 ? clamp01(comp.constraints.reduce((sum, c) => sum + c.remaining / c.members.length, 0) / comp.constraints.length) : 0.5;
      for (const cell of comp.cells) approxProbabilities.set(cell, avgDensity);
      remaining -= avgDensity * comp.cells.length;
      continue;
    }
    histComponents.push(buildComponentHistograms(assignments, comp.cells));
  }
  remaining = Math.max(0, remaining);

  const { probabilities: exactProbabilities, freeProbability } = combineComponents(histComponents, freeCells.length, remaining);
  const probabilities = new Map<number, number>([...exactProbabilities, ...approxProbabilities]);
  for (const cell of freeCells) probabilities.set(cell, freeProbability);
  return { probabilities, approximatedComponents };
}

/**
 * Same deduction loop as logicaSteps; when stuck, computes exact frontier probabilities and reveals
 * the lowest-probability cell as a "guess" step (ties broken by lowest index), then resumes deduction.
 * Only stops via "solved" or "exploded" - unlike logicaSteps, this mode always keeps going, at the
 * cost of carrying real risk.
 */
export function probabilidadeSteps(instance: Instance, revealed: boolean[], flagged: boolean[], maxSteps = 5000): MinesweeperStep[] {
  const steps: MinesweeperStep[] = [initialStep(revealed, flagged)];
  let rev = revealed.slice();
  const flg = flagged.slice();
  for (let guard = 0; guard < maxSteps; guard++) {
    if (isWon(instance, rev)) {
      steps.push(makeStep(rev, flg, "solved", [], "Todas as células seguras foram reveladas."));
      return steps;
    }
    const sp = applySinglePoint(instance, rev, flg);
    if (sp) {
      if (sp.kind === "flag") {
        for (const idx of sp.indices) flg[idx] = true;
        steps.push(makeStep(rev, flg, "flag", sp.indices, `célula ${sp.source} precisa de ${sp.indices.length} mina(s) nas vizinhas ocultas restantes → todas são minas`, "single-point"));
      } else {
        const before = rev;
        rev = revealAll(instance, rev, flg, sp.indices);
        steps.push(makeStep(rev, flg, "reveal", diffTouched(before, rev), `célula ${sp.source} já tem todas as suas minas marcadas → vizinhas ocultas restantes são seguras`, "single-point"));
      }
      continue;
    }
    const ss = applySubsetRule(instance, rev, flg);
    if (ss) {
      if (ss.kind === "flag") {
        for (const idx of ss.indices) flg[idx] = true;
        steps.push(makeStep(rev, flg, "flag", ss.indices, `diferença entre as células ${ss.sourceA} e ${ss.sourceB} força ${ss.indices.length} mina(s)`, "subset"));
      } else {
        const before = rev;
        rev = revealAll(instance, rev, flg, ss.indices);
        steps.push(makeStep(rev, flg, "reveal", diffTouched(before, rev), `diferença entre as células ${ss.sourceA} e ${ss.sourceB} não contém minas → seguras`, "subset"));
      }
      continue;
    }

    const { probabilities } = computeProbabilities(instance, rev, flg);
    if (probabilities.size === 0) {
      steps.push(makeStep(rev, flg, "stuck", [], "Nenhuma célula restante para estimar."));
      return steps;
    }
    let bestIdx = -1;
    let bestP = Infinity;
    for (const [idx, p] of probabilities) {
      if (p < bestP || (p === bestP && idx < bestIdx)) {
        bestP = p;
        bestIdx = idx;
      }
    }
    const probSnapshot: (number | null)[] = new Array(rev.length).fill(null);
    for (const [idx, p] of probabilities) probSnapshot[idx] = p;

    const before = rev;
    const { revealed: afterReveal, exploded } = floodReveal(instance, rev, flg, bestIdx);
    rev = afterReveal;
    const touched = diffTouched(before, rev);
    const pct = (bestP * 100).toFixed(1);

    if (exploded) {
      steps.push({ ...makeStep(rev, flg, "guess", touched, `célula ${bestIdx} escolhida (${pct}% de probabilidade de ser mina) — era uma mina`, "probability"), guessProbability: bestP, probabilities: probSnapshot });
      steps.push(makeStep(rev, flg, "exploded", [bestIdx], "O palpite acertou uma mina."));
      return steps;
    }
    steps.push({ ...makeStep(rev, flg, "guess", touched, `célula ${bestIdx} escolhida (${pct}% de probabilidade de ser mina) — segura`, "probability"), guessProbability: bestP, probabilities: probSnapshot });
  }
  steps.push(makeStep(rev, flg, "stuck", [], "Limite de passos atingido."));
  return steps;
}
