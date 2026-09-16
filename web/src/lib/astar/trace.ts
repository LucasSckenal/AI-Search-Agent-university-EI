import { SearchProblem } from "../core/search";
import { PriorityQueue } from "../core/priority-queue";

/**
 * A* re-implemented as a step-by-step generator, purely for this explainer page - `core/search.ts`'s
 * `search()` (used by Labirinto and every other module) stays untouched, since it only returns the
 * final result plus a flat `exploredOrder`, not a live snapshot of the priority queue at each step.
 * That snapshot - "here is every node currently waiting, sorted by f = g + h, and here's the one A*
 * is about to expand" - is the actual teaching moment for this algorithm, so it's worth a small
 * duplicate of `search()`'s astar branch rather than approximating it from `exploredOrder` alone.
 */

export interface AstarFrontierEntry<S> {
  state: S;
  g: number;
  h: number;
  f: number;
}

export interface AstarStep<S> {
  current: S;
  g: number;
  h: number;
  f: number;
  depth: number;
  /** Every node waiting in the priority queue right after `current` was popped, sorted by f ascending
   *  (index 0 is whichever node A* will expand next). */
  frontier: AstarFrontierEntry<S>[];
  visitedCount: number;
  isGoal: boolean;
}

export interface AstarTraceResult<S, A> {
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

export function* traceAstar<S, A>(
  problem: SearchProblem<S, A>
): Generator<AstarStep<S>, AstarTraceResult<S, A>, void> {
  const heuristic = (s: S) => (problem.heuristic ? problem.heuristic(s) : 0);

  const root: Node<S, A> = { state: problem.start, parent: null, action: null, g: 0, depth: 0 };
  const visited = new Set<string>();
  const bestG = new Map<string, number>();
  bestG.set(problem.hash(root.state), 0);

  const pq = new PriorityQueue<Node<S, A>>();
  // PriorityQueue has no way to list its contents, so this map mirrors it in parallel just for the
  // per-step frontier snapshot - keyed by state hash, always holding the cheapest known node for
  // that state (stale duplicates left behind by a cheaper re-push are simply overwritten here too).
  const frontierMap = new Map<string, Node<S, A>>();
  const pushNode = (node: Node<S, A>) => {
    pq.push(node, node.g + heuristic(node.state));
    frontierMap.set(problem.hash(node.state), node);
  };
  pushNode(root);

  while (!pq.isEmpty()) {
    const node = pq.pop()!;
    const key = problem.hash(node.state);
    frontierMap.delete(key);
    if (visited.has(key)) continue; // stale entry - a cheaper path to this state already expanded
    visited.add(key);

    const h = heuristic(node.state);
    const isGoal = problem.isGoal(node.state);

    // Children are pushed BEFORE the snapshot below, so the yielded frontier shows what's actually
    // competing to be picked next as a result of expanding `node` - not the stale queue state from
    // one step earlier, which would make an already-expanded node's own children invisible on the
    // very step that created them.
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

    const frontier: AstarFrontierEntry<S>[] = Array.from(frontierMap.values())
      .map((n) => {
        const nh = heuristic(n.state);
        return { state: n.state, g: n.g, h: nh, f: n.g + nh };
      })
      .sort((a, b) => a.f - b.f);

    yield { current: node.state, g: node.g, h, f: node.g + h, depth: node.depth, frontier, visitedCount: visited.size, isGoal };

    if (isGoal) {
      const { path, actions } = reconstruct(node);
      return { found: true, path, actions, cost: node.g, nodesExpanded: visited.size };
    }
  }

  return { found: false, path: [], actions: [], cost: 0, nodesExpanded: visited.size };
}
