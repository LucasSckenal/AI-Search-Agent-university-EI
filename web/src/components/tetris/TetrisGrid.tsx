"use client";

import { CSSProperties } from "react";
import { absoluteCells, ActivePiece, Board, hardDropTarget, HEIGHT, PIECE_ORDER, PieceType, WIDTH } from "@/lib/tetris/model";

function colorClass(pieceId: number): string {
  return `tetris-cell-${PIECE_ORDER[pieceId - 1] ?? "I"}`;
}

const BOX = 4;

export interface FallingPiece {
  type: PieceType;
  rotation: 0 | 1 | 2 | 3;
  x: number;
  /** Current row (top-left of the piece's 4x4 box) - update this across renders to animate the
   *  fall; TetrisGrid transitions it smoothly via CSS instead of snapping cell-by-cell. */
  y: number;
  /** Transition duration for the fall, scaled by drop distance so a 1-row drop isn't as slow as a
   *  19-row one. */
  fallMs: number;
}

/**
 * Plain CSS Grid, unlike 2048's absolute-positioned board - the locked stack moves in whole-cell
 * steps with no interpolation, which is the authentic look for Tetris. The one exception is
 * `fallingPiece`: an absolutely-positioned overlay (percentage-based, like 2048's tiles) so its
 * `top` can be CSS-transitioned into a smooth drop instead of jumping row to row.
 */
export function TetrisGrid({
  board,
  activePiece,
  fallingPiece,
  className = "",
  overlay,
}: {
  board: Board;
  /** The currently-falling piece under direct player control (manual/vs modes) - snapped to
   *  whole cells every gravity tick, no animation needed since real ticks already provide motion. */
  activePiece?: ActivePiece | null;
  /** An AI-chosen piece animating from spawn down to its landing spot (greedy/genetic/vs modes'
   *  scrub) - already in its final rotation, since the placement search decides that up front. */
  fallingPiece?: FallingPiece | null;
  className?: string;
  /** Shown as a dimmed banner over the board once manual play has no room left to spawn the next piece. */
  overlay?: { title: string; subtitle: string } | null;
}) {
  const cellOverlay = new Map<string, string>();
  if (activePiece) {
    const ghost = hardDropTarget(board, activePiece);
    for (const [x, y] of absoluteCells(ghost)) cellOverlay.set(`${x},${y}`, "ghost");
    for (const [x, y] of absoluteCells(activePiece)) cellOverlay.set(`${x},${y}`, "active");
  }

  return (
    <div className={`tetris-grid ${className}`}>
      {Array.from({ length: HEIGHT }, (_, row) =>
        Array.from({ length: WIDTH }, (_, col) => {
          const key = `${col},${row}`;
          const kind = cellOverlay.get(key);
          const value = board[row * WIDTH + col];
          const style: CSSProperties = { gridColumn: col + 1, gridRow: row + 1 };
          if (kind === "active" && activePiece) {
            return <div key={key} className={`tetris-cell ${colorClass(PIECE_ORDER.indexOf(activePiece.type) + 1)}`} style={style} />;
          }
          if (kind === "ghost") {
            return <div key={key} className="tetris-cell tetris-cell-ghost" style={style} />;
          }
          if (value !== 0) {
            return <div key={key} className={`tetris-cell ${colorClass(value)}`} style={style} />;
          }
          return <div key={key} className="tetris-cell tetris-cell-empty" style={style} />;
        })
      )}
      {fallingPiece && (
        <div
          className="tetris-falling-piece"
          style={{
            left: `${(fallingPiece.x / WIDTH) * 100}%`,
            top: `${(fallingPiece.y / HEIGHT) * 100}%`,
            width: `${(BOX / WIDTH) * 100}%`,
            height: `${(BOX / HEIGHT) * 100}%`,
            transitionDuration: `${fallingPiece.fallMs}ms`,
          }}
        >
          {absoluteCells({ type: fallingPiece.type, rotation: fallingPiece.rotation, x: 0, y: 0 }).map(([cx, cy]) => (
            <div
              key={`${cx}-${cy}`}
              className={`tetris-cell ${colorClass(PIECE_ORDER.indexOf(fallingPiece.type) + 1)}`}
              style={{ gridColumn: cx + 1, gridRow: cy + 1 }}
            />
          ))}
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

/** Small "next piece" readout - a fixed 4x4 grid showing the upcoming piece in its spawn
 *  orientation, same cell styling as the main board. */
export function TetrisPiecePreview({ type }: { type: PieceType | null }) {
  const cells = new Set<string>();
  if (type) {
    for (const [x, y] of absoluteCells({ type, rotation: 0, x: 0, y: 0 })) cells.add(`${x},${y}`);
  }
  return (
    <div className="tetris-preview">
      {Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 4 }, (_, col) => {
          const key = `${col},${row}`;
          const filled = cells.has(key);
          return (
            <div
              key={key}
              className={`tetris-cell ${filled && type ? colorClass(PIECE_ORDER.indexOf(type) + 1) : "tetris-cell-empty"}`}
              style={{ gridColumn: col + 1, gridRow: row + 1 }}
            />
          );
        })
      )}
    </div>
  );
}
