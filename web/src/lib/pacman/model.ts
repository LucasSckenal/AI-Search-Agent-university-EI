/**
 * Masmorra: um herói foge de 4 monstros num labirinto GERADO por algoritmo a cada partida (não mais
 * desenhado à mão), com sprites de verdade (pacote CC0 "Tiny Dungeon" da Kenney, ver
 * public/sprites/dungeon/) em vez de formas CSS. Reaproveita o gerador recursive-backtracker do
 * Labirinto (generatePerfectMaze) e as 4 fórmulas de perseguição multiagente já creditadas na lista
 * mestra de algoritmos (perseguição direta / emboscada 4-à-frente / flanco via pivô / recuo por
 * proximidade) — nenhuma das duas é nova, então não ganham crédito novo.
 *
 * A peça genuinamente nova é braidMaze: generatePerfectMaze produz uma árvore geradora perfeita
 * (exatamente um caminho entre quaisquer duas salas, zero loops) - ótimo pra resolver com BFS/A*,
 * péssimo pra um jogo de perseguição, onde um monstro atrás do herói num beco sem saída vira uma
 * captura inevitável sem chance de desvio. braidMaze percorre os becos-sem-saída depois da geração e
 * reconecta uma fração deles a um vizinho aleatório, criando alguns loops sem quebrar a conectividade.
 *
 * - "especializados": Fantasma (perseguição direta), Limo (emboscada 4-à-frente), Morcego (flanco via
 *   posição do Fantasma) e Aranha (recuo por proximidade) - cada um com uma regra de alvo própria.
 * - "gulosos": os 4 monstros usam a regra do Fantasma (perseguição direta e idêntica) - um baseline
 *   ingênuo pra comparar contra os papéis especializados. Renderiza os 4 com o MESMO sprite (fantasma)
 *   pra deixar visualmente óbvio que são perseguidores idênticos.
 */

import { generatePerfectMaze, type CellKind, type MazeState } from "../maze/model";

export type Dir = "up" | "down" | "left" | "right";
export interface Vec {
  r: number;
  c: number;
}
export type MonsterName = "fantasma" | "limo" | "morcego" | "aranha";
export type MonsterMode = "chase" | "frightened" | "eaten";
export type Ensemble = "especializados" | "gulosos";

export const DUNGEON_SIZE = 21;
export const FRIGHTENED_DURATION = 30;
export const MONSTER_NAMES: MonsterName[] = ["fantasma", "limo", "morcego", "aranha"];
// Ordem de desempate fixa: cima, esquerda, baixo, direita.
export const MONSTER_DIRECTIONS: Dir[] = ["up", "left", "down", "right"];

const DIR_DELTA: Record<Dir, { dr: number; dc: number }> = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
};

export function keyOf(pos: Vec): string {
  return `${pos.r},${pos.c}`;
}

function inBounds(maze: MazeState, pos: Vec): boolean {
  return pos.r >= 0 && pos.r < maze.rows && pos.c >= 0 && pos.c < maze.cols;
}

export function cellAt(maze: MazeState, pos: Vec): CellKind | "outside" {
  if (!inBounds(maze, pos)) return "outside";
  return maze.cells[pos.r * maze.cols + pos.c];
}

/** "mud" só existe pelo reaproveitamento de generatePerfectMaze (terreno com custo pro Labirinto) -
 * aqui não há custo de movimento, então mud é tratado exatamente como empty: só wall bloqueia. */
export function isPassable(maze: MazeState, pos: Vec): boolean {
  const cell = cellAt(maze, pos);
  return cell === "empty" || cell === "mud";
}

export function isRoom(pos: Vec): boolean {
  return pos.r % 2 === 0 && pos.c % 2 === 0;
}

export function stepFrom(pos: Vec, dir: Dir): Vec {
  const d = DIR_DELTA[dir];
  return { r: pos.r + d.dr, c: pos.c + d.dc };
}

export function isReversal(a: Dir, b: Dir): boolean {
  return (a === "up" && b === "down") || (a === "down" && b === "up") || (a === "left" && b === "right") || (a === "right" && b === "left");
}

/** Vizinhos legais (não-parede) a partir de pos. Sem wrap de túnel - não fazia sentido fora do
 * traçado arcade original, e o labirinto procedural não tem bordas especiais. */
export function legalNeighbors(maze: MazeState, pos: Vec): { dir: Dir; pos: Vec }[] {
  const out: { dir: Dir; pos: Vec }[] = [];
  for (const dir of MONSTER_DIRECTIONS) {
    const next = stepFrom(pos, dir);
    if (isPassable(maze, next)) out.push({ dir, pos: next });
  }
  return out;
}

/**
 * Pós-processamento de "braiding" (técnica padrão de geração de labirintos): pra cada sala (linha e
 * coluna pares) com grau de conectividade 1 (beco-sem-saída), com probabilidade braidChance escolhe
 * uma das direções atualmente fechadas que levam a outra sala dentro dos limites, e entalha a célula
 * de corredor entre elas, criando um loop. Só adiciona conexões - nunca remove uma, então a
 * conectividade garantida pelo spanning tree de generatePerfectMaze nunca é quebrada.
 */
export function braidMaze(maze: MazeState, braidChance: number, rng: () => number): MazeState {
  const cells = [...maze.cells];
  const next = { ...maze, cells };

  for (let r = 0; r < maze.rows; r += 2) {
    for (let c = 0; c < maze.cols; c += 2) {
      const room: Vec = { r, c };
      const open: Dir[] = [];
      const closed: Dir[] = [];
      for (const dir of MONSTER_DIRECTIONS) {
        const neighbor = stepFrom(room, dir);
        if (!inBounds(maze, neighbor)) continue;
        if (isPassable(next, neighbor)) open.push(dir);
        else closed.push(dir);
      }
      if (open.length !== 1 || closed.length === 0) continue;
      if (rng() >= braidChance) continue;
      const dir = closed[Math.floor(rng() * closed.length) % closed.length];
      const wallPos = stepFrom(room, dir);
      cells[wallPos.r * maze.cols + wallPos.c] = "empty";
    }
  }
  return next;
}

export interface MonsterState {
  name: MonsterName;
  pos: Vec;
  dir: Dir;
  mode: MonsterMode;
}

export interface DungeonState {
  maze: MazeState;
  hero: { pos: Vec; dir: Dir };
  monsters: MonsterState[];
  monsterSpawns: Vec[];
  pellets: Set<string>;
  potions: Set<string>;
  totalPellets: number;
  score: number;
  ticks: number;
  frightenedTicks: number;
  over: boolean;
  won: boolean;
}

/** BFS sobre salas (grau par/par) a partir do canto oposto ao herói, coletando as primeiras 4 salas
 * distintas alcançadas - vira o "covil" onde os monstros nascem. Sempre preenchível num labirinto
 * 21x21 (121 salas conectadas); se por algum motivo bizarro não achar 4, repete a última encontrada
 * em vez de deixar o array curto. */
function findMonsterDen(maze: MazeState): Vec[] {
  const denCorner: Vec = { r: maze.rows - 1, c: maze.cols - 1 };
  const visited = new Set<string>([keyOf(denCorner)]);
  const queue: Vec[] = [denCorner];
  const found: Vec[] = [];

  while (queue.length > 0 && found.length < 4) {
    const cur = queue.shift()!;
    found.push(cur);
    // pula pra salas vizinhas (distância 2), passando pelo corredor no meio
    for (const dir of MONSTER_DIRECTIONS) {
      const corridor = stepFrom(cur, dir);
      const room = stepFrom(corridor, dir);
      if (!inBounds(maze, room) || !isRoom(room)) continue;
      if (!isPassable(maze, corridor)) continue;
      const k = keyOf(room);
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push(room);
    }
  }
  while (found.length < 4) found.push(found[found.length - 1]);
  return found;
}

/** BFS de distância a partir do herói sobre toda célula passável (salas + corredores); escolhe
 * gulosamente as 4 células mais distantes respeitando um espaçamento mínimo entre si, pra não
 * empilhar as 4 poções no mesmo canto. Se o espaçamento não puder ser satisfeito, cai pro fallback
 * de pegar as 4 mais distantes sem checar espaçamento - sempre devolve exatamente 4. */
function findPotionSpots(maze: MazeState, heroStart: Vec, exclude: Set<string>): Vec[] {
  const dist = new Map<string, number>([[keyOf(heroStart), 0]]);
  const queue: Vec[] = [heroStart];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const d = dist.get(keyOf(cur))!;
    for (const dir of MONSTER_DIRECTIONS) {
      const next = stepFrom(cur, dir);
      if (!isPassable(maze, next)) continue;
      const k = keyOf(next);
      if (dist.has(k)) continue;
      dist.set(k, d + 1);
      queue.push(next);
    }
  }

  const candidates = Array.from(dist.entries())
    .filter(([k]) => k !== keyOf(heroStart) && !exclude.has(k))
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => {
      const [r, c] = k.split(",").map(Number);
      return { r, c };
    });

  const minSpacing = Math.floor(maze.cols / 2);
  const manhattan = (a: Vec, b: Vec) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);

  const spaced: Vec[] = [];
  for (const cand of candidates) {
    if (spaced.every((p) => manhattan(p, cand) >= minSpacing)) spaced.push(cand);
    if (spaced.length === 4) break;
  }
  if (spaced.length === 4) return spaced;
  return candidates.slice(0, 4);
}

export function createInitialState(rng: () => number): DungeonState {
  const generated = generatePerfectMaze(DUNGEON_SIZE, DUNGEON_SIZE, rng);
  const maze = braidMaze(generated, 0.35, rng);

  const heroStart: Vec = { r: 0, c: 0 };
  const monsterSpawns = findMonsterDen(maze);
  const spawnKeys = new Set(monsterSpawns.map(keyOf));
  const potions = findPotionSpots(maze, heroStart, spawnKeys);
  const potionKeys = new Set(potions.map(keyOf));

  const pellets = new Set<string>();
  for (let r = 0; r < maze.rows; r++) {
    for (let c = 0; c < maze.cols; c++) {
      const pos = { r, c };
      if (!isPassable(maze, pos)) continue;
      const k = keyOf(pos);
      if (k === keyOf(heroStart) || spawnKeys.has(k)) continue;
      pellets.add(k);
    }
  }
  // Poções contam como pellets especiais - também somem do set de "restantes" ao serem comidas.
  for (const k of potionKeys) pellets.add(k);

  const monsters: MonsterState[] = MONSTER_NAMES.map((name, i) => ({
    name,
    pos: monsterSpawns[i],
    dir: "down",
    mode: "chase",
  }));

  return {
    maze,
    hero: { pos: heroStart, dir: "right" },
    monsters,
    monsterSpawns,
    pellets,
    potions: potionKeys,
    totalPellets: pellets.size,
    score: 0,
    ticks: 0,
    frightenedTicks: 0,
    over: false,
    won: false,
  };
}

// --- funções puras de célula-alvo por papel, testáveis isoladamente ---

export function directTarget(heroPos: Vec): Vec {
  return { r: heroPos.r, c: heroPos.c };
}

export function ambushTarget(heroPos: Vec, heroDir: Dir): Vec {
  const d = DIR_DELTA[heroDir];
  return { r: heroPos.r + 4 * d.dr, c: heroPos.c + 4 * d.dc };
}

export function flankTarget(heroPos: Vec, heroDir: Dir, directMonsterPos: Vec): Vec {
  const d = DIR_DELTA[heroDir];
  const twoAhead: Vec = { r: heroPos.r + 2 * d.dr, c: heroPos.c + 2 * d.dc };
  const vector = { dr: twoAhead.r - directMonsterPos.r, dc: twoAhead.c - directMonsterPos.c };
  return { r: directMonsterPos.r + 2 * vector.dr, c: directMonsterPos.c + 2 * vector.dc };
}

export function retreatTarget(heroPos: Vec, monsterPos: Vec, retreatPoint: Vec): Vec {
  return euclideanDist(monsterPos, heroPos) > 8 ? { r: heroPos.r, c: heroPos.c } : { r: retreatPoint.r, c: retreatPoint.c };
}

export function euclideanDist(a: Vec, b: Vec): number {
  return Math.hypot(a.r - b.r, a.c - b.c);
}

/** Despacha por nome (especializados) ou sempre usa directTarget (gulosos). retreatPoint é sempre o
 * canto onde o herói nasce, usado como ponto fixo de recuo pela aranha. */
export function monsterTarget(name: MonsterName, ensemble: Ensemble, heroPos: Vec, heroDir: Dir, directMonsterPos: Vec, monsterPos: Vec, retreatPoint: Vec): Vec {
  if (ensemble === "gulosos") return directTarget(heroPos);
  switch (name) {
    case "fantasma":
      return directTarget(heroPos);
    case "limo":
      return ambushTarget(heroPos, heroDir);
    case "morcego":
      return flankTarget(heroPos, heroDir, directMonsterPos);
    case "aranha":
      return retreatTarget(heroPos, monsterPos, retreatPoint);
  }
}

function squaredDist(a: Vec, b: Vec): number {
  const dr = a.r - b.r;
  const dc = a.c - b.c;
  return dr * dr + dc * dc;
}

/** Vizinho legal não-reversão mais próximo do alvo, com desempate por MONSTER_DIRECTIONS. Reversão só
 * é permitida quando é o único movimento legal (beco sem saída). */
export function chooseMonsterMove(maze: MazeState, pos: Vec, dir: Dir, target: Vec): Dir {
  const neighbors = legalNeighbors(maze, pos);
  const nonReversal = neighbors.filter((n) => !isReversal(dir, n.dir));
  const candidates = nonReversal.length > 0 ? nonReversal : neighbors;
  let best: { dir: Dir; pos: Vec } | null = null;
  let bestDist = Infinity;
  for (const cand of candidates) {
    const d = squaredDist(cand.pos, target);
    if (d < bestDist) {
      bestDist = d;
      best = cand;
    }
  }
  return best ? best.dir : dir;
}

/** Movimento legal não-reversão uniformemente aleatório (reversão só se forçada). */
export function chooseFrightenedMove(maze: MazeState, pos: Vec, dir: Dir, rng: () => number): Dir {
  const neighbors = legalNeighbors(maze, pos);
  const nonReversal = neighbors.filter((n) => !isReversal(dir, n.dir));
  const candidates = nonReversal.length > 0 ? nonReversal : neighbors;
  if (candidates.length === 0) return dir;
  const idx = Math.floor(rng() * candidates.length) % candidates.length;
  return candidates[idx].dir;
}

export interface BfsPlan {
  direction: Dir | null;
  stats: { found: boolean; nodesExpanded: number; timeMs: number; pathLength: number };
}

/** BFS não-ponderada do zero a cada chamada, paredes como obstáculo, primeiro passo em direção ao
 * pellet/poção não-comido mais próximo por comprimento de caminho. Piloto automático neutro e cego a
 * perigo do herói. */
export function bfsPathDir(maze: MazeState, heroPos: Vec, pellets: Set<string>): BfsPlan {
  const start = performance.now();
  if (pellets.size === 0) {
    return { direction: null, stats: { found: false, nodesExpanded: 0, timeMs: performance.now() - start, pathLength: 0 } };
  }
  const startKey = keyOf(heroPos);
  const visited = new Set<string>([startKey]);
  const cameFrom = new Map<string, { dir: Dir; from: string }>();
  const queue: Vec[] = [heroPos];
  let nodesExpanded = 0;
  let goalKey: string | null = null;

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curKey = keyOf(cur);
    nodesExpanded++;
    if (pellets.has(curKey)) {
      goalKey = curKey;
      break;
    }
    for (const { dir, pos } of legalNeighbors(maze, cur)) {
      const k = keyOf(pos);
      if (visited.has(k)) continue;
      visited.add(k);
      cameFrom.set(k, { dir, from: curKey });
      queue.push(pos);
    }
  }

  if (goalKey === null) {
    return { direction: null, stats: { found: false, nodesExpanded, timeMs: performance.now() - start, pathLength: 0 } };
  }

  let cur = goalKey;
  let pathLength = 0;
  let firstDir: Dir | null = null;
  while (cur !== startKey) {
    const step = cameFrom.get(cur)!;
    firstDir = step.dir;
    cur = step.from;
    pathLength++;
  }

  return { direction: firstDir, stats: { found: true, nodesExpanded, timeMs: performance.now() - start, pathLength } };
}

export interface TickInput {
  /** Só consultado no modo "play". */
  playerDir?: Dir;
  /** Só consultado quando o piloto automático está ativo. */
  autopilot: boolean;
  ensemble: Ensemble;
}

function opposite(dir: Dir): Dir {
  switch (dir) {
    case "up":
      return "down";
    case "down":
      return "up";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}

function denCenter(monsterSpawns: Vec[]): Vec {
  const r = monsterSpawns.reduce((sum, p) => sum + p.r, 0) / monsterSpawns.length;
  const c = monsterSpawns.reduce((sum, p) => sum + p.c, 0) / monsterSpawns.length;
  return { r: Math.round(r), c: Math.round(c) };
}

/**
 * Um tick, na ordem: 1) resolve a direção do herói e o move, consome pellet/poção; 2) se uma poção
 * acabou de ser comida, vira todo monstro "chase" pra "frightened" com reversão forçada e seta
 * frightenedTicks; 3) pra cada monstro, calcula seu alvo (ou movimento aleatório se assustado, ou
 * mira o centro do covil se comido) e o move, virando "eaten" -> "chase" ao chegar perto do centro;
 * 4) resolve colisões entre a nova posição do herói e a de cada monstro; 5) decrementa
 * frightenedTicks e reverte monstros assustados expirados; 6) incrementa ticks; 7) checa vitória.
 */
export function tick(state: DungeonState, input: TickInput, rng: () => number): DungeonState {
  if (state.over || state.won) return state;

  // 1) move o herói
  let heroDir = state.hero.dir;
  if (input.autopilot) {
    const plan = bfsPathDir(state.maze, state.hero.pos, state.pellets);
    heroDir = plan.direction ?? state.hero.dir;
  } else if (input.playerDir) {
    const wanted = stepFrom(state.hero.pos, input.playerDir);
    if (isPassable(state.maze, wanted)) heroDir = input.playerDir;
  }
  let heroPos = stepFrom(state.hero.pos, heroDir);
  if (!isPassable(state.maze, heroPos)) {
    heroPos = state.hero.pos;
    heroDir = state.hero.dir;
  }

  const pellets = new Set(state.pellets);
  let score = state.score;
  const heroKey = keyOf(heroPos);
  const ateePotion = pellets.has(heroKey) && state.potions.has(heroKey);
  if (pellets.has(heroKey)) {
    pellets.delete(heroKey);
    score += ateePotion ? 50 : 10;
  }

  // 2) poção -> assusta os monstros "chase"
  let frightenedTicks = state.frightenedTicks;
  let monsters = state.monsters.map((m) => {
    if (ateePotion && m.mode === "chase") return { ...m, mode: "frightened" as MonsterMode, dir: opposite(m.dir) };
    return m;
  });
  if (ateePotion) frightenedTicks = FRIGHTENED_DURATION;

  // 3) move cada monstro
  const center = denCenter(state.monsterSpawns);
  const directMonster = monsters.find((m) => m.name === "fantasma")!;
  const retreatPoint: Vec = { r: 0, c: 0 };
  monsters = monsters.map((m) => {
    if (m.mode === "frightened") {
      const dir = chooseFrightenedMove(state.maze, m.pos, m.dir, rng);
      return { ...m, pos: stepFrom(m.pos, dir), dir };
    }
    if (m.mode === "eaten") {
      const dir = chooseMonsterMove(state.maze, m.pos, m.dir, center);
      const nextPos = stepFrom(m.pos, dir);
      const arrived = squaredDist(nextPos, center) <= 1;
      return { ...m, pos: nextPos, dir, mode: arrived ? ("chase" as MonsterMode) : m.mode };
    }
    const target = monsterTarget(m.name, input.ensemble, heroPos, heroDir, directMonster.pos, m.pos, retreatPoint);
    const dir = chooseMonsterMove(state.maze, m.pos, m.dir, target);
    return { ...m, pos: stepFrom(m.pos, dir), dir };
  });

  // 4) colisões
  let over: boolean = state.over;
  for (let i = 0; i < monsters.length; i++) {
    const m = monsters[i];
    if (m.pos.r === heroPos.r && m.pos.c === heroPos.c) {
      if (m.mode === "frightened") {
        monsters[i] = { ...m, mode: "eaten" };
        score += 200;
      } else if (m.mode === "chase") {
        over = true;
      }
    }
  }

  // 5) expira o modo assustado
  if (frightenedTicks > 0) {
    frightenedTicks -= 1;
    if (frightenedTicks === 0) {
      monsters = monsters.map((m) => (m.mode === "frightened" ? { ...m, mode: "chase" as MonsterMode, dir: opposite(m.dir) } : m));
    }
  }

  return {
    maze: state.maze,
    hero: { pos: heroPos, dir: heroDir },
    monsters,
    monsterSpawns: state.monsterSpawns,
    pellets,
    potions: state.potions,
    totalPellets: state.totalPellets,
    score,
    ticks: state.ticks + 1,
    frightenedTicks,
    over,
    won: !over && pellets.size === 0,
  };
}

