import { GRID } from "@/lib/hopfield/model";

const VIEW = 300;
const CELL = VIEW / GRID;

/**
 * The 10x10 bipolar grid, both as the "what's stored" preview and as the live recall canvas - a lit
 * cell is +1, a dark one is -1. When `onToggle` is passed, clicking a cell flips it directly (manual
 * corruption, in addition to the noise slider), same interaction language as the maze/board grids
 * elsewhere on the site.
 */
export function PatternGrid({
  state,
  accentColor = "var(--primary)",
  changedIndex = null,
  onToggle,
}: {
  state: number[];
  accentColor?: string;
  changedIndex?: number | null;
  onToggle?: (index: number) => void;
}) {
  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <rect x={0} y={0} width={VIEW} height={VIEW} fill="var(--surface-container-lowest)" />
      {state.map((v, i) => {
        const r = Math.floor(i / GRID);
        const c = i % GRID;
        const on = v > 0;
        const justChanged = i === changedIndex;
        return (
          <rect
            key={i}
            x={c * CELL + 1}
            y={r * CELL + 1}
            width={CELL - 2}
            height={CELL - 2}
            rx={2}
            fill={on ? accentColor : "rgba(255,255,255,0.06)"}
            opacity={on ? (justChanged ? 1 : 0.85) : 1}
            stroke={justChanged ? "#ffffff" : "none"}
            strokeWidth={justChanged ? 1.5 : 0}
            style={onToggle ? { cursor: "pointer" } : undefined}
            onClick={onToggle ? () => onToggle(i) : undefined}
          />
        );
      })}
    </svg>
  );
}
