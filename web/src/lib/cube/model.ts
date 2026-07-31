import { SearchProblem } from "../core/search";

/**
 * N x N x N Rubik's-cube-family engine (currently offered as 2x2 "Pocket Cube" and standard 3x3).
 *
 * Modeled with real 3D coordinates instead of hand-derived facelet-cycle tables, to avoid the
 * classic hand-rolled-cube-engine bug class (wrong twist direction on some move). Every piece
 * (corner, edge or center) lives at a fixed slot (x,y,z) and carries one sticker color per axis
 * it has a nonzero coordinate on - a corner has 3 (all coords nonzero), an edge has 2, a center
 * has 1, and the invisible core piece (3x3 only, all coords zero) is skipped entirely.
 *
 * A quarter turn is a genuine 90 degree right-hand-rule rotation matrix applied to every piece in
 * the turned layer - both its position and which axis each of its sticker colors faces. The same
 * transform naturally leaves centers in place (they sit ON their face's rotation axis) and moves
 * edges/corners correctly, without any size-specific branching - see test/cube.test.ts.
 *
 * The 2x2 uses only U, R and F (plus primes/doubles) as generators: because those three layers
 * never touch the corner at (-1,-1,-1), that corner is naturally pinned, which removes the
 * whole-cube-rotation redundancy from the state space without separate canonicalization. The
 * reachable state count from that generator set is the well known pocket-cube figure 3,674,160,
 * verified by exhaustive BFS in test/cube.test.ts. The 3x3 has fixed centers that already anchor
 * orientation, so it needs all six face generators (U/D/L/R/F/B) to reach every legal state; its
 * space (~4.3x10^19 states) is far too large to search blindly, which is the whole point of
 * comparing BFS/UCS against A* and Greedy on it.
 */

export type Color = 0 | 1 | 2 | 3 | 4 | 5; // U R F D L B
export const COLOR_NAMES = ["U", "R", "F", "D", "L", "B"] as const;
export const COLOR_HEX: Record<Color, string> = {
  0: "#e7e9f2", // U - white-ish
  1: "#528dff", // R - blue
  2: "#3ecf6a", // F - green
  3: "#ffd166", // D - yellow
  4: "#ff8b3d", // L - orange
  5: "#ff4d6d", // B - red
};

export type CubeSize = 2 | 3;

type Axis = "x" | "y" | "z";
type Sign = -1 | 1;

export interface Piece {
  /** Stable per-piece identity, unaffected by moves - only pos/stickers change. Lets UI code
   *  (e.g. React keys during 3D animation) track "the same physical piece" across state updates. */
  id: number;
  pos: [number, number, number];
  /** Only axes with a nonzero position coordinate have a sticker (that's the axis facing outward). */
  stickers: Partial<Record<Axis, Color>>;
}

export type CubeState = Piece[];

function colorFor(axis: Axis, sign: Sign): Color {
  if (axis === "x") return sign === 1 ? 1 : 4; // R / L
  if (axis === "y") return sign === 1 ? 0 : 3; // U / D
  return sign === 1 ? 2 : 5; // F / B
}

function coordsForSize(size: CubeSize): number[] {
  return size === 2 ? [-1, 1] : [-1, 0, 1];
}

export function solvedCube(size: CubeSize = 2): CubeState {
  const pieces: Piece[] = [];
  let id = 0;
  const coords = coordsForSize(size);
  for (const x of coords) {
    for (const y of coords) {
      for (const z of coords) {
        if (x === 0 && y === 0 && z === 0) continue; // invisible core (3x3 only)
        const stickers: Partial<Record<Axis, Color>> = {};
        if (x !== 0) stickers.x = colorFor("x", x as Sign);
        if (y !== 0) stickers.y = colorFor("y", y as Sign);
        if (z !== 0) stickers.z = colorFor("z", z as Sign);
        pieces.push({ id: id++, pos: [x, y, z], stickers });
      }
    }
  }
  return pieces;
}

function cloneCube(cube: CubeState): CubeState {
  return cube.map((c) => ({ id: c.id, pos: [...c.pos] as [number, number, number], stickers: { ...c.stickers } }));
}

/** One quarter turn (right-hand-rule, 90 degrees) of the layer where position[axis] === layerSign. */
function quarterTurn(cube: CubeState, axis: Axis, layerSign: Sign): CubeState {
  const next = cloneCube(cube);
  for (const c of next) {
    const [x, y, z] = c.pos;
    if (axis === "x" && x === layerSign) {
      c.pos = [x, -z, y];
      const t = c.stickers.y;
      c.stickers.y = c.stickers.z;
      c.stickers.z = t;
    } else if (axis === "y" && y === layerSign) {
      c.pos = [z, y, -x];
      const t = c.stickers.x;
      c.stickers.x = c.stickers.z;
      c.stickers.z = t;
    } else if (axis === "z" && z === layerSign) {
      c.pos = [-y, x, z];
      const t = c.stickers.x;
      c.stickers.x = c.stickers.y;
      c.stickers.y = t;
    }
  }
  return next;
}

export type MoveId =
  | "U" | "U'" | "U2"
  | "D" | "D'" | "D2"
  | "L" | "L'" | "L2"
  | "R" | "R'" | "R2"
  | "F" | "F'" | "F2"
  | "B" | "B'" | "B2";

/** 2x2 uses only U/R/F (see module doc for why); 3x3 needs all six faces. */
export const MOVES_2X2: MoveId[] = ["U", "U'", "U2", "R", "R'", "R2", "F", "F'", "F2"];
export const MOVES_3X3: MoveId[] = [
  "U", "U'", "U2", "D", "D'", "D2",
  "L", "L'", "L2", "R", "R'", "R2",
  "F", "F'", "F2", "B", "B'", "B2",
];

export function movesForSize(size: CubeSize): MoveId[] {
  return size === 2 ? MOVES_2X2 : MOVES_3X3;
}

/** Every move's fixed number of misplaceable pieces per turn (see cubeHeuristic). */
export function piecesPerMove(size: CubeSize): number {
  return size === 2 ? 4 : 8; // 3x3: 4 corners + 4 edges per layer; the layer's center never moves
}

const BASE_AXIS: Record<"U" | "D" | "L" | "R" | "F" | "B", Axis> = {
  U: "y",
  D: "y",
  L: "x",
  R: "x",
  F: "z",
  B: "z",
};
const BASE_SIGN: Record<"U" | "D" | "L" | "R" | "F" | "B", Sign> = {
  U: 1,
  D: -1,
  L: -1,
  R: 1,
  F: 1,
  B: -1,
};

function baseFace(move: MoveId): "U" | "D" | "L" | "R" | "F" | "B" {
  return move[0] as "U" | "D" | "L" | "R" | "F" | "B";
}

export const MOVE_AXIS: Record<MoveId, Axis> = Object.fromEntries(
  [...MOVES_3X3].map((m) => [m, BASE_AXIS[baseFace(m)]])
) as Record<MoveId, Axis>;

export const MOVE_LAYER_SIGN: Record<MoveId, Sign> = Object.fromEntries(
  [...MOVES_3X3].map((m) => [m, BASE_SIGN[baseFace(m)]])
) as Record<MoveId, Sign>;

const MOVE_TIMES: Record<MoveId, 1 | 2 | 3> = Object.fromEntries(
  MOVES_3X3.map((m) => [m, m.endsWith("2") ? 2 : m.endsWith("'") ? 3 : 1])
) as Record<MoveId, 1 | 2 | 3>;

export function applyMove(cube: CubeState, move: MoveId): CubeState {
  let next = cube;
  const axis = MOVE_AXIS[move];
  const sign = MOVE_LAYER_SIGN[move];
  const times = MOVE_TIMES[move];
  for (let i = 0; i < times; i++) next = quarterTurn(next, axis, sign);
  return next;
}

export function applyMoves(cube: CubeState, moves: MoveId[]): CubeState {
  return moves.reduce((c, m) => applyMove(c, m), cube);
}

/**
 * Axis, layer sign and signed radian angle for animating `move` as a single visual rotation.
 * `applyMove` physically replays `times` separate +90 degree turns (matching the right-hand-rule
 * engine above), but a UI only needs the net, shortest-path rotation to end up at the identical
 * final state - e.g. a "times: 3" move (U') is animated as one -90 degree turn instead of three.
 */
export function moveAxisSignAngle(move: MoveId): { axis: Axis; layerSign: Sign; angle: number } {
  const times = MOVE_TIMES[move];
  const angle = times === 1 ? Math.PI / 2 : times === 2 ? Math.PI : -Math.PI / 2;
  return { axis: MOVE_AXIS[move], layerSign: MOVE_LAYER_SIGN[move], angle };
}

export const INVERSE_MOVE: Record<MoveId, MoveId> = Object.fromEntries(
  MOVES_3X3.map((m) => [m, (m.endsWith("2") ? m : m.endsWith("'") ? m.slice(0, -1) : m + "'") as MoveId])
) as Record<MoveId, MoveId>;

function stickersMatch(c: Piece): boolean {
  const [x, y, z] = c.pos;
  if (c.stickers.x !== undefined && c.stickers.x !== colorFor("x", x as Sign)) return false;
  if (c.stickers.y !== undefined && c.stickers.y !== colorFor("y", y as Sign)) return false;
  if (c.stickers.z !== undefined && c.stickers.z !== colorFor("z", z as Sign)) return false;
  return true;
}

export function isSolved(cube: CubeState): boolean {
  return cube.every(stickersMatch);
}

function countMisplaced(cube: CubeState): number {
  let n = 0;
  for (const c of cube) if (!stickersMatch(c)) n++;
  return n;
}

export function hashCube(cube: CubeState): string {
  // Slot order is fixed by solvedCube()'s generation order, so position doesn't need to be in the key.
  const sorted = [...cube].sort((a, b) => a.pos[0] - b.pos[0] || a.pos[1] - b.pos[1] || a.pos[2] - b.pos[2]);
  let s = "";
  for (const c of sorted) s += (c.stickers.x ?? "_") + "" + (c.stickers.y ?? "_") + "" + (c.stickers.z ?? "_") + "|";
  return s;
}

export function generateScramble(length: number, size: CubeSize = 2, rng: () => number = Math.random): MoveId[] {
  const faces: ("U" | "D" | "L" | "R" | "F" | "B")[] = size === 2 ? ["U", "R", "F"] : ["U", "D", "L", "R", "F", "B"];
  const suffixes: (1 | 2 | 3)[] = [1, 2, 3];
  const suffixLabel: Record<1 | 2 | 3, string> = { 1: "", 2: "2", 3: "'" };
  const moves: MoveId[] = [];
  let lastAxis: Axis | null = null;
  for (let i = 0; i < length; i++) {
    let faceIdx: number;
    do {
      faceIdx = Math.floor(rng() * faces.length);
    } while (BASE_AXIS[faces[faceIdx]] === lastAxis && faces.length > 1);
    const face = faces[faceIdx];
    lastAxis = BASE_AXIS[face];
    const suffix = suffixes[Math.floor(rng() * suffixes.length)];
    moves.push((face + suffixLabel[suffix]) as MoveId);
  }
  return moves;
}

export interface CubeProblemOptions {
  heuristicWeight?: number; // 0 disables heuristic (turns astar/greedy into ucs/dfs-like exploration)
}

/** Admissible: each move can fix at most `piecesPerMove(size)` misplaced pieces, so this never overestimates. */
export function cubeHeuristic(cube: CubeState, size: CubeSize): number {
  return Math.ceil(countMisplaced(cube) / piecesPerMove(size));
}

export function buildCubeProblem(
  start: CubeState,
  size: CubeSize = 2,
  options: CubeProblemOptions = {}
): SearchProblem<CubeState, MoveId> {
  const weight = options.heuristicWeight ?? 1;
  const moves = movesForSize(size);
  return {
    start,
    isGoal: isSolved,
    hash: hashCube,
    heuristic: (s) => cubeHeuristic(s, size) * weight,
    neighbors: (s) => moves.map((m) => ({ state: applyMove(s, m), action: m, cost: 1 })),
  };
}
