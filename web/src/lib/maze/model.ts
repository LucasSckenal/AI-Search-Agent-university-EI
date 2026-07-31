import { SearchProblem } from "../core/search";

export type CellKind = "empty" | "wall" | "mud";

export const TERRAIN_COST: Record<CellKind, number> = {
  empty: 1,
  wall: Infinity,
  mud: 5,
};

export type HeuristicId = "manhattan" | "euclidean" | "chebyshev" | "octile";

export interface MazeState {
  rows: number;
  cols: number;
  cells: CellKind[]; // flattened rows*cols, index = r*cols+c
  start: number; // index
  goal: number; // index
}

export function idx(maze: Pick<MazeState, "cols">, r: number, c: number): number {
  return r * maze.cols + c;
}

export function rc(maze: Pick<MazeState, "cols">, i: number): [number, number] {
  return [Math.floor(i / maze.cols), i % maze.cols];
}

export function createEmptyMaze(rows: number, cols: number): MazeState {
  return {
    rows,
    cols,
    cells: new Array(rows * cols).fill("empty"),
    start: idx({ cols }, 0, 0),
    goal: idx({ cols }, rows - 1, cols - 1),
  };
}

/** Classic recursive-backtracker perfect maze (one unique path between any two cells). */
export function generatePerfectMaze(rows: number, cols: number, rng: () => number = Math.random): MazeState {
  const r2 = rows % 2 === 1 ? rows : rows + 1;
  const c2 = cols % 2 === 1 ? cols : cols + 1;
  const maze = createEmptyMaze(r2, c2);
  maze.cells.fill("wall");

  const visited = new Array(r2 * c2).fill(false);
  const stack: [number, number][] = [[0, 0]];
  visited[idx(maze, 0, 0)] = true;
  maze.cells[idx(maze, 0, 0)] = "empty";

  const dirs = [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
  ];

  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1];
    const options: [number, number, number, number][] = [];
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < r2 && nc >= 0 && nc < c2 && !visited[idx(maze, nr, nc)]) {
        options.push([nr, nc, r + dr / 2, c + dc / 2]);
      }
    }
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const [nr, nc, wr, wc] = options[Math.floor(rng() * options.length)];
    visited[idx(maze, nr, nc)] = true;
    maze.cells[idx(maze, nr, nc)] = "empty";
    maze.cells[idx(maze, wr, wc)] = "empty";
    stack.push([nr, nc]);
  }

  maze.start = idx(maze, 0, 0);
  maze.goal = idx(maze, r2 - 1, c2 - 1);
  // Sprinkle a little weighted terrain on open cells for UCS/A* to demonstrate cost tradeoffs.
  for (let i = 0; i < maze.cells.length; i++) {
    if (maze.cells[i] === "empty" && i !== maze.start && i !== maze.goal && rng() < 0.08) {
      maze.cells[i] = "mud";
    }
  }
  return maze;
}

/** Random obstacle field, regenerated until start/goal are connected. */
export function generateRandomMaze(
  rows: number,
  cols: number,
  wallDensity: number,
  rng: () => number = Math.random
): MazeState {
  for (let attempt = 0; attempt < 60; attempt++) {
    const maze = createEmptyMaze(rows, cols);
    for (let i = 0; i < maze.cells.length; i++) {
      if (i === maze.start || i === maze.goal) continue;
      const roll = rng();
      maze.cells[i] = roll < wallDensity ? "wall" : roll < wallDensity + 0.1 ? "mud" : "empty";
    }
    if (isConnected(maze)) return maze;
  }
  // Fallback: guaranteed-solvable perfect maze if random generation kept failing.
  return generatePerfectMaze(rows, cols, rng);
}

function isConnected(maze: MazeState): boolean {
  const seen = new Array(maze.cells.length).fill(false);
  const q = [maze.start];
  seen[maze.start] = true;
  while (q.length) {
    const cur = q.shift()!;
    if (cur === maze.goal) return true;
    const [r, c] = rc(maze, cur);
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= maze.rows || nc < 0 || nc >= maze.cols) continue;
      const ni = idx(maze, nr, nc);
      if (seen[ni] || maze.cells[ni] === "wall") continue;
      seen[ni] = true;
      q.push(ni);
    }
  }
  return false;
}

export type Direction = "N" | "S" | "E" | "W" | "NE" | "NW" | "SE" | "SW";

const SQRT2 = Math.SQRT2;

function heuristicFn(id: HeuristicId, allowDiagonal: boolean) {
  return (dr: number, dc: number): number => {
    const adr = Math.abs(dr);
    const adc = Math.abs(dc);
    switch (id) {
      case "manhattan":
        return adr + adc;
      case "euclidean":
        return Math.sqrt(adr * adr + adc * adc);
      case "chebyshev":
        return Math.max(adr, adc);
      case "octile":
        return allowDiagonal ? Math.max(adr, adc) + (SQRT2 - 1) * Math.min(adr, adc) : adr + adc;
    }
  };
}

export interface MazeProblemOptions {
  allowDiagonal: boolean;
  heuristic: HeuristicId;
}

export function buildMazeProblem(maze: MazeState, options: MazeProblemOptions): SearchProblem<number, Direction> {
  const [gr, gc] = rc(maze, maze.goal);
  const h = heuristicFn(options.heuristic, options.allowDiagonal);

  const orthogonal: [number, number, Direction][] = [
    [-1, 0, "N"],
    [1, 0, "S"],
    [0, -1, "W"],
    [0, 1, "E"],
  ];
  const diagonal: [number, number, Direction][] = [
    [-1, -1, "NW"],
    [-1, 1, "NE"],
    [1, -1, "SW"],
    [1, 1, "SE"],
  ];

  return {
    start: maze.start,
    isGoal: (s) => s === maze.goal,
    hash: (s) => String(s),
    heuristic: (s) => {
      const [r, c] = rc(maze, s);
      return h(gr - r, gc - c);
    },
    neighbors: (s) => {
      const [r, c] = rc(maze, s);
      const out: { state: number; action: Direction; cost: number }[] = [];
      const passable = (rr: number, cc: number) =>
        rr >= 0 && rr < maze.rows && cc >= 0 && cc < maze.cols && maze.cells[idx(maze, rr, cc)] !== "wall";

      for (const [dr, dc, dir] of orthogonal) {
        const nr = r + dr;
        const nc = c + dc;
        if (!passable(nr, nc)) continue;
        out.push({ state: idx(maze, nr, nc), action: dir, cost: TERRAIN_COST[maze.cells[idx(maze, nr, nc)]] });
      }
      if (options.allowDiagonal) {
        for (const [dr, dc, dir] of diagonal) {
          const nr = r + dr;
          const nc = c + dc;
          if (!passable(nr, nc)) continue;
          // Prevent cutting across a wall corner.
          if (!passable(r + dr, c) && !passable(r, c + dc)) continue;
          out.push({
            state: idx(maze, nr, nc),
            action: dir,
            cost: TERRAIN_COST[maze.cells[idx(maze, nr, nc)]] * SQRT2,
          });
        }
      }
      return out;
    },
  };
}
