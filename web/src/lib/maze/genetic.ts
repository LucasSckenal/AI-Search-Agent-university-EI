import { GaOps } from "../core/genetic";
import { Direction, MazeState, TERRAIN_COST, idx, rc } from "./model";

export type MazeGenome = Direction[];

export interface MazeWalkResult {
  /** Ordered trail of cells visited, including repeats when a move is a no-op. */
  visitedCells: number[];
  finalCell: number;
  reachedGoal: boolean;
  cost: number;
  /** Genome index (1-based count) where the goal was reached; full genome length otherwise. */
  stepsUsed: number;
}

const DIR_DELTA: Record<Direction, [number, number]> = {
  N: [-1, 0],
  S: [1, 0],
  W: [0, -1],
  E: [0, 1],
  NE: [-1, 1],
  NW: [-1, -1],
  SE: [1, 1],
  SW: [1, -1],
};

const ORTHOGONAL: Direction[] = ["N", "S", "E", "W"];
const ALL_DIRECTIONS: Direction[] = ["N", "S", "E", "W", "NE", "NW", "SE", "SW"];

function manhattanDistance(maze: Pick<MazeState, "cols">, a: number, b: number): number {
  const [ar, ac] = rc(maze, a);
  const [br, bc] = rc(maze, b);
  return Math.abs(ar - br) + Math.abs(ac - bc);
}

/**
 * True maze-distance-to-goal for every cell, via one BFS from the goal (ignoring walls only where
 * the BFS itself can't pass them). Straight-line Manhattan distance is a *deceptive* fitness signal
 * in a maze: a cell can be geometrically close to the goal yet require a huge detour around walls to
 * actually reach, which stalls a naive GA in a local optimum right next to a wall it can never
 * cross. This field is computed once per maze/run (not per genome) and used as the real distance
 * term in fitness instead.
 */
export function buildGoalDistanceField(maze: MazeState, allowDiagonal: boolean): number[] {
  const field = new Array<number>(maze.cells.length).fill(Infinity);
  field[maze.goal] = 0;
  const queue: number[] = [maze.goal];
  const deltas = allowDiagonal ? Object.values(DIR_DELTA) : ORTHOGONAL.map((d) => DIR_DELTA[d]);
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const [r, c] = rc(maze, cur);
    for (const [dr, dc] of deltas) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= maze.rows || nc < 0 || nc >= maze.cols) continue;
      const ni = idx(maze, nr, nc);
      if (maze.cells[ni] === "wall" || field[ni] !== Infinity) continue;
      field[ni] = field[cur] + 1;
      queue.push(ni);
    }
  }
  return field;
}

function isPassable(maze: MazeState, r: number, c: number): boolean {
  return r >= 0 && r < maze.rows && c >= 0 && c < maze.cols && maze.cells[idx(maze, r, c)] !== "wall";
}

/**
 * Applies one move from `cur`. A move into a wall/off-grid, or a diagonal that would cut a wall
 * corner, is a no-op (stay in place) - shared by walking, initialization and mutation so all three
 * agree on exactly what a genome's genes mean.
 */
function stepFrom(maze: MazeState, cur: number, dir: Direction): { cell: number; cost: number } {
  const [r, c] = rc(maze, cur);
  const [dr, dc] = DIR_DELTA[dir];
  const nr = r + dr;
  const nc = c + dc;
  const isDiagonal = dr !== 0 && dc !== 0;
  const cuttingCorner = isDiagonal && !isPassable(maze, r + dr, c) && !isPassable(maze, r, c + dc);
  if (isPassable(maze, nr, nc) && !cuttingCorner) {
    const cell = idx(maze, nr, nc);
    return { cell, cost: TERRAIN_COST[maze.cells[cell]] };
  }
  return { cell: cur, cost: 0 };
}

/**
 * Walks a fixed-length sequence of moves from the maze's start cell (see `stepFrom` for what a
 * blocked move does). Stops the instant the goal is reached.
 */
export function walkChromosome(maze: MazeState, moves: Direction[]): MazeWalkResult {
  let cur = maze.start;
  const visitedCells: number[] = [cur];
  let cost = 0;

  if (cur === maze.goal) {
    return { visitedCells, finalCell: cur, reachedGoal: true, cost: 0, stepsUsed: 0 };
  }

  for (let i = 0; i < moves.length; i++) {
    const step = stepFrom(maze, cur, moves[i]);
    cur = step.cell;
    cost += step.cost;
    visitedCells.push(cur);
    if (cur === maze.goal) {
      return { visitedCells, finalCell: cur, reachedGoal: true, cost, stepsUsed: i + 1 };
    }
  }

  return { visitedCells, finalCell: cur, reachedGoal: false, cost, stepsUsed: moves.length };
}

/**
 * Higher is better: minimize remaining distance to goal, big bonus for reaching it, small cost
 * tiebreak. Pass a precomputed `distanceField` (buildGoalDistanceField) so the fitness landscape
 * accounts for walls instead of misleading straight-line proximity - callers evaluating many
 * genomes against the same maze (i.e. the GA loop) should always precompute and pass it in; the
 * plain Manhattan fallback is only for one-off calls with no field on hand.
 */
export function mazeFitness(maze: MazeState, moves: Direction[], distanceField?: number[]): number {
  const result = walkChromosome(maze, moves);
  const remaining = distanceField ? distanceField[result.finalCell] : manhattanDistance(maze, result.finalCell, maze.goal);
  let fitness = -remaining;
  if (result.reachedGoal) fitness += 1000;
  fitness -= result.cost * 0.01;
  return fitness;
}

export function chromosomeLength(maze: MazeState, lengthMultiplier: number): number {
  return Math.max(4, Math.ceil(manhattanDistance(maze, maze.start, maze.goal) * lengthMultiplier));
}

export interface MazeGaOptions {
  lengthMultiplier: number;
  allowDiagonal: boolean;
}

// Probability that a freshly-drawn gene (init or mutation) follows the goal-distance field downhill
// instead of picking a uniformly random direction. A maze's true solution path is a single narrow
// thread through many dead ends - measured empirically, pure-uniform-random genes essentially never
// find it even with large populations/generations (a perfect 19x27 maze failed to converge at
// population 300 / 600 generations). Biasing initialization and mutation toward locally-improving
// moves (a standard "heuristic-guided GA" technique) turns most of a genome into real progress
// instead of a random walk, while selection/crossover/mutation still do the actual evolving. 0.5 was
// chosen (over higher values that solve trivially in one step) by sweeping several perfect mazes:
// it's the highest value that still leaves the process genuinely stochastic - population fitness
// still visibly fluctuates generation to generation - while remaining reliable across most mazes
// within the default generation budget (a maze the GA still can't fully solve by the last generation
// is a legitimate, honest outcome, not a bug: GAs are heuristic search, not guaranteed-complete).
const DISTANCE_BIAS = 0.5;

export function buildMazeGaOps(maze: MazeState, options: MazeGaOptions): GaOps<MazeGenome> {
  const length = chromosomeLength(maze, options.lengthMultiplier);
  const directions = options.allowDiagonal ? ALL_DIRECTIONS : ORTHOGONAL;
  const distanceField = buildGoalDistanceField(maze, options.allowDiagonal);

  const randomDirection = (rng: () => number) => directions[Math.floor(rng() * directions.length)];

  /** Picks a direction from `cur`, usually the one(s) that most reduce distanceField, else uniform random. */
  const biasedDirection = (cur: number, rng: () => number): Direction => {
    if (rng() < DISTANCE_BIAS) {
      let best: Direction[] = [];
      let bestDist = Infinity;
      for (const d of directions) {
        const { cell } = stepFrom(maze, cur, d);
        if (cell === cur) continue; // blocked move, not a real option
        const dist = distanceField[cell];
        if (dist < bestDist) {
          best = [d];
          bestDist = dist;
        } else if (dist === bestDist) {
          best.push(d);
        }
      }
      if (best.length > 0) return best[Math.floor(rng() * best.length)];
    }
    return randomDirection(rng);
  };

  return {
    randomGenome: (rng) => {
      let cur = maze.start;
      return Array.from({ length }, () => {
        const dir = biasedDirection(cur, rng);
        cur = stepFrom(maze, cur, dir).cell;
        return dir;
      });
    },
    fitness: (genome) => mazeFitness(maze, genome, distanceField),
    mutate: (genome, rng, rate) => {
      let cur = maze.start;
      return genome.map((gene) => {
        const nextGene = rng() < rate ? biasedDirection(cur, rng) : gene;
        cur = stepFrom(maze, cur, nextGene).cell;
        return nextGene;
      });
    },
    // Single-point: a chromosome is a spatially ordered route, so cutting at one point preserves
    // each parent's route-prefix/suffix as a coherent chunk; uniform per-gene swap would scramble it.
    crossover: (a, b, rng) => {
      const cut = Math.floor(rng() * a.length);
      return a.slice(0, cut).concat(b.slice(cut));
    },
  };
}
