import { AlgorithmId, SearchProblem } from "./search";
import { PriorityQueue } from "./priority-queue";

/**
 * Step-by-step trace generator covering all 5 classic search algorithms - the same idea as
 * `lib/astar/trace.ts`'s `traceAstar` (a small duplicate of `search()`'s logic, purpose-built to
 * expose a live per-step snapshot that `search()` itself doesn't return), but unified into one
 * generator instead of five hand-copies, so a single UI can render "why did the algorithm pick this
 * node" for any of the 5 without branching per algorithm - it only needs to read `step.basis`.
 *
 * `astar/trace.ts` is deliberately left untouched: `/astar`'s page depends on `AstarStep`'s exact
 * shape, and duplicating a little logic here is the same trade-off that file already made for the
 * same reason (see its own header comment).
 *
 * UCS/Greedy/A* use "pop-then-check" (dequeue -> mark visited -> check isGoal -> yield), matching
 * `search()`'s own priority-queue branch exactly. BFS/DFS instead mirror `search()`'s early-exit
 * behavior for that branch (the goal is recognized the instant it's *generated* as a child, without
 * ever being popped/expanded) so `nodesExpanded`/`path`/`cost` match `search()` exactly for all 5
 * algorithms - then yield one extra, uncounted terminal step for the goal itself, so every algorithm
 * still ends on a clean, selectable isGoal:true frame for a decision-explanation timeline to land on.
 * See test/search-trace.test.ts for the cross-check against `search()`.
 */

export type FrontierBasis = "fifo" | "lifo" | "g" | "h" | "f";

const BASIS_BY_ALGORITHM: Record<AlgorithmId, FrontierBasis> = {
  bfs: "fifo",
  dfs: "lifo",
  ucs: "g",
  greedy: "h",
  astar: "f",
};

export interface TraceFrontierEntry<S> {
  state: S;
  g: number;
  h: number;
  f: number;
  depth: number;
}

export interface TraceStep<S> {
  index: number;
  current: S;
  g: number;
  h: number;
  f: number;
  depth: number;
  /** What this algorithm actually uses to pick the next node - the UI reads this once to decide
   *  which number to highlight and how the frontier list below is sorted. */
  basis: FrontierBasis;
  /** The frontier in the order this algorithm "sees" it: arrival order for fifo/lifo (index 0 is
   *  always the next node to be expanded), ascending g/h/f otherwise. */
  frontier: TraceFrontierEntry<S>[];
  visitedCount: number;
  isGoal: boolean;
}

export interface SearchTraceResult<S, A> {
  algorithm: AlgorithmId;
  found: boolean;
  path: S[];
  actions: A[];
  cost: number;
  nodesExpanded: number;
}

interface Node<S, A> {
  state: S;
  parent: Node<S, A> | null;
  action: A | null;
  g: number;
  depth: number;
}

function reconstruct<S, A>(node: Node<S, A>): { path: S[]; actions: A[] } {
  const path: S[] = [];
  const actions: A[] = [];
  let cur: Node<S, A> | null = node;
  while (cur) {
    path.push(cur.state);
    if (cur.action !== null) actions.push(cur.action);
    cur = cur.parent;
  }
  path.reverse();
  actions.reverse();
  return { path, actions };
}

export function* traceSearch<S, A>(
  problem: SearchProblem<S, A>,
  algorithm: AlgorithmId
): Generator<TraceStep<S>, SearchTraceResult<S, A>, void> {
  const heuristic = (s: S) => (problem.heuristic ? problem.heuristic(s) : 0);
  const basis = BASIS_BY_ALGORITHM[algorithm];
  const root: Node<S, A> = { state: problem.start, parent: null, action: null, g: 0, depth: 0 };

  const makeResult = (goalNode: Node<S, A> | null, nodesExpanded: number): SearchTraceResult<S, A> => {
    if (!goalNode) return { algorithm, found: false, path: [], actions: [], cost: 0, nodesExpanded };
    const { path, actions } = reconstruct(goalNode);
    return { algorithm, found: true, path, actions, cost: goalNode.g, nodesExpanded };
  };

  if (algorithm === "bfs" || algorithm === "dfs") {
    const visited = new Set<string>([problem.hash(root.state)]);
    const frontier: Node<S, A>[] = [root];
    let expandedCount = 0;

    // index 0 must always be "next to pop": shift() already reads index 0 for bfs, but pop() reads
    // the *last* element for dfs, so the snapshot is reversed only in that case.
    const snapshotFrontier = (): TraceFrontierEntry<S>[] => {
      const ordered = algorithm === "bfs" ? frontier : [...frontier].reverse();
      return ordered.map((n) => {
        const nh = heuristic(n.state);
        return { state: n.state, g: n.g, h: nh, f: n.g + nh, depth: n.depth };
      });
    };
    const stepFor = (node: Node<S, A>, isGoal: boolean, visitedCount: number): TraceStep<S> => {
      const h = heuristic(node.state);
      return {
        index: expandedCount - 1,
        current: node.state,
        g: node.g,
        h,
        f: node.g + h,
        depth: node.depth,
        basis,
        frontier: snapshotFrontier(),
        visitedCount,
        isGoal,
      };
    };

    if (problem.isGoal(root.state)) {
      yield stepFor(root, true, 0);
      return makeResult(root, 0);
    }

    while (frontier.length > 0) {
      const node = algorithm === "bfs" ? frontier.shift()! : frontier.pop()!;
      expandedCount++;

      // Mirrors search()'s exact early-exit: the goal is recognized the moment it's *generated*
      // here, without ever being pushed to the frontier or itself popped/expanded - matching
      // search()'s nodesExpanded/path/cost exactly (see this branch's header comment above).
      let goalChild: Node<S, A> | null = null;
      for (const { state, action, cost } of problem.neighbors(node.state)) {
        const key = problem.hash(state);
        if (visited.has(key)) continue;
        visited.add(key);
        const child: Node<S, A> = { state, parent: node, action, g: node.g + cost, depth: node.depth + 1 };
        if (problem.isGoal(state)) {
          goalChild = child;
          break;
        }
        frontier.push(child);
      }

      yield stepFor(node, false, expandedCount);

      if (goalChild) {
        yield stepFor(goalChild, true, expandedCount);
        return makeResult(goalChild, expandedCount);
      }
    }
    return makeResult(null, expandedCount);
  }

  // UCS / Greedy / A* share a priority-queue skeleton - same shape as traceAstar/search(), just with
  // priorityOf() generalized to whichever number this algorithm actually ranks by.
  const priorityOf = (node: Node<S, A>): number => {
    if (algorithm === "ucs") return node.g;
    const h = heuristic(node.state);
    if (algorithm === "greedy") return h;
    return node.g + h; // astar
  };

  const visited = new Set<string>();
  const bestG = new Map<string, number>([[problem.hash(root.state), 0]]);
  const pq = new PriorityQueue<Node<S, A>>();
  const frontierMap = new Map<string, Node<S, A>>();
  const pushNode = (node: Node<S, A>) => {
    pq.push(node, priorityOf(node));
    frontierMap.set(problem.hash(node.state), node);
  };
  pushNode(root);
  let expandedCount = 0;

  while (!pq.isEmpty()) {
    const node = pq.pop()!;
    const key = problem.hash(node.state);
    frontierMap.delete(key);
    if (visited.has(key)) continue; // stale entry - a cheaper path to this state already expanded
    visited.add(key);
    expandedCount++;

    const h = heuristic(node.state);
    const isGoal = problem.isGoal(node.state);

    // Children pushed BEFORE the snapshot below, so the yielded frontier shows what's actually
    // competing to be picked next as a result of expanding `node` (same ordering traceAstar uses).
    if (!isGoal) {
      for (const { state, action, cost } of problem.neighbors(node.state)) {
        const childKey = problem.hash(state);
        if (visited.has(childKey)) continue;
        const g = node.g + cost;
        const known = bestG.get(childKey);
        if (known !== undefined && known <= g) continue;
        bestG.set(childKey, g);
        pushNode({ state, parent: node, action, g, depth: node.depth + 1 });
      }
    }

    const frontierEntries: TraceFrontierEntry<S>[] = Array.from(frontierMap.values())
      .map((n) => {
        const nh = heuristic(n.state);
        return { state: n.state, g: n.g, h: nh, f: n.g + nh, depth: n.depth };
      })
      .sort((a, b) => {
        if (basis === "g") return a.g - b.g;
        if (basis === "h") return a.h - b.h;
        return a.f - b.f;
      });

    yield {
      index: expandedCount - 1,
      current: node.state,
      g: node.g,
      h,
      f: node.g + h,
      depth: node.depth,
      basis,
      frontier: frontierEntries,
      visitedCount: expandedCount,
      isGoal,
    };

    if (isGoal) return makeResult(node, expandedCount);
  }

  return makeResult(null, expandedCount);
}
