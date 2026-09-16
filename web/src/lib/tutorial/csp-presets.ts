function isSafe(board: number[], col: number, row: number): boolean {
  for (let c = 0; c < col; c++) {
    const r = board[c];
    if (r === row || Math.abs(r - row) === col - c) return false;
  }
  return true;
}

/** Total distinct solutions for N-Queens, counted by exhaustive backtracking that keeps going past
 *  the first hit (unlike lib/queens/model.ts's backtrackingSteps, which stops there) - a real
 *  computed fact for preset labels, not a memorized constant. Cheap for the N this lab uses (<=12). */
export function countQueensSolutions(n: number): number {
  const board = new Array<number>(n).fill(-1);
  let count = 0;
  function place(col: number) {
    if (col === n) {
      count++;
      return;
    }
    for (let row = 0; row < n; row++) {
      if (!isSafe(board, col, row)) continue;
      board[col] = row;
      place(col + 1);
      board[col] = -1;
    }
  }
  place(0);
  return count;
}

export interface CspPreset {
  id: string;
  label: string;
  n: number;
  solutions: number;
}

function makePreset(id: string, n: number): CspPreset {
  return { id, label: `${n} rainhas`, n, solutions: countQueensSolutions(n) };
}

export const CSP_PRESETS: CspPreset[] = [makePreset("n4", 4), makePreset("n6", 6), makePreset("n8", 8)];

// Bigger boards, offered only in the desafio step - lib/queens/model.ts's QueensCanvas only ever
// renders the CURRENT board (no cumulative tree like the adversarial-search lab's), so a longer
// step array is just a wider scrub range, never a rendering-cost concern.
export const CSP_CHALLENGE_PRESETS: CspPreset[] = [...CSP_PRESETS, makePreset("n10", 10), makePreset("n12", 12)];
