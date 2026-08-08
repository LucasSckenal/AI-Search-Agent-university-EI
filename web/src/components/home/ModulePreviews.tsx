import { COLOR_HEX } from "@/lib/cube/model";

/**
 * Small, always-looping decorative previews for the three home-page module cards - each mirrors
 * something real about its module (the maze's own explored/discarded/path color language, the
 * cube's own real sticker colors, a game actually playing out) instead of a generic static icon.
 * Pure CSS/SVG animation (see globals.css "home hero & module previews" section) - no client JS,
 * so these stay server-rendered.
 */

const FACE_ORDER = [
  { cls: "f-front", color: COLOR_HEX[2] }, // F - green
  { cls: "f-back", color: COLOR_HEX[5] }, // B - red
  { cls: "f-right", color: COLOR_HEX[1] }, // R - blue
  { cls: "f-left", color: COLOR_HEX[4] }, // L - orange
  { cls: "f-top", color: COLOR_HEX[0] }, // U - white
  { cls: "f-bottom", color: COLOR_HEX[3] }, // D - yellow
] as const;

export function MazePreview() {
  return (
    <div className="card-preview maze-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">grid_view</span>
      </span>
      <svg viewBox="0 0 110 66" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="mazeGridPattern" width="11" height="11" patternUnits="userSpaceOnUse">
            <circle className="grid-dot" cx="1" cy="1" r="0.6" />
          </pattern>
        </defs>
        <rect width="110" height="66" fill="url(#mazeGridPattern)" />
        <rect className="wall" x="18" y="8" width="8" height="24" />
        <rect className="wall" x="46" y="30" width="8" height="24" />
        <rect className="wall" x="78" y="20" width="20" height="8" />
        <rect className="wall" x="8" y="8" width="16" height="8" />
        <path className="dead dead1" d="M10,58 L10,45 L25,45 L25,30" />
        <path className="dead dead2" d="M38,38 L38,55 L55,55" />
        <path className="route" d="M10,58 L10,38 L38,38 L38,16 L70,16 L70,46 L100,46 L100,10" />
        <circle className="spark" r="3" />
        <circle className="waypoint wp-start" cx="10" cy="58" r="3" />
        <circle className="waypoint wp-goal" cx="100" cy="10" r="3" />
      </svg>
    </div>
  );
}

export function CubePreview() {
  return (
    <div className="card-preview cube-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">view_in_ar</span>
      </span>
      <div className="cube-scene">
        <div className="cube">
          {FACE_ORDER.map(({ cls, color }) => (
            <div key={cls} className={`face ${cls}`}>
              {Array.from({ length: 4 }).map((_, i) => (
                <span key={i} style={{ background: color }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GoosePreview() {
  return (
    <div className="card-preview goose-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">directions_run</span>
      </span>
      <svg viewBox="0 0 110 66" preserveAspectRatio="xMidYMid meet">
        <line className="ground" x1="0" y1="50" x2="110" y2="50" />
        <g className="obstacle ob1">
          <rect x="0" y="34" width="7" height="16" rx="1" />
        </g>
        <g className="obstacle ob2">
          <rect x="0" y="38" width="6" height="12" rx="1" />
        </g>
        <g className="goose">
          <rect className="body" x="0" y="0" width="16" height="14" rx="3" />
          <rect className="head" x="10" y="-6" width="9" height="9" rx="2" />
          <circle className="eye" cx="16" cy="-2" r="1" />
        </g>
      </svg>
    </div>
  );
}

export function TttPreview() {
  return (
    <div className="card-preview ttt-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">close</span>
      </span>
      <div className="board">
        <div className="gline v1" />
        <div className="gline v2" />
        <div className="gline h1" />
        <div className="gline h2" />
        <span className="mark m0">X</span>
        <span className="mark m1">O</span>
        <span className="mark m4">X</span>
        <span className="mark m2">O</span>
        <span className="mark m8">X</span>
        <span className="winline" />
      </div>
    </div>
  );
}
