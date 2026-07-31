import { SearchProblem } from "../core/search";

/**
 * 2x2x2 "Pocket Cube" engine.
 *
 * Modeled with real 3D coordinates instead of hand-derived facelet-cycle tables, to avoid the
 * classic hand-rolled-cube-engine bug class (wrong twist direction on some move). Each of the 8
 * corners lives at a fixed slot (x,y,z) in {-1,+1}^3 and carries one sticker color per axis.
 * A quarter turn is a genuine 90 degree right-hand-rule rotation matrix applied to every corner
 * in the turned layer - both its position and which axis each of its sticker colors faces.
 *
 * Only U, R and F (plus their primes/doubles) are used as generators. Because those three layers
 * never touch the corner at (-1,-1,-1), that corner is naturally pinned - which is exactly what
 * removes the whole-cube-rotation redundancy from the state space (no separate canonicalization
 * needed). The reachable state count from this generator set is the well known pocket-cube figure
 * 3,674,160, which test/cube.test.ts verifies by exhaustive BFS.
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

type Axis = "x" | "y" | "z";
type Sign = -1 | 1;

interface Corner {
  pos: [number, number, number];
  stickers: Record<Axis, Color>;
}

export type CubeState = Corner[]; // length 8, order irrelevant (identified by pos)

function colorFor(axis: Axis, sign: Sign): Color {
  if (axis === "x") return sign === 1 ? 1 : 4; // R / L
  if (axis === "y") return sign === 1 ? 0 : 3; // U / D
  return sign === 1 ? 2 : 5; // F / B
}

export function solvedCube(): CubeState {
  const corners: Corner[] = [];
  for (const x of [-1, 1] as Sign[]) {
    for (const y of [-1, 1] as Sign[]) {
      for (const z of [-1, 1] as Sign[]) {
        corners.push({
          pos: [x, y, z],
          stickers: { x: colorFor("x", x), y: colorFor("y", y), z: colorFor("z", z) },
        });
      }
    }
  }
  return corners;
}

function cloneCube(cube: CubeState): CubeState {
  return cube.map((c) => ({ pos: [...c.pos] as [number, number, number], stickers: { ...c.stickers } }));
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

export type MoveId = "U" | "U'" | "U2" | "R" | "R'" | "R2" | "F" | "F'" | "F2";
export const ALL_MOVES: MoveId[] = ["U", "U'", "U2", "R", "R'", "R2", "F", "F'", "F2"];

const MOVE_AXIS: Record<MoveId, Axis> = {
  U: "y",
  "U'": "y",
  U2: "y",
  R: "x",
  "R'": "x",
  R2: "x",
  F: "z",
  "F'": "z",
  F2: "z",
};
const MOVE_TIMES: Record<MoveId, 1 | 2 | 3> = {
  U: 1,
  "U'": 3,
  U2: 2,
  R: 1,
  "R'": 3,
  R2: 2,
  F: 1,
  "F'": 3,
  F2: 2,
};

export function applyMove(cube: CubeState, move: MoveId): CubeState {
  let next = cube;
  const axis = MOVE_AXIS[move];
  const times = MOVE_TIMES[move];
  for (let i = 0; i < times; i++) next = quarterTurn(next, axis, 1);
  return next;
}

export function applyMoves(cube: CubeState, moves: MoveId[]): CubeState {
  return moves.reduce((c, m) => applyMove(c, m), cube);
}

export const INVERSE_MOVE: Record<MoveId, MoveId> = {
  U: "U'",
  "U'": "U",
  U2: "U2",
  R: "R'",
  "R'": "R",
  R2: "R2",
  F: "F'",
  "F'": "F",
  F2: "F2",
};

export function isSolved(cube: CubeState): boolean {
  return cube.every((c) => {
    const [x, y, z] = c.pos;
    return (
      c.stickers.x === colorFor("x", x as Sign) &&
      c.stickers.y === colorFor("y", y as Sign) &&
      c.stickers.z === colorFor("z", z as Sign)
    );
  });
}

function countMisplaced(cube: CubeState): number {
  let n = 0;
  for (const c of cube) {
    const [x, y, z] = c.pos;
    const ok =
      c.stickers.x === colorFor("x", x as Sign) &&
      c.stickers.y === colorFor("y", y as Sign) &&
      c.stickers.z === colorFor("z", z as Sign);
    if (!ok) n++;
  }
  return n;
}

export function hashCube(cube: CubeState): string {
  // Slot order is fixed by solvedCube()'s generation order, so position doesn't need to be in the key.
  const sorted = [...cube].sort((a, b) => a.pos[0] - b.pos[0] || a.pos[1] - b.pos[1] || a.pos[2] - b.pos[2]);
  let s = "";
  for (const c of sorted) s += c.stickers.x + "" + c.stickers.y + "" + c.stickers.z;
  return s;
}

export function generateScramble(length: number, rng: () => number = Math.random): MoveId[] {
  const axes: Axis[] = ["U", "R", "F"].map((m) => MOVE_AXIS[m as MoveId]);
  const suffixes: (1 | 2 | 3)[] = [1, 2, 3];
  const suffixLabel: Record<1 | 2 | 3, string> = { 1: "", 2: "2", 3: "'" };
  const moves: MoveId[] = [];
  let lastAxis: Axis | null = null;
  for (let i = 0; i < length; i++) {
    let axisIdx: number;
    do {
      axisIdx = Math.floor(rng() * axes.length);
    } while (axes[axisIdx] === lastAxis && axes.length > 1);
    lastAxis = axes[axisIdx];
    const base = (["U", "R", "F"] as const)[axisIdx];
    const suffix = suffixes[Math.floor(rng() * suffixes.length)];
    moves.push((base + suffixLabel[suffix]) as MoveId);
  }
  return moves;
}

export interface CubeProblemOptions {
  heuristicWeight?: number; // 0 disables heuristic (turns astar/greedy into ucs/dfs-like exploration)
}

/** Admissible heuristic: each move can fix at most 4 misplaced corners, so ceil(misplaced/4) never overestimates. */
export function cubeHeuristic(cube: CubeState): number {
  return Math.ceil(countMisplaced(cube) / 4);
}

export function buildCubeProblem(start: CubeState, options: CubeProblemOptions = {}): SearchProblem<CubeState, MoveId> {
  const weight = options.heuristicWeight ?? 1;
  return {
    start,
    isGoal: isSolved,
    hash: hashCube,
    heuristic: (s) => cubeHeuristic(s) * weight,
    neighbors: (s) => ALL_MOVES.map((m) => ({ state: applyMove(s, m), action: m, cost: 1 })),
  };
}

/** 24 facelets grouped per face, in reading order (row-major 2x2), for net rendering. */
export function faceletsByFace(cube: CubeState): Record<"U" | "R" | "F" | "D" | "L" | "B", Color[]> {
  const pick = (axis: Axis, sign: Sign, order: (c: Corner) => number) =>
    cube
      .filter((c) => c.pos[axis === "x" ? 0 : axis === "y" ? 1 : 2] === sign)
      .sort((a, b) => order(a) - order(b))
      .map((c) => c.stickers[axis]);

  // Order chosen so each face reads top-left,top-right,bottom-left,bottom-right in the net drawn
  // as: U above F; L, F, R, B in a row; D below F.
  return {
    U: pick("y", 1, (c) => -c.pos[2] * 2 + c.pos[0]), // back row first, then front row; left->right
    D: pick("y", -1, (c) => c.pos[2] * 2 + c.pos[0]),
    F: pick("z", 1, (c) => -c.pos[1] * 2 + c.pos[0]),
    B: pick("z", -1, (c) => -c.pos[1] * 2 - c.pos[0]),
    R: pick("x", 1, (c) => -c.pos[1] * 2 - c.pos[2]),
    L: pick("x", -1, (c) => -c.pos[1] * 2 + c.pos[2]),
  };
}
