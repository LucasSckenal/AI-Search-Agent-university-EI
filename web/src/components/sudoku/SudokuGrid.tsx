"use client";

import { colOf, Digit, rowOf, SIZE } from "@/lib/sudoku/model";

const PENCIL_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export interface SudokuGridProps {
  grid: Digit[];
  /** True = an original clue, bold and non-editable. */
  givenMask: boolean[];
  /** Cells currently violating a row/column/box constraint - manual play only. */
  conflicts?: Set<number>;
  /** Keyboard cursor cell - manual play only. */
  focusedIndex?: number | null;
  /** The step currently being replayed - algorithm-trace modes only. */
  frontierIndex?: number | null;
  /** Remaining candidate digits per cell - Forward Checking/AC-3 trace modes only. */
  domains?: number[][];
  interactive?: boolean;
  onCellClick?: (index: number) => void;
  className?: string;
  overlay?: { title: string; subtitle: string } | null;
}

/**
 * Plain CSS Grid, same DOM/CSS approach as 2048/Tetris/Lig4 - a flat 9x9 board gets nothing from a
 * 3D scene. Unlike Lig4Grid, cells don't need explicit gridColumn/gridRow: there's no moving overlay
 * here forcing an out-of-DOM-order layer, so natural row-major DOM order already matches the grid.
 */
export function SudokuGrid({
  grid,
  givenMask,
  conflicts,
  focusedIndex = null,
  frontierIndex = null,
  domains,
  interactive = false,
  onCellClick,
  className = "",
  overlay,
}: SudokuGridProps) {
  return (
    <div className={`sudoku-grid ${className}`}>
      {grid.map((value, i) => {
        const row = rowOf(i);
        const col = colOf(i);
        const given = givenMask[i];

        let cls = "sudoku-cell";
        if (col % 3 === 2 && col !== SIZE - 1) cls += " sudoku-box-edge-right";
        if (row % 3 === 2 && row !== SIZE - 1) cls += " sudoku-box-edge-bottom";
        if (given) cls += " sudoku-cell-given";
        else if (value !== 0) cls += " sudoku-cell-filled";
        if (conflicts?.has(i)) cls += " sudoku-cell-conflict";
        if (focusedIndex === i) cls += " sudoku-cell-focused";
        if (frontierIndex === i) cls += " sudoku-cell-frontier";
        if (interactive && !given) cls += " sudoku-cell-editable";

        const cellDomain = value === 0 ? domains?.[i] : undefined;

        return (
          <div key={i} className={cls} onClick={interactive && onCellClick && !given ? () => onCellClick(i) : undefined}>
            {value !== 0 ? (
              <span className="sudoku-digit">{value}</span>
            ) : cellDomain ? (
              <div className="sudoku-pencil">
                {PENCIL_DIGITS.map((d) => (
                  <span key={d} className={`sudoku-pencil-digit ${cellDomain.includes(d) ? "" : "sudoku-pencil-digit-hidden"}`}>
                    {d}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      {overlay && (
        <div className="board-overlay">
          <span className="board-overlay-title">{overlay.title}</span>
          <span className="board-overlay-subtitle">{overlay.subtitle}</span>
        </div>
      )}
    </div>
  );
}
