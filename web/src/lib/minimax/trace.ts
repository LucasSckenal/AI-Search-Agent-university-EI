import { Board, GameConfig, Player, applyMove, checkWinner, heuristicScore, isDraw, orderedMoves } from "../game/model";

/**
 * Step-by-step trace of the exact same search `minimax()` (game/model.ts) performs on a real
 * Jogo da Velha position - reimplemented as a generator so this explainer page can reveal one node
 * at a time, instead of only getting the final `{move, score}` the real function returns. Reuses
 * `orderedMoves`/`heuristicScore` so the tree explored here, move order included, is identical to
 * what actually happens in a real game - this file adds *visibility*, not a different algorithm.
 * The real game's `minimax()` is untouched, so nothing here can regress Jogo da Velha or Lig 4.
 */
export interface MinimaxNode {
  id: number;
  parentId: number | null;
  depth: number;
  /** Board cell index just played to reach this node from its parent - null for the root. */
  moveApplied: number | null;
  /** Who played `moveApplied` - null for the root. */
  moverOfLastMove: Player | null;
  board: Board;
  /** Whose turn it is FROM this board - meaningless once `terminal` is true. */
  toMove: Player;
  alpha: number;
  beta: number;
  /** Minimax value of this node, from the absolute (X-positive) perspective. Null for a pruned
   *  stub, which was never actually evaluated. */
  score: number | null;
  terminal: boolean;
  /** True for a sibling move alpha-beta skipped entirely - shown as a grayed-out stub, never expanded. */
  pruned: boolean;
  siblingIndex: number;
  siblingCount: number;
}

export interface MinimaxTraceResult {
  move: number;
  score: number;
  nodesExplored: number;
  prunedCount: number;
}

export function* traceMinimax(
  board: Board,
  player: Player,
  config: GameConfig,
  useAlphaBeta: boolean
): Generator<MinimaxNode, MinimaxTraceResult, void> {
  let idCounter = 0;
  let nodesExplored = 0;
  let prunedCount = 0;
  const rootId = idCounter++;

  function* recurse(
    b: Board,
    p: Player,
    depth: number,
    alpha: number,
    beta: number,
    parentId: number,
    moveApplied: number,
    moverOfLastMove: Player,
    siblingIndex: number,
    siblingCount: number
  ): Generator<MinimaxNode, number, void> {
    const id = idCounter++;
    nodesExplored++;
    const winner = checkWinner(b, config.size, config.winLength);
    const draw = isDraw(b);
    const atDepthLimit = depth >= config.maxDepth;

    if (winner !== 0 || draw || atDepthLimit) {
      const score =
        winner === 1
          ? 10_000 - depth
          : winner === -1
            ? -10_000 + depth
            : draw
              ? 0
              : heuristicScore(b, config.size, config.winLength);
      yield {
        id, parentId, depth, moveApplied, moverOfLastMove, board: b, toMove: p,
        alpha, beta, score, terminal: true, pruned: false, siblingIndex, siblingCount,
      };
      return score;
    }

    const moves = orderedMoves(b, config.size);
    let best = p === 1 ? -Infinity : Infinity;
    let a = alpha;
    let be = beta;

    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      const childBoard = applyMove(b, m, p);
      const score = yield* recurse(childBoard, (-p) as Player, depth + 1, a, be, id, m, p, i, moves.length);
      if (p === 1) {
        best = Math.max(best, score);
        if (useAlphaBeta) a = Math.max(a, best);
      } else {
        best = Math.min(best, score);
        if (useAlphaBeta) be = Math.min(be, best);
      }
      if (useAlphaBeta && a >= be) {
        for (let j = i + 1; j < moves.length; j++) {
          prunedCount++;
          const stubId = idCounter++;
          yield {
            id: stubId, parentId: id, depth: depth + 1, moveApplied: moves[j], moverOfLastMove: p,
            board: applyMove(b, moves[j], p), toMove: (-p) as Player, alpha: a, beta: be,
            score: null, terminal: false, pruned: true, siblingIndex: j, siblingCount: moves.length,
          };
        }
        break;
      }
    }

    yield {
      id, parentId, depth, moveApplied, moverOfLastMove, board: b, toMove: p,
      alpha: a, beta: be, score: best, terminal: false, pruned: false, siblingIndex, siblingCount,
    };
    return best;
  }

  const rootMoves = orderedMoves(board, config.size);
  let bestMove = rootMoves[0] ?? -1;
  let bestScore = player === 1 ? -Infinity : Infinity;
  let alpha = -Infinity;
  let beta = Infinity;

  for (let i = 0; i < rootMoves.length; i++) {
    const m = rootMoves[i];
    const childBoard = applyMove(board, m, player);
    const score = yield* recurse(childBoard, (-player) as Player, 1, alpha, beta, rootId, m, player, i, rootMoves.length);
    if (player === 1 ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = m;
    }
    if (useAlphaBeta) {
      if (player === 1) alpha = Math.max(alpha, bestScore);
      else beta = Math.min(beta, bestScore);
    }
  }

  // Root is yielded last (post-order, same as every other internal node) - its score/best-child
  // are only meaningful once the whole tree under it has resolved.
  yield {
    id: rootId, parentId: null, depth: 0, moveApplied: null, moverOfLastMove: null,
    board, toMove: player, alpha, beta, score: bestScore, terminal: false, pruned: false,
    siblingIndex: 0, siblingCount: 1,
  };

  return { move: bestMove, score: bestScore, nodesExplored, prunedCount };
}
