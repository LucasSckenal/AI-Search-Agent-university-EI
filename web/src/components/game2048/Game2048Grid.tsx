"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { Board, TileMove } from "@/lib/game2048/model";

// Two-phase, like the real game: tiles slide from their old cell to their new one, THEN the
// destination pops (merge) or a fresh tile fades in (spawn) - not simultaneous, sliding first.
const SLIDE_MS = 130;
const SETTLE_MS = 320;
/** Total time one move's animation occupies the board, start to finish - exported so manual play
 *  can lock input for this long and never fire a second move mid-animation (real 2048 does the
 *  same: a held or mashed key doesn't outrun what's on screen). */
export const MOVE_ANIMATION_MS = SLIDE_MS + SETTLE_MS;

function tileClass(value: number): string {
  return value > 2048 ? "tile-super" : `tile-${value}`;
}

function cellPosition(index: number, size: number): CSSProperties {
  const row = Math.floor(index / size);
  const col = index % size;
  return {
    left: `${(col * 100) / size}%`,
    top: `${(row * 100) / size}%`,
    width: `${100 / size}%`,
    height: `${100 / size}%`,
  };
}

function boardsEqual(a: Board | null, b: Board | null): boolean {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function diffChangedCells(prev: Board, next: Board): Set<number> {
  const diff = new Set<number>();
  for (let i = 0; i < next.length; i++) {
    if (next[i] !== 0 && next[i] !== prev[i]) diff.add(i);
  }
  return diff;
}

/**
 * DOM/CSS 2D grid - no WebGL, unlike every other page's canvas. Every cell/tile is positioned with
 * plain percentage left/top/width/height instead of CSS Grid placement, specifically because
 * grid-column/grid-row aren't smoothly animatable in browsers (they're treated as discrete values),
 * while left/top interpolate fine - that's what makes the slide phase below possible at all.
 *
 * Full tile-identity tracking across merges isn't attempted (out of scope: steps are pre-computed
 * and scrubbed, not driven by real-time key presses) - instead each step carries `moves` (see
 * TileMove in model.ts), one from/to pair per occupied source cell, which is enough to animate a
 * believable slide: source tiles glide from `from` to `to` at their original value, then this
 * component hands off to a diff-based "settled" render for the pop (merge) / fade-in (spawn).
 * A jump of more than one step (skip-to-end, or scrubbing forward faster than 1 move/tick) has no
 * valid single from/to mapping to animate, so it's detected (the claimed `prevBoard` won't match
 * what this component last actually rendered) and falls back to an instant transition instead of a
 * misleading slide.
 */
export function Game2048Grid({
  board,
  prevBoard,
  moves,
  size,
  spawnedIndex,
  className = "",
  overlay,
}: {
  board: Board;
  /** The board immediately before this move (no spawn yet undone - i.e. the previous step's final
   *  board), or null when there's nothing to animate from (first render, or a non-sequential jump). */
  prevBoard: Board | null;
  /** Slide data for the transition into `board`, or null/empty to skip straight to a static render. */
  moves: TileMove[] | null;
  size: number;
  spawnedIndex: number | null;
  className?: string;
  /** Shown as a dimmed banner over the board once manual play truly has no legal move left. */
  overlay?: { title: string; subtitle: string } | null;
}) {
  const [sliding, setSliding] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [changed, setChanged] = useState<Set<number>>(new Set());
  const lastBoardRef = useRef<Board | null>(null);

  useEffect(() => {
    const priorRendered = lastBoardRef.current;
    lastBoardRef.current = board;
    const sequential = !!moves && moves.length > 0 && boardsEqual(prevBoard, priorRendered);

    if (!sequential) {
      setSliding(false);
      if (priorRendered && priorRendered.length === board.length) {
        const diff = diffChangedCells(priorRendered, board);
        if (diff.size > 0) {
          setChanged(diff);
          const t = setTimeout(() => setChanged(new Set()), SETTLE_MS);
          return () => clearTimeout(t);
        }
      }
      return;
    }

    setSliding(true);
    setArrived(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      // Second frame guarantees the "from" position has actually painted before switching to "to",
      // so the browser has something to transition away from instead of snapping straight there.
      raf2 = requestAnimationFrame(() => setArrived(true));
    });
    const t = setTimeout(() => {
      setSliding(false);
      const diff = diffChangedCells(priorRendered!, board);
      if (diff.size > 0) {
        setChanged(diff);
        setTimeout(() => setChanged(new Set()), SETTLE_MS);
      }
    }, SLIDE_MS);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(t);
    };
  }, [board, moves, prevBoard]);

  return (
    <div className={`g2048-grid ${className}`}>
      {Array.from({ length: size * size }, (_, i) => (
        <div key={`bg-${i}`} className="g2048-cell-outer" style={cellPosition(i, size)}>
          <div className="g2048-cell-bg" />
        </div>
      ))}

      {sliding && prevBoard
        ? moves!.map((m) => (
            <div
              key={`slide-${m.from}`}
              className="g2048-cell-outer g2048-sliding"
              style={cellPosition(arrived ? m.to : m.from, size)}
            >
              <div className={`g2048-tile ${tileClass(prevBoard[m.from])}`}>{prevBoard[m.from]}</div>
            </div>
          ))
        : board.map((value, i) => {
            if (value === 0) return null;
            const anim = changed.has(i) ? (i === spawnedIndex ? "spawn" : "pop") : "";
            return (
              <div key={`cell-${i}`} className="g2048-cell-outer" style={cellPosition(i, size)}>
                <div className={`g2048-tile ${tileClass(value)} ${anim}`}>{value}</div>
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
