import { applyDrop, Board, checkWinner, COLS, emptyBoard, getWinningLine, isDraw, legalColumns, mcts, minimax, ROWS } from "../src/lib/lig4/model";
import { seededRng } from "../src/lib/core/rng";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

// --- emptyBoard() ---
{
  const board = emptyBoard();
  assert(board.length === COLS * ROWS, `emptyBoard has COLS*ROWS cells (got ${board.length})`);
  assert(board.every((c) => c === 0), "emptyBoard is entirely zero");
}

// --- gravity / column drops ---
{
  let board = emptyBoard();
  for (let i = 0; i < ROWS; i++) {
    const dropped = applyDrop(board, 3, 1);
    assert(!!dropped, `drop ${i + 1} into column 3 succeeds while the column has room`);
    assert(dropped!.row === ROWS - 1 - i, `drop ${i + 1} into column 3 lands at row ${ROWS - 1 - i} (got ${dropped!.row})`);
    board = dropped!.board;
  }
  assert(!legalColumns(board).includes(3), "column 3 is excluded from legalColumns once full");
  assert(applyDrop(board, 3, 1) === null, "a drop into a full column returns null");
}

// --- win detection: horizontal ---
{
  const board = emptyBoard();
  board[5 * COLS + 0] = 1;
  board[5 * COLS + 1] = 1;
  board[5 * COLS + 2] = 1;
  board[5 * COLS + 3] = 1;
  assert(checkWinner(board) === 1, "horizontal 4-in-a-row is detected");
  const line = getWinningLine(board);
  assert(!!line && line.length === 4, "getWinningLine returns 4 cells for a horizontal win");
}

// --- win detection: vertical ---
{
  const board = emptyBoard();
  for (let r = 2; r < 6; r++) board[r * COLS + 0] = -1;
  assert(checkWinner(board) === -1, "vertical 4-in-a-row is detected");
}

// --- win detection: both diagonals ---
{
  const board = emptyBoard();
  board[2 * COLS + 0] = 1;
  board[3 * COLS + 1] = 1;
  board[4 * COLS + 2] = 1;
  board[5 * COLS + 3] = 1;
  assert(checkWinner(board) === 1, "descending diagonal 4-in-a-row is detected");
}
{
  const board = emptyBoard();
  board[5 * COLS + 0] = -1;
  board[4 * COLS + 1] = -1;
  board[3 * COLS + 2] = -1;
  board[2 * COLS + 3] = -1;
  assert(checkWinner(board) === -1, "ascending diagonal 4-in-a-row is detected");
}

// --- non-win: three in a row with no reachable fourth ---
{
  const board = emptyBoard();
  board[5 * COLS + 0] = 1;
  board[5 * COLS + 1] = 1;
  board[5 * COLS + 2] = 1;
  assert(checkWinner(board) === 0, "three in a row without a fourth is not a win");
}

// --- isDraw / legalColumns on a full board ---
{
  const board: Board = new Array(COLS * ROWS).fill(1) as Board;
  assert(isDraw(board), "a fully filled board is a draw");
  assert(legalColumns(board).length === 0, "no legal columns remain on a full board");
}

// --- minimax: finds an immediate winning move ---
{
  const board = emptyBoard();
  board[5 * COLS + 0] = 1;
  board[5 * COLS + 1] = 1;
  board[5 * COLS + 2] = 1;
  const res = minimax(board, 1, { maxDepth: 5 }, true);
  assert(res.move === 3, `finds the immediate winning move (got ${res.move})`);
  assert(res.score > 0, `winning move scores positively (got ${res.score})`);
}

// --- minimax: blocks the opponent's immediate win ---
{
  const board = emptyBoard();
  board[5 * COLS + 0] = -1;
  board[5 * COLS + 1] = -1;
  board[5 * COLS + 2] = -1;
  const res = minimax(board, 1, { maxDepth: 5 }, true);
  assert(res.move === 3, `blocks the opponent's immediate win (got ${res.move})`);
}

// --- alpha-beta agrees with plain minimax and explores fewer nodes ---
{
  const board = emptyBoard();
  const plain = minimax(board, 1, { maxDepth: 5 }, false);
  const pruned = minimax(board, 1, { maxDepth: 5 }, true);
  assert(plain.score === pruned.score, `minimax and alpha-beta agree on score (${plain.score} vs ${pruned.score})`);
  assert(
    pruned.nodesExplored < plain.nodesExplored,
    `alpha-beta explores fewer nodes (${pruned.nodesExplored} vs ${plain.nodesExplored})`
  );
  assert(pruned.prunedBranches > 0, `alpha-beta actually prunes some branches (${pruned.prunedBranches})`);
}

// --- MCTS: deterministic for a fixed seed ---
{
  const board = emptyBoard();
  const r1 = mcts(board, 1, { simulations: 300 }, seededRng(123));
  const r2 = mcts(board, 1, { simulations: 300 }, seededRng(123));
  assert(r1.move === r2.move && r1.score === r2.score, "MCTS is deterministic for a fixed seed");
}

// --- MCTS: finds an immediate winning move (same position as the minimax test above) ---
{
  const board = emptyBoard();
  board[5 * COLS + 0] = 1;
  board[5 * COLS + 1] = 1;
  board[5 * COLS + 2] = 1;
  const res = mcts(board, 1, { simulations: 500 }, seededRng(7));
  assert(res.move === 3, `MCTS finds the immediate winning move (got ${res.move})`);
}

// --- MCTS: result shape ---
{
  const board = emptyBoard();
  const res = mcts(board, 1, { simulations: 200 }, seededRng(7));
  assert(res.nodesExplored === 200, `nodesExplored equals the simulation budget when not time-capped (got ${res.nodesExplored})`);
  assert(res.move >= 0 && res.move < COLS, "move is a legal column index");
  assert(res.score >= -1 && res.score <= 1, `score is within [-1,1] (got ${res.score})`);
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll Lig 4 tests passed.");
}
