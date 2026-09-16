"use client";

import { CSSProperties } from "react";
import { Board } from "@/lib/game/model";
import { CELL_LABEL } from "@/lib/tutorial/am-explain";

const X_COLOR = "#7ea8f5";
const O_COLOR = "#ff6bd6";

/** Small CSS-grid board renderer shared by every step that shows a position - the picker, the
 *  prediction panel, the simulation stage's corner overlay, and the decision timeline. Optionally
 *  clickable (for the prediction step) and optionally rings a cell selected/correct/wrong. */
export function MiniBoard({
  board,
  size = 3,
  cellPx = 20,
  onCellClick,
  selected = null,
  correct = null,
  wrong = null,
}: {
  board: Board;
  size?: number;
  cellPx?: number;
  onCellClick?: (i: number) => void;
  selected?: number | null;
  correct?: number | null;
  wrong?: number | null;
}) {
  return (
    <div className="grid gap-0.5 rounded-lg bg-white/5 p-1.5" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
      {board.map((cell, i) => {
        const clickable = Boolean(onCellClick) && cell === 0;
        const ring = correct === i ? "#7ee0a8" : wrong === i ? "#ff9b9b" : selected === i ? "#afc6ff" : undefined;
        const style: CSSProperties = {
          width: cellPx,
          height: cellPx,
          fontSize: cellPx * 0.5,
          color: cell === 1 ? X_COLOR : cell === -1 ? O_COLOR : "transparent",
          cursor: clickable ? "pointer" : "default",
          outline: ring ? `2px solid ${ring}` : undefined,
          outlineOffset: 1,
        };
        // A plain <div> when not clickable - MiniBoard is sometimes nested inside another button
        // (PositionPicker's card), and a <button> can never contain another <button> in valid HTML.
        if (!onCellClick) {
          return (
            <div key={i} className="flex items-center justify-center rounded-[3px] bg-white/5 font-mono font-bold" style={style}>
              {CELL_LABEL[cell] || "·"}
            </div>
          );
        }
        return (
          <button
            key={i}
            type="button"
            disabled={!clickable}
            onClick={() => onCellClick(i)}
            className="flex items-center justify-center rounded-[3px] bg-white/5 font-mono font-bold transition-colors"
            style={style}
          >
            {CELL_LABEL[cell] || "·"}
          </button>
        );
      })}
    </div>
  );
}
