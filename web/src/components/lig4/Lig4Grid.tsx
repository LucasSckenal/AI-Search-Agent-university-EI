"use client";

import { CSSProperties } from "react";
import { Board, COLS, dropRow, Player, ROWS } from "@/lib/lig4/model";

export interface FallingDisc {
  col: number;
  /** Current target row - the page mounts this at 0 then updates it to the real landing row one
   *  frame later (same double-rAF mount-then-update trick as Tetris's fallingPiece), letting the
   *  CSS `transition: top` animate the difference instead of snapping straight there. */
  toRow: number;
  player: Player;
  /** CSS transition duration for the fall, scaled by drop distance - see fallDurationMs in the page. */
  fallMs: number;
}

function discClass(player: Player): string {
  return player === 1 ? "lig4-cell-red" : "lig4-cell-yellow";
}

/**
 * Plain CSS Grid, same DOM/CSS approach as Tetris/2048 (a flat 7x6 board gets nothing from a 3D
 * scene). Clicks/hovers are attached per-cell but always resolve to a column - Connect Four drops
 * into a column, it never targets a single cell directly. The falling disc is a separate
 * absolutely-positioned overlay (percentage left/top, like Tetris's fallingPiece) so its `top` can
 * be CSS-transitioned into a smooth drop instead of snapping row to row.
 */
export function Lig4Grid({
  board,
  winLine,
  interactive = false,
  onColumnClick,
  hoverCol = null,
  onHoverColumn,
  ghostPlayer,
  fallingDisc,
  focusCol = null,
  className = "",
  overlay,
}: {
  board: Board;
  winLine?: number[] | null;
  interactive?: boolean;
  onColumnClick?: (col: number) => void;
  /** Column currently under the pointer - renders a translucent preview disc at its landing row. */
  hoverCol?: number | null;
  onHoverColumn?: (col: number | null) => void;
  /** Whose disc the hover preview should render as (the player about to move). */
  ghostPlayer?: Player;
  fallingDisc?: FallingDisc | null;
  /** Keyboard cursor column (Left/Right + Enter/Space, same idea as Jogo da Velha's focusIndex). */
  focusCol?: number | null;
  className?: string;
  overlay?: { title: string; subtitle: string } | null;
}) {
  const winSet = new Set(winLine ?? []);
  const ghostRow = interactive && hoverCol !== null ? dropRow(board, hoverCol) : -1;

  return (
    <div className={`lig4-grid ${className}`} data-interactive={interactive ? "true" : "false"}>
      {Array.from({ length: ROWS }, (_, row) =>
        Array.from({ length: COLS }, (_, col) => {
          const index = row * COLS + col;
          const value = board[index];
          const style: CSSProperties = { gridColumn: col + 1, gridRow: row + 1 };
          const isGhost = ghostRow === row && hoverCol === col;
          let cls = "lig4-cell";
          if (value !== 0) cls += ` ${discClass(value)}`;
          else if (isGhost) cls += ` lig4-cell-ghost ${ghostPlayer === -1 ? "lig4-cell-ghost-yellow" : "lig4-cell-ghost-red"}`;
          else cls += " lig4-cell-empty";
          if (winSet.has(index)) cls += " lig4-cell-win";
          if (focusCol === col) cls += " lig4-col-focused";
          return (
            <div
              key={index}
              className={cls}
              style={style}
              onClick={interactive && onColumnClick ? () => onColumnClick(col) : undefined}
              onMouseEnter={interactive && onHoverColumn ? () => onHoverColumn(col) : undefined}
              onMouseLeave={interactive && onHoverColumn ? () => onHoverColumn(null) : undefined}
            >
              <span className="lig4-disc" />
            </div>
          );
        })
      )}
      {fallingDisc && (
        <div
          className={`lig4-falling-disc ${discClass(fallingDisc.player)}`}
          style={{
            left: `${(fallingDisc.col / COLS) * 100}%`,
            top: `${(fallingDisc.toRow / ROWS) * 100}%`,
            width: `${(1 / COLS) * 100}%`,
            height: `${(1 / ROWS) * 100}%`,
            transitionDuration: `${fallingDisc.fallMs}ms`,
          }}
        >
          <span className="lig4-disc" />
        </div>
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
