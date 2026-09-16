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
        <span className="material-symbols-outlined text-[13px]">route</span>
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
        <span className="material-symbols-outlined text-[13px]">grid_view</span>
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

export function TspPreview() {
  const cities = [
    [14, 50],
    [30, 14],
    [58, 10],
    [96, 24],
    [82, 54],
    [46, 58],
  ];
  return (
    <div className="card-preview tsp-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">view_in_ar</span>
      </span>
      <svg viewBox="0 0 110 66" preserveAspectRatio="xMidYMid meet">
        <path className="tsp-route" d="M14,50 L30,14 L58,10 L96,24 L82,54 L46,58 Z" />
        <circle className="tsp-spark" r="2.6" />
        {cities.map(([x, y], i) => (
          <circle key={i} className={`tsp-city ${i === 0 ? "origin" : ""}`} cx={x} cy={y} r={i === 0 ? 3 : 2.2} />
        ))}
      </svg>
    </div>
  );
}

export function QueensPreview() {
  const cols = 8;
  const rows = 5;
  const cellW = 110 / cols;
  const cellH = 66 / rows;
  // A hand-picked non-attacking placement for the first 5 columns, echoing a solved board; the
  // 6th column's queen animates down through the rows (see .rainhas-scan), a small nod to
  // backtracking trying each row before settling.
  const placed = [0, 2, 4, 1, 3];
  return (
    <div className="card-preview rainhas-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">extension</span>
      </span>
      <svg viewBox="0 0 110 66" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: cols }, (_, c) =>
          Array.from({ length: rows }, (_, r) => (
            <rect
              key={`${c}-${r}`}
              className={`rainhas-square ${(c + r) % 2 === 0 ? "dark" : "light"}`}
              x={c * cellW}
              y={r * cellH}
              width={cellW}
              height={cellH}
            />
          ))
        )}
        {placed.map((r, c) => (
          <circle key={c} className="rainhas-queen" cx={c * cellW + cellW / 2} cy={r * cellH + cellH / 2} r={cellW * 0.26} />
        ))}
        <circle className="rainhas-scan" cx={placed.length * cellW + cellW / 2} cy={cellH / 2} r={cellW * 0.24} />
      </svg>
    </div>
  );
}

export function RLPreview() {
  const cols = 6;
  const rows = 4;
  const cellW = 110 / cols;
  const cellH = 66 / rows;
  const goal: [number, number] = [rows - 1, cols - 1];
  const wall: [number, number] = [1, 3];
  const pit: [number, number] = [2, 1];
  const maxDist = rows - 1 + (cols - 1);
  return (
    <div className="card-preview aprendizado-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">psychology</span>
      </span>
      <svg viewBox="0 0 110 66" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const isWall = r === wall[0] && c === wall[1];
            const isPit = r === pit[0] && c === pit[1];
            const isGoal = r === goal[0] && c === goal[1];
            const dist = Math.abs(goal[0] - r) + Math.abs(goal[1] - c);
            const heat = 1 - dist / maxDist;
            return (
              <rect
                key={`${r}-${c}`}
                className={`aprendizado-cell ${isWall ? "wall" : isPit ? "pit" : isGoal ? "goal" : ""}`}
                x={c * cellW}
                y={r * cellH}
                width={cellW}
                height={cellH}
                style={isWall || isPit || isGoal ? undefined : { opacity: 0.3 + heat * 0.55 }}
              />
            );
          })
        )}
        <circle className="aprendizado-agent" r="2.6" />
      </svg>
    </div>
  );
}

export function Game2048Preview() {
  return (
    <div className="card-preview g2048-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">grid_4x4</span>
      </span>
      <div className="g2048-mini">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="cell" />
        ))}
        <span className="tile t-2">2</span>
        <span className="tile t-4">4</span>
        <span className="tile t-8">8</span>
        <span className="tile t-16">16</span>
        <span className="tile t-spawn">2</span>
      </div>
    </div>
  );
}

export function TetrisPreview() {
  return (
    <div className="card-preview tetris-home-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">view_column_2</span>
      </span>
      <div className="well">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className="cell" />
        ))}
        <span className="block b-stack-1" />
        <span className="block b-stack-2" />
        <span className="block b-stack-3" />
        <span className="block b-stack-4" />
        <span className="block b-stack-5" />
        <span className="block b-falling" />
      </div>
    </div>
  );
}

export function Lig4Preview() {
  return (
    <div className="card-preview lig4-home-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">grid_on</span>
      </span>
      <div className="well">
        {Array.from({ length: 20 }, (_, i) => (
          <span key={i} className="cell" />
        ))}
        <span className="disc d-red d-1" />
        <span className="disc d-yellow d-2" />
        <span className="disc d-red d-3" />
        <span className="disc d-yellow d-4" />
        <span className="disc d-falling" />
      </div>
    </div>
  );
}

export function SudokuPreview() {
  const cols = 9;
  const rows = 6;
  const cellW = 110 / cols;
  const cellH = 66 / rows;
  // A handful of static digits scattered across a couple of boxes, suggesting a partially-solved
  // puzzle, plus one cell whose pencil-mark candidates cycle through - a small nod to Forward
  // Checking/AC-3 narrowing a domain before a value finally lands.
  const digits: { r: number; c: number; v: number }[] = [
    { r: 0, c: 1, v: 5 },
    { r: 0, c: 4, v: 9 },
    { r: 1, c: 6, v: 2 },
    { r: 2, c: 2, v: 7 },
    { r: 3, c: 7, v: 4 },
    { r: 4, c: 0, v: 8 },
    { r: 5, c: 5, v: 3 },
  ];
  return (
    <div className="card-preview sudoku-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">grid_3x3</span>
      </span>
      <svg viewBox="0 0 110 66" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: cols + 1 }, (_, c) => (
          <line key={`v${c}`} className={`sudoku-grid-line ${c % 3 === 0 ? "thick" : ""}`} x1={c * cellW} y1={0} x2={c * cellW} y2={66} />
        ))}
        {Array.from({ length: rows + 1 }, (_, r) => (
          <line key={`h${r}`} className={`sudoku-grid-line ${r % 3 === 0 ? "thick" : ""}`} x1={0} y1={r * cellH} x2={110} y2={r * cellH} />
        ))}
        {digits.map(({ r, c, v }, i) => (
          <text key={i} className="sudoku-digit-svg" x={c * cellW + cellW / 2} y={r * cellH + cellH / 2 + 2.5}>
            {v}
          </text>
        ))}
        <rect className="sudoku-scan" x={3 * cellW + 1} y={2 * cellH + 1} width={cellW - 2} height={cellH - 2} rx="1.5" />
      </svg>
    </div>
  );
}

export function SnakePreview() {
  const cols = 11;
  const rows = 7;
  // A short body bending around one corner (not a straight line) so the preview reads as a real
  // snake shape rather than a plain bar, plus a food dot ahead of the head.
  const body = [
    [3, 5],
    [3, 4],
    [3, 3],
    [2, 3],
    [1, 3],
  ];
  const food: [number, number] = [3, 8];
  return (
    <div className="card-preview snake-home-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">polyline</span>
      </span>
      <div className="well">
        {Array.from({ length: cols * rows }, (_, i) => (
          <span key={i} className="cell" style={{ gridColumn: (i % cols) + 1, gridRow: Math.floor(i / cols) + 1 }} />
        ))}
        {body.map(([r, c], i) => (
          <span key={i} className="segment" style={{ gridColumn: c + 1, gridRow: r + 1 }} />
        ))}
        <span className="food" style={{ gridColumn: food[1] + 1, gridRow: food[0] + 1 }} />
      </div>
    </div>
  );
}

export function MinesweeperPreview() {
  const cols = 9;
  const rows = 6;
  const cellW = 110 / cols;
  const cellH = 66 / rows;
  const digits: { r: number; c: number; v: number }[] = [
    { r: 0, c: 1, v: 1 },
    { r: 0, c: 2, v: 2 },
    { r: 1, c: 4, v: 1 },
    { r: 2, c: 5, v: 3 },
    { r: 3, c: 1, v: 2 },
    { r: 4, c: 6, v: 1 },
  ];
  const flag = { r: 1, c: 2 };
  const guess = { r: 2, c: 3 };
  const revealedSet = new Set(digits.map(({ r, c }) => `${r}-${c}`));
  const digitColor: Record<number, string> = { 1: "#4d7bf3", 2: "#46c25e", 3: "#ef4b4b" };
  return (
    <div className="card-preview campo-minado-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">flag</span>
      </span>
      <svg viewBox="0 0 110 66" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const isRevealed = revealedSet.has(`${r}-${c}`);
            const isFlag = r === flag.r && c === flag.c;
            const isGuess = r === guess.r && c === guess.c;
            return (
              <rect
                key={`${r}-${c}`}
                className={isRevealed || isFlag || isGuess ? "cm-cell-revealed" : "cm-cell-hidden"}
                x={c * cellW}
                y={r * cellH}
                width={cellW - 0.6}
                height={cellH - 0.6}
                rx="1"
              />
            );
          })
        )}
        {digits.map(({ r, c, v }, i) => (
          <text key={i} className="cm-digit" x={c * cellW + cellW / 2} y={r * cellH + cellH / 2 + 2.3} style={{ fill: digitColor[v] }}>
            {v}
          </text>
        ))}
        <circle className="cm-flag" cx={flag.c * cellW + cellW / 2} cy={flag.r * cellH + cellH / 2} r={cellW * 0.16} />
        <text className="cm-guess" x={guess.c * cellW + cellW / 2} y={guess.r * cellH + cellH / 2 + 2}>
          ?
        </text>
      </svg>
    </div>
  );
}

export function BattleshipPreview() {
  const cols = 10;
  const rows = 6;
  const cellW = 110 / cols;
  const cellH = 66 / rows;
  const ship = [
    { r: 2, c: 5 },
    { r: 2, c: 6 },
    { r: 2, c: 7 },
  ];
  const hits = [{ r: 2, c: 6 }];
  const miss = { r: 1, c: 6 };
  const target = { r: 2, c: 7 };
  const shipSet = new Set(ship.map(({ r, c }) => `${r}-${c}`));
  const hitSet = new Set(hits.map(({ r, c }) => `${r}-${c}`));
  return (
    <div className="card-preview batalha-naval-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">radar</span>
      </span>
      <svg viewBox="0 0 110 66" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const key = `${r}-${c}`;
            const isShip = shipSet.has(key);
            return (
              <rect
                key={key}
                className={isShip ? "bn-cell-ship" : "bn-cell-water"}
                x={c * cellW}
                y={r * cellH}
                width={cellW - 0.6}
                height={cellH - 0.6}
                rx="1"
              />
            );
          })
        )}
        {hits.map(({ r, c }, i) => <circle key={i} className="bn-hit" cx={c * cellW + cellW / 2} cy={r * cellH + cellH / 2} r={cellW * 0.16} />)}
        <circle className="bn-miss" cx={miss.c * cellW + cellW / 2} cy={miss.r * cellH + cellH / 2} r={cellW * 0.14} />
        <rect
          className="bn-crosshair"
          x={target.c * cellW + 0.8}
          y={target.r * cellH + 0.8}
          width={cellW - 2.2}
          height={cellH - 2.2}
          rx="1.5"
          style={{ opacity: hitSet.has(`${target.r}-${target.c}`) ? 0 : 1 }}
        />
      </svg>
    </div>
  );
}

export function DungeonPreview() {
  return (
    <div className="card-preview dungeon-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">castle</span>
      </span>
      <img className="dp-monster" src="/sprites/dungeon/monster-ghost.png" alt="" draggable={false} />
      <img className="dp-hero" src="/sprites/dungeon/hero.png" alt="" draggable={false} />
      <img className="dp-monster" src="/sprites/dungeon/monster-bat.png" alt="" draggable={false} style={{ animationDelay: "-0.35s" }} />
      <img className="dp-monster" src="/sprites/dungeon/monster-spider.png" alt="" draggable={false} style={{ animationDelay: "-0.7s" }} />
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

/** Same beacon/route visual language as MazePreview (this module reuses its 3D scene), but zoomed
 *  into a single node lighting up on a small explicit graph instead of a maze corridor - the
 *  point here is "watch the frontier pick the next node", not "navigate a maze". */
export function AstarPreview() {
  return (
    <div className="card-preview astar-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">route</span>
      </span>
      <svg viewBox="0 0 110 66" preserveAspectRatio="xMidYMid meet">
        <line x1="14" y1="50" x2="40" y2="20" className="astar-edge" />
        <line x1="40" y1="20" x2="70" y2="30" className="astar-edge" />
        <line x1="70" y1="30" x2="96" y2="14" className="astar-edge" />
        <line x1="14" y1="50" x2="46" y2="52" className="astar-edge astar-edge-dim" />
        <line x1="46" y1="52" x2="70" y2="30" className="astar-edge astar-edge-dim" />
        <line x1="70" y1="30" x2="60" y2="56" className="astar-edge astar-edge-dim" />
        <circle cx="14" cy="50" r="3.4" className="astar-node astar-node-start" />
        <circle cx="40" cy="20" r="3" className="astar-node" />
        <circle cx="46" cy="52" r="3" className="astar-node" />
        <circle cx="70" cy="30" r="3" className="astar-node astar-node-current" />
        <circle cx="60" cy="56" r="3" className="astar-node" />
        <circle cx="96" cy="14" r="3.4" className="astar-node astar-node-goal" />
      </svg>
    </div>
  );
}

/** Mirrors the tutorial's static MinimaxTree SVG (components/tutorial/TutorialVisuals.tsx) - same
 *  three-layer shape and pruned-branch language, but animated: nodes light up depth-first and the
 *  right branch's pruned stubs fade in, echoing what the real 3D explainer page does node by node. */
export function MinimaxPreview() {
  return (
    <div className="card-preview minimax-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">account_tree</span>
      </span>
      <svg viewBox="0 0 110 66" preserveAspectRatio="xMidYMid meet">
        <path className="mm-edge mm-e1" d="M55,10 L26,32" />
        <path className="mm-edge mm-e2" d="M55,10 L55,32" />
        <path className="mm-edge mm-e3" d="M55,10 L84,32" />
        <path className="mm-edge mm-e4" d="M26,32 L14,54" />
        <path className="mm-edge mm-e5" d="M26,32 L38,54" />
        <path className="mm-edge mm-e6" d="M55,32 L47,54" />
        <path className="mm-edge mm-e7" d="M55,32 L63,54" />
        <path className="mm-edge mm-e8 mm-pruned" strokeDasharray="2.5,2.5" d="M84,32 L76,54" />
        <path className="mm-edge mm-e9 mm-pruned" strokeDasharray="2.5,2.5" d="M84,32 L92,54" />
        <circle className="mm-node mm-n1" cx="55" cy="10" r="4.4" />
        <circle className="mm-node mm-n2" cx="26" cy="32" r="3.6" />
        <circle className="mm-node mm-n3" cx="55" cy="32" r="3.6" />
        <circle className="mm-node mm-n4" cx="84" cy="32" r="3.6" />
        <circle className="mm-node mm-n5" cx="14" cy="54" r="3" />
        <circle className="mm-node mm-n6" cx="38" cy="54" r="3" />
        <circle className="mm-node mm-n7" cx="47" cy="54" r="3" />
        <circle className="mm-node mm-n8" cx="63" cy="54" r="3" />
        <circle className="mm-node mm-n9 mm-pruned" cx="76" cy="54" r="3" />
        <circle className="mm-node mm-n10 mm-pruned" cx="92" cy="54" r="3" />
      </svg>
    </div>
  );
}

/** A little swarm of dots drifting from a scattered start toward the target, converging over the
 *  loop's course - the "whole population moving at once" idea this module explains, compressed
 *  into a 2s CSS loop instead of the full 3D arena. */
export function AlgoritmoGeneticoPreview() {
  return (
    <div className="card-preview ag-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">biotech</span>
      </span>
      <svg viewBox="0 0 110 66" preserveAspectRatio="xMidYMid meet">
        <circle cx="96" cy="14" r="4" className="ag-target" />
        <circle className="ag-dot ag-d1" r="2.2" />
        <circle className="ag-dot ag-d2" r="2.2" />
        <circle className="ag-dot ag-d3" r="2.2" />
        <circle className="ag-dot ag-d4" r="2.2" />
        <circle className="ag-dot ag-d5" r="2.2" />
        <circle className="ag-dot ag-d6" r="2.2" />
      </svg>
    </div>
  );
}

export function PerceptronPreview() {
  return (
    <div className="card-preview perceptron-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">scatter_plot</span>
      </span>
      <svg viewBox="0 0 110 66" preserveAspectRatio="xMidYMid meet">
        <line x1="8" y1="46" x2="100" y2="16" className="lc-boundary" />
        <circle cx="18" cy="14" r="2.6" className="lc-dot-0" />
        <circle cx="30" cy="10" r="2.6" className="lc-dot-0" />
        <circle cx="16" cy="28" r="2.6" className="lc-dot-0" />
        <circle cx="34" cy="22" r="2.6" className="lc-dot-0" />
        <circle cx="76" cy="50" r="2.6" className="lc-dot-1" />
        <circle cx="90" cy="40" r="2.6" className="lc-dot-1" />
        <circle cx="70" cy="58" r="2.6" className="lc-dot-1" />
        <circle cx="96" cy="54" r="2.6" className="lc-dot-1" />
      </svg>
    </div>
  );
}

export function PenduloPreview() {
  return (
    <div className="card-preview pendulo-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">balance</span>
      </span>
      <svg viewBox="0 0 110 66" preserveAspectRatio="xMidYMid meet">
        <line x1="15" y1="50" x2="95" y2="50" className="pendulo-track" />
        <g className="pendulo-rig">
          <rect x="-11" y="-8" width="22" height="12" rx="2" className="pendulo-cart" />
          <g className="pendulo-pole">
            <line x1="0" y1="-8" x2="0" y2="-30" className="pendulo-rod" />
            <circle cx="0" cy="-30" r="3.4" className="pendulo-bob" />
          </g>
        </g>
      </svg>
    </div>
  );
}

export function HopfieldPreview() {
  // A 5x5 "X" - one of the actual stored patterns from the module's PATTERN_LIBRARY - flickering
  // back to clean from two corrupted cells, standing in for energy-minimizing recall.
  const CELL = 20;
  const pattern = new Set(["0-0", "1-1", "2-2", "3-3", "4-4", "0-4", "1-3", "3-1", "4-0"]);
  return (
    <div className="card-preview hopfield-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">memory</span>
      </span>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: 5 }).map((_, r) =>
          Array.from({ length: 5 }).map((_, c) => {
            const on = pattern.has(`${r}-${c}`);
            return <rect key={`${r}-${c}`} className={on ? "hf-on" : "hf-off"} x={c * CELL + 1} y={r * CELL + 1} width={CELL - 2} height={CELL - 2} rx={2} />;
          })
        )}
        <rect className="hf-noise hf-noise-a" x={2 * CELL + 1} y={0 * CELL + 1} width={CELL - 2} height={CELL - 2} rx={2} />
        <rect className="hf-noise hf-noise-b" x={0 * CELL + 1} y={2 * CELL + 1} width={CELL - 2} height={CELL - 2} rx={2} />
      </svg>
    </div>
  );
}

export function DigitosPreview() {
  // A small pixel-art "2", the same shape as the module's own hand-authored template, with a scan
  // line sweeping down it on a loop - standing in for live recognition as you draw.
  const GRID = 8;
  const CELL = 100 / GRID;
  const rows = ["..####..", ".#....#.", "......#.", ".....#..", "....#...", "...#....", "..#.....", "#######."];
  const cells: { r: number; c: number }[] = [];
  rows.forEach((row, r) => row.split("").forEach((ch, c) => ch === "#" && cells.push({ r, c })));
  return (
    <div className="card-preview digitos-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">draw</span>
      </span>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {cells.map(({ r, c }, i) => (
          <rect key={i} className="dg-cell" x={c * CELL + 1} y={r * CELL + 1} width={CELL - 2} height={CELL - 2} rx={1.5} />
        ))}
        <rect className="dg-scan" x={0} y={0} width={100} height={14} />
      </svg>
    </div>
  );
}

export function GatosCachorrosPreview() {
  // Two of the module's own real (openly-licensed) training photos, crossfading - the one preview
  // on the homepage built from actual photographs rather than a procedural/CSS illustration, since
  // that real-photo-ness is the whole point of this module.
  return (
    <div className="card-preview gc-preview">
      <span className="badge">
        <span className="material-symbols-outlined text-[13px]">pets</span>
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element -- small local static thumbnails, not worth Next/Image's remote-optimization machinery */}
      <img className="gc-photo gc-photo-a" src="/gatos-cachorros/gato/gato-04.jpg" alt="" />
      {/* eslint-disable-next-line @next/next/no-img-element -- small local static thumbnails, not worth Next/Image's remote-optimization machinery */}
      <img className="gc-photo gc-photo-b" src="/gatos-cachorros/cachorro/cachorro-11.jpg" alt="" />
      <span className="gc-chip gc-chip-a">gato</span>
      <span className="gc-chip gc-chip-b">cachorro</span>
    </div>
  );
}
