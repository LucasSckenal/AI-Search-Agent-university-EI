"use client";

import { MazeState } from "@/lib/maze/model";

/** Lightweight CSS-grid maze renderer - no WebGL, used for steps 01/03/04 where the point is a
 *  quick, cheap read of the grid rather than an immersive scene (that's what RealSimulationStage's
 *  3D canvas is for, in steps 05/08). */
export function MiniGrid2D({
  maze,
  visited,
  frontier,
  path,
  current,
  cellPx = 20,
  onCellClick,
}: {
  maze: MazeState;
  visited?: Set<number>;
  frontier?: Set<number>;
  path?: number[];
  current?: number | null;
  cellPx?: number;
  onCellClick?: (i: number) => void;
}) {
  const pathSet = new Set(path ?? []);
  return (
    <div
      className="lab-grid2d"
      style={{ gridTemplateColumns: `repeat(${maze.cols}, ${cellPx}px)`, gridTemplateRows: `repeat(${maze.rows}, ${cellPx}px)` }}
    >
      {maze.cells.map((kind, i) => {
        const classes = ["lab-grid2d-cell"];
        if (kind !== "empty") classes.push(kind);
        if (i === maze.start) classes.push("start");
        else if (i === maze.goal) classes.push("goal");
        else if (i === current) classes.push("current");
        else if (pathSet.has(i)) classes.push("path");
        else if (frontier?.has(i)) classes.push("frontier");
        else if (visited?.has(i)) classes.push("visited");
        return (
          <div
            key={i}
            className={classes.join(" ")}
            onClick={onCellClick ? () => onCellClick(i) : undefined}
            style={onCellClick ? { cursor: "pointer" } : undefined}
          />
        );
      })}
    </div>
  );
}
