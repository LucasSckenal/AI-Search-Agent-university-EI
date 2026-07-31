"use client";

import { MazeState, idx } from "@/lib/maze/model";

const CELL_COLORS: Record<string, string> = {
  wall: "rgba(225,226,236,0.16)",
  empty: "rgba(255,255,255,0.04)",
  mud: "rgba(255,183,123,0.16)",
};

export function MazeBoard({
  maze,
  visited,
  path,
  cellPx = 20,
  onCellClick,
  interactive = false,
}: {
  maze: MazeState;
  visited?: Set<number>;
  path?: Set<number>;
  cellPx?: number;
  onCellClick?: (index: number) => void;
  interactive?: boolean;
}) {
  return (
    <div
      className="inline-grid select-none gap-[1px] rounded-2xl bg-white/5 p-[1px]"
      style={{
        gridTemplateColumns: `repeat(${maze.cols}, ${cellPx}px)`,
        gridTemplateRows: `repeat(${maze.rows}, ${cellPx}px)`,
      }}
    >
      {maze.cells.map((kind, i) => {
        const isStart = i === maze.start;
        const isGoal = i === maze.goal;
        const isPath = path?.has(i);
        const isVisited = visited?.has(i);

        let bg = CELL_COLORS[kind];
        if (isVisited && kind !== "wall") bg = "rgba(206,189,255,0.3)";
        if (isPath && kind !== "wall") bg = "#afc6ff";
        if (isStart) bg = "#afc6ff";
        if (isGoal) bg = "#ffb77b";

        return (
          <div
            key={i}
            onMouseDown={() => interactive && onCellClick?.(i)}
            onMouseEnter={(e) => {
              if (interactive && e.buttons === 1) onCellClick?.(i);
            }}
            className={interactive ? "cursor-pointer" : ""}
            style={{
              width: cellPx,
              height: cellPx,
              background: bg,
              transition: "background-color 80ms linear",
            }}
            title={`${Math.floor(i / maze.cols)},${i % maze.cols} ${kind}`}
          />
        );
      })}
    </div>
  );
}

export function cellIndexAt(maze: Pick<MazeState, "cols">, r: number, c: number): number {
  return idx(maze, r, c);
}
