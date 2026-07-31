import { createBoard, applyMove, checkWinner, minimax, Player, GameConfig, isDraw } from "../src/lib/game/model";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

const classic: GameConfig = { size: 3, winLength: 3, maxDepth: 9 };

// 1. Perfect play from an empty 3x3 board is a known draw.
{
  const res = minimax(createBoard(3), 1, classic, true);
  assert(res.score === 0, `optimal first move from empty board scores a draw (got ${res.score})`);
}

// 2. Two optimal players playing each other out to the end must draw.
{
  let board = createBoard(3);
  let player: Player = 1;
  let winner: Player | 0 = 0;
  for (let i = 0; i < 9; i++) {
    const res = minimax(board, player, classic, true);
    board = applyMove(board, res.move, player);
    winner = checkWinner(board, 3, 3);
    if (winner !== 0) break;
    player = (-player) as Player;
  }
  assert(winner === 0 && isDraw(board), "two optimal players draw a full 3x3 game");
}

// 3. A forced-win position: X has two in a row open on both ends is not needed; use a simple
//    one-move-to-win position and confirm minimax finds it.
{
  // X X . / O O . / . . .   -> X plays position 2 to win.
  const board = [1, 1, 0, -1, -1, 0, 0, 0, 0] as const;
  const res = minimax(board.slice() as (1 | -1 | 0)[], 1, classic, true);
  assert(res.move === 2, `finds the immediate winning move (got ${res.move})`);
  assert(res.score > 0, `winning move scores positively (got ${res.score})`);
}

// 4. Alpha-beta must agree with plain minimax on the optimal score, while exploring <= nodes.
{
  const plain = minimax(createBoard(3), 1, classic, false);
  const pruned = minimax(createBoard(3), 1, classic, true);
  assert(plain.score === pruned.score, `minimax and alpha-beta agree on score (${plain.score} vs ${pruned.score})`);
  assert(
    pruned.nodesExplored < plain.nodesExplored,
    `alpha-beta explores fewer nodes (${pruned.nodesExplored} vs ${plain.nodesExplored})`
  );
  assert(pruned.prunedBranches > 0, `alpha-beta actually prunes some branches (${pruned.prunedBranches})`);
}

// 5. Depth-limited heuristic search terminates quickly on a larger board (4x4, win 3, depth 4).
{
  const cfg: GameConfig = { size: 4, winLength: 3, maxDepth: 4 };
  const res = minimax(createBoard(4), 1, cfg, true);
  assert(res.move >= 0 && res.move < 16, "depth-limited search on 4x4 returns a legal move");
  assert(res.maxDepthReached <= 4, `search respects the depth cap (reached ${res.maxDepthReached})`);
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll game tests passed.");
}
