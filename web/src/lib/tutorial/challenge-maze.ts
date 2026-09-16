import { createEmptyMaze, idx, MazeState } from "@/lib/maze/model";

/**
 * Hand-curated maze for the tutorial's final challenge (step 08) - not randomly generated, because
 * the cost-vs-distance trade-off needs to be visually unambiguous: a short straight corridor through
 * mud (favored by step-counting BFS/Greedy) against a longer detour of cheap empty cells (favored by
 * cost-aware UCS/A*), so running more than one algorithm on it visibly disagrees on "the best path".
 *
 * A wall column splits the grid in two, crossable in exactly three places: a direct route straight
 * through the middle (row 4) paved with 3 mud cells, and two symmetric detours around the top (row 0)
 * and bottom (row 8) edges, entirely on cheap empty cells.
 *   direct route:  8 steps, cost = 5·1 + 3·5 = 20
 *   detour route: 16 steps, cost = 16·1 = 16
 */
export function buildChallengeMaze(): MazeState {
  const maze: MazeState = createEmptyMaze(9, 9);

  for (const r of [1, 2, 3, 5, 6, 7]) {
    maze.cells[idx(maze, r, 4)] = "wall";
  }
  for (const c of [3, 4, 5]) {
    maze.cells[idx(maze, 4, c)] = "mud";
  }

  maze.start = idx(maze, 4, 0);
  maze.goal = idx(maze, 4, 8);

  return maze;
}
