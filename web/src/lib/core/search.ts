import { PriorityQueue } from "./priority-queue";

/** Generic problem definition consumed by every classic search algorithm below. */
export interface SearchProblem<S, A> {
  start: S;
  isGoal(state: S): boolean;
  neighbors(state: S): { state: S; action: A; cost: number }[];
  /** Admissible heuristic estimate to the goal. Required for greedy/astar. */
  heuristic?: (state: S) => number;
  /** Stable string key for a state, used for visited-set deduplication. */
  hash: (state: S) => string;
}

export type AlgorithmId = "bfs" | "dfs" | "ucs" | "greedy" | "astar";

export const ALGORITHM_LABELS: Record<AlgorithmId, string> = {
  bfs: "Busca em Largura (BFS)",
  dfs: "Busca em Profundidade (DFS)",
  ucs: "Custo Uniforme (UCS/Dijkstra)",
  greedy: "Gulosa (Greedy Best-First)",
  astar: "A*",
};

interface InternalNode<S, A> {
  state: S;
  parent: InternalNode<S, A> | null;
  action: A | null;
  g: number;
  depth: number;
}

export interface SearchStep<S> {
  state: S;
  frontierSize: number;
}

export interface SearchResult<S, A> {
  algorithm: AlgorithmId;
  found: boolean;
  path: S[];
  actions: A[];
  cost: number;
  nodesExpanded: number;
  nodesGenerated: number;
  maxFrontierSize: number;
  timeMs: number;
  exploredOrder: S[];
  truncated: boolean;
}

function reconstruct<S, A>(node: InternalNode<S, A>): { path: S[]; actions: A[] } {
  const path: S[] = [];
  const actions: A[] = [];
  let cur: InternalNode<S, A> | null = node;
  while (cur) {
    path.push(cur.state);
    if (cur.action !== null) actions.push(cur.action);
    cur = cur.parent;
  }
  path.reverse();
  actions.reverse();
  return { path, actions };
}

export interface SearchOptions {
  /** Safety cap on expansions so pathological cases (e.g. huge state spaces) don't hang the UI. */
  maxNodes?: number;
}

/**
 * Runs one of the five classic search algorithms against a problem definition.
 * BFS/UCS/Greedy/A* are graph-search (visited-set) variants; DFS is graph-search too
 * (to keep it terminating on cyclic state spaces) which trades optimality for that guarantee.
 */
export function search<S, A>(
  problem: SearchProblem<S, A>,
  algorithm: AlgorithmId,
  options: SearchOptions = {}
): SearchResult<S, A> {
  const maxNodes = options.maxNodes ?? 500_000;
  const t0 = performance.now();

  const root: InternalNode<S, A> = { state: problem.start, parent: null, action: null, g: 0, depth: 0 };
  const visited = new Set<string>();
  const exploredOrder: S[] = [];
  let nodesExpanded = 0;
  let nodesGenerated = 1;
  let maxFrontierSize = 1;
  let truncated = false;

  const finish = (goalNode: InternalNode<S, A> | null): SearchResult<S, A> => {
    const timeMs = performance.now() - t0;
    if (!goalNode) {
      return {
        algorithm,
        found: false,
        path: [],
        actions: [],
        cost: 0,
        nodesExpanded,
        nodesGenerated,
        maxFrontierSize,
        timeMs,
        exploredOrder,
        truncated,
      };
    }
    const { path, actions } = reconstruct(goalNode);
    return {
      algorithm,
      found: true,
      path,
      actions,
      cost: goalNode.g,
      nodesExpanded,
      nodesGenerated,
      maxFrontierSize,
      timeMs,
      exploredOrder,
      truncated,
    };
  };

  if (problem.isGoal(root.state)) {
    exploredOrder.push(root.state);
    return finish(root);
  }

  if (algorithm === "bfs" || algorithm === "dfs") {
    const frontier: InternalNode<S, A>[] = [root];
    visited.add(problem.hash(root.state));
    while (frontier.length > 0) {
      maxFrontierSize = Math.max(maxFrontierSize, frontier.length);
      const node = algorithm === "bfs" ? frontier.shift()! : frontier.pop()!;
      nodesExpanded++;
      exploredOrder.push(node.state);
      if (nodesExpanded > maxNodes) {
        truncated = true;
        return finish(null);
      }
      for (const { state, action, cost } of problem.neighbors(node.state)) {
        const key = problem.hash(state);
        if (visited.has(key)) continue;
        visited.add(key);
        nodesGenerated++;
        const child: InternalNode<S, A> = { state, parent: node, action, g: node.g + cost, depth: node.depth + 1 };
        if (problem.isGoal(state)) {
          exploredOrder.push(state);
          return finish(child);
        }
        frontier.push(child);
      }
    }
    return finish(null);
  }

  // UCS / Greedy / A* share a priority-queue skeleton, differing only in priority function.
  const priorityOf = (node: InternalNode<S, A>): number => {
    if (algorithm === "ucs") return node.g;
    const h = problem.heuristic ? problem.heuristic(node.state) : 0;
    if (algorithm === "greedy") return h;
    return node.g + h; // astar
  };

  const pq = new PriorityQueue<InternalNode<S, A>>();
  pq.push(root, priorityOf(root));
  const bestG = new Map<string, number>();
  bestG.set(problem.hash(root.state), 0);

  while (!pq.isEmpty()) {
    maxFrontierSize = Math.max(maxFrontierSize, pq.size);
    const node = pq.pop()!;
    const key = problem.hash(node.state);
    // Skip stale entries (a cheaper path to this state was already expanded).
    if (visited.has(key)) continue;
    visited.add(key);
    nodesExpanded++;
    exploredOrder.push(node.state);
    if (nodesExpanded > maxNodes) {
      truncated = true;
      return finish(null);
    }
    if (problem.isGoal(node.state)) {
      return finish(node);
    }
    for (const { state, action, cost } of problem.neighbors(node.state)) {
      const childKey = problem.hash(state);
      if (visited.has(childKey)) continue;
      const g = node.g + cost;
      const known = bestG.get(childKey);
      if (known !== undefined && known <= g) continue;
      bestG.set(childKey, g);
      nodesGenerated++;
      const child: InternalNode<S, A> = { state, parent: node, action, g, depth: node.depth + 1 };
      pq.push(child, priorityOf(child));
    }
  }

  return finish(null);
}
