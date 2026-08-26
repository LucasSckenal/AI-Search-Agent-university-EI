"use client";

import { BoardConfig, cellIndex } from "@/lib/campo-minado/model";

export interface MinesweeperGridProps {
  board: BoardConfig;
  revealed: boolean[];
  flagged: boolean[];
  adjacent: number[];
  /** Only passed once exploded/solved, to reveal every mine (including wrongly-flagged cells). */
  mines?: boolean[];
  /** Index of the mine that was actually clicked, styled distinctly from the rest. */
  exploded?: number | null;
  /** Keyboard cursor cell - manual play only. */
  focusedIndex?: number | null;
  /** Mine-probability overlay text, probabilidade mode only. */
  probabilities?: Map<number, number> | null;
  interactive?: boolean;
  onCellClick?: (index: number) => void;
  onCellFlag?: (index: number) => void;
  className?: string;
  overlay?: { title: string; subtitle: string } | null;
}

/**
 * Plain CSS Grid, natural row-major DOM order (same reasoning as Sudoku's grid - no moving overlay
 * forces out-of-order layers here). Dimensions vary by difficulty (unlike Tetris/Lig4's fixed boards),
 * so grid-template-columns/rows and aspect-ratio are computed inline from `board` - the CSS class only
 * carries the cosmetic properties.
 */
export function MinesweeperGrid({ board, revealed, flagged, adjacent, mines, exploded = null, focusedIndex = null, probabilities, interactive = false, onCellClick, onCellFlag, className = "", overlay }: MinesweeperGridProps) {
  return (
    <div
      className={`minesweeper-grid ${className}`}
      style={{ gridTemplateColumns: `repeat(${board.width}, 1fr)`, gridTemplateRows: `repeat(${board.height}, 1fr)`, aspectRatio: `${board.width} / ${board.height}` }}
    >
      {Array.from({ length: board.height }, (_, r) =>
        Array.from({ length: board.width }, (_, c) => {
          const i = cellIndex(board, r, c);
          const isRevealed = revealed[i];
          const isFlagged = flagged[i];
          const isMine = mines?.[i] ?? false;
          const isExploded = exploded === i;
          const wrongFlag = mines && isFlagged && !isMine;
          const probability = !isRevealed && !isFlagged ? probabilities?.get(i) : undefined;

          let cls = "minesweeper-cell";
          if (isExploded) cls += " minesweeper-cell-exploded";
          else if (isRevealed && isMine) cls += " minesweeper-cell-mine";
          else if (isRevealed) cls += ` minesweeper-cell-revealed minesweeper-cell-n${adjacent[i]}`;
          else cls += " minesweeper-cell-hidden";
          if (isFlagged) cls += " minesweeper-cell-flagged";
          if (focusedIndex === i) cls += " minesweeper-cell-focused";

          return (
            <div
              key={i}
              className={cls}
              onClick={interactive && onCellClick ? () => onCellClick(i) : undefined}
              onContextMenu={
                interactive && onCellFlag
                  ? (e) => {
                      e.preventDefault();
                      onCellFlag(i);
                    }
                  : undefined
              }
            >
              {isFlagged && !isRevealed ? (
                <span className="minesweeper-flag">
                  <span className="material-symbols-outlined">flag</span>
                  {wrongFlag && <span className="minesweeper-wrong-flag">×</span>}
                </span>
              ) : isRevealed && isMine ? (
                <span className="material-symbols-outlined minesweeper-mine">bomb</span>
              ) : !isRevealed && isMine && mines ? (
                <span className="material-symbols-outlined minesweeper-mine minesweeper-mine-dim">bomb</span>
              ) : isRevealed && adjacent[i] > 0 ? (
                <span className="minesweeper-number">{adjacent[i]}</span>
              ) : probability !== undefined ? (
                <span className="minesweeper-probability">{Math.round(probability * 100)}</span>
              ) : null}
            </div>
          );
        })
      )}
      {overlay && (
        <div className="board-overlay">
          <span className="board-overlay-title">{overlay.title}</span>
          <span className="board-overlay-subtitle">{overlay.subtitle}</span>
        </div>
      )}
    </div>
  );
}
