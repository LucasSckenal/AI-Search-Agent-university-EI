"use client";

import { CubeState, COLOR_HEX, faceletsByFace } from "@/lib/cube/model";

function FaceGrid({ colors, size }: { colors: number[]; size: number }) {
  return (
    <div
      className="grid gap-[2px] rounded-[4px] bg-black/50 p-[2px]"
      style={{ gridTemplateColumns: `repeat(2, ${size}px)`, gridTemplateRows: `repeat(2, ${size}px)` }}
    >
      {colors.map((c, i) => (
        <div key={i} style={{ width: size, height: size, background: COLOR_HEX[c as 0 | 1 | 2 | 3 | 4 | 5] }} className="rounded-[2px]" />
      ))}
    </div>
  );
}

export function CubeNet({ cube, size = 28 }: { cube: CubeState; size?: number }) {
  const faces = faceletsByFace(cube);
  return (
    <div
      className="grid w-fit gap-1.5"
      style={{
        gridTemplateColumns: `repeat(4, ${size * 2 + 6}px)`,
        gridTemplateAreas: `". U . ." "L F R B" ". D . ."`,
      }}
    >
      <div style={{ gridArea: "U" }}>
        <FaceGrid colors={faces.U} size={size} />
      </div>
      <div style={{ gridArea: "L" }}>
        <FaceGrid colors={faces.L} size={size} />
      </div>
      <div style={{ gridArea: "F" }}>
        <FaceGrid colors={faces.F} size={size} />
      </div>
      <div style={{ gridArea: "R" }}>
        <FaceGrid colors={faces.R} size={size} />
      </div>
      <div style={{ gridArea: "B" }}>
        <FaceGrid colors={faces.B} size={size} />
      </div>
      <div style={{ gridArea: "D" }}>
        <FaceGrid colors={faces.D} size={size} />
      </div>
    </div>
  );
}
