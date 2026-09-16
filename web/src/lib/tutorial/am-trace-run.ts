import { Board, GameConfig, Player } from "@/lib/game/model";
import { traceMinimax, MinimaxNode, MinimaxTraceResult } from "@/lib/minimax/trace";

export interface MinimaxTrace {
  nodes: MinimaxNode[];
  result: MinimaxTraceResult;
}

/** Drains traceMinimax() into a plain array + final result, the same pattern app/minimax/page.tsx
 *  already uses inline - pulled out here so both the tutorial's simulation stage and its decision
 *  timeline can share one real trace instead of computing it twice. */
export function runMinimaxTrace(board: Board, player: Player, config: GameConfig, useAlphaBeta: boolean): MinimaxTrace {
  const gen = traceMinimax(board, player, config, useAlphaBeta);
  const nodes: MinimaxNode[] = [];
  let next = gen.next();
  while (!next.done) {
    nodes.push(next.value);
    next = gen.next();
  }
  return { nodes, result: next.value };
}

/** The sequence of nodes forming the actual optimal continuation from the root to a terminal
 *  position - reconstructed by following, at each level, the child whose resolved score matches its
 *  parent's (the one MAX/MIN actually picked). Purely derived from the real trace, never invented. */
export function extractPrincipalVariation(nodes: MinimaxNode[]): MinimaxNode[] {
  const byParent = new Map<number, MinimaxNode[]>();
  for (const n of nodes) {
    if (n.pruned || n.parentId === null) continue;
    const list = byParent.get(n.parentId);
    if (list) list.push(n);
    else byParent.set(n.parentId, [n]);
  }
  const root = nodes.find((n) => n.parentId === null);
  if (!root) return [];

  const pv: MinimaxNode[] = [root];
  let current = root;
  while (!current.terminal) {
    const children = byParent.get(current.id) ?? [];
    const next = children.find((c) => c.score === current.score);
    if (!next) break;
    pv.push(next);
    current = next;
  }
  return pv;
}
