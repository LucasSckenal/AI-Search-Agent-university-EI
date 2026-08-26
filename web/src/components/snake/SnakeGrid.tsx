"use client";

import { CSSProperties } from "react";
import { Direction, idx } from "@/lib/snake/model";

function dirTo(fromCell: number, toCell: number, cols: number): Direction | null {
  const fr = Math.floor(fromCell / cols);
  const fc = fromCell % cols;
  const tr = Math.floor(toCell / cols);
  const tc = toCell % cols;
  const dr = tr - fr;
  const dc = tc - fc;
  if (dr === -1 && dc === 0) return "up";
  if (dr === 1 && dc === 0) return "down";
  if (dr === 0 && dc === -1) return "left";
  if (dr === 0 && dc === 1) return "right";
  return null;
}

const CORNER_SIDES: Record<"tl" | "tr" | "br" | "bl", [Direction, Direction]> = {
  tl: ["up", "left"],
  tr: ["up", "right"],
  br: ["down", "right"],
  bl: ["down", "left"],
};

/**
 * Renders a segment as a continuous tube instead of a row of disconnected squares: a corner rounds
 * only when NEITHER of its two adjacent sides leads to another body cell - so a straight run reads
 * as one solid bar (both opposite sides connected, nothing to round) and a turn rounds exactly its
 * one outer corner, while the two inner corners stay square to seam cleanly into the next segment.
 */
function segmentRadius(connected: Set<Direction>): string {
  const at = (corner: "tl" | "tr" | "br" | "bl") => {
    const [a, b] = CORNER_SIDES[corner];
    return connected.has(a) || connected.has(b) ? "3px" : "46%";
  };
  return `${at("tl")} ${at("tr")} ${at("br")} ${at("bl")}`;
}

/**
 * Plain CSS Grid in natural row-major DOM order, same reasoning as Sudoku's grid: the cobrinha's
 * cell-by-cell "jump" is the authentic look for this game (no slide/interpolation to build), so
 * there's no need for absolute positioning the way Tetris's falling-piece overlay needed it.
 */
export function SnakeGrid({
  cols,
  rows,
  body,
  food,
  direction,
  className = "",
  overlay,
}: {
  cols: number;
  rows: number;
  body: number[];
  food: number;
  direction: Direction;
  className?: string;
  overlay?: { title: string; subtitle: string } | null;
}) {
  const bodySet = new Set(body);
  const headIndex = body[0];
  const tailIndex = body[body.length - 1];

  // Connected sides per body cell (toward the neighbor closer to the head, and toward the one
  // closer to the tail), keyed by flat cell index - drives segmentRadius() above.
  const connections = new Map<number, Set<Direction>>();
  body.forEach((cell, i) => {
    const dirs = new Set<Direction>();
    if (i > 0) {
      const d = dirTo(cell, body[i - 1], cols);
      if (d) dirs.add(d);
    }
    if (i < body.length - 1) {
      const d = dirTo(cell, body[i + 1], cols);
      if (d) dirs.add(d);
    }
    connections.set(cell, dirs);
  });

  return (
    <div
      className={`snake-grid ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
    >
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const i = idx(cols, r, c);
          const isHead = i === headIndex;
          const isTail = i === tailIndex && body.length > 1;
          const isBody = !isHead && !isTail && bodySet.has(i);
          const isFood = !isHead && !isBody && !isTail && i === food;
          const kind = isHead ? "head" : isTail ? "tail" : isBody ? "body" : isFood ? "food" : "empty";
          const style: CSSProperties | undefined =
            isHead || isBody || isTail ? { borderRadius: segmentRadius(connections.get(i) ?? new Set()) } : undefined;
          return <div key={i} className={`snake-cell snake-cell-${kind} ${isHead ? `snake-head-${direction}` : ""}`} style={style} />;
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
