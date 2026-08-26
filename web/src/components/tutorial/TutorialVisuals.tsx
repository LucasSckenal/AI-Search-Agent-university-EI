import type { CSSProperties } from "react";

/**
 * Presentational visuals for the /tutorial page - all pure CSS/SVG animation (see the
 * "tutorial page" section of globals.css), no client JS needed beyond what the page itself
 * already does for scroll-reveal, so these stay plain server-renderable components.
 */

const COLS = 6;
const ROWS = 4;

/** BFS: rings expanding from the corner (Manhattan distance). DFS: one continuous serpentine
 *  sweep, cell by cell. Both grids share the same per-dot animation duration (set in CSS) so the
 *  *pattern* difference - parallel rings vs a single traveling line - is what actually reads. */
export function WaveGrid({ variant, stepMs }: { variant: "bfs" | "dfs"; stepMs: number }) {
  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) cells.push({ r, c });
  const delayFor = (r: number, c: number) =>
    variant === "bfs" ? r + c : r % 2 === 0 ? r * COLS + c : r * COLS + (COLS - 1 - c);

  return (
    <div className="tut-gwrap" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
      {cells.map(({ r, c }) => (
        <div
          key={`${r}-${c}`}
          className={`tut-gdot lit ${variant === "bfs" ? "acc-primary" : "acc-secondary"}`}
          style={{ animationDelay: `${delayFor(r, c) * stepMs}ms` }}
        />
      ))}
    </div>
  );
}

/** Informed search: only the cells along a direct stairstep path from corner to corner light up -
 *  everything else stays dim, visually contrasting "explores everything" (WaveGrid) with
 *  "explores just what's needed". */
export function PathGrid() {
  const path: Record<string, number> = {
    "0,0": 0, "0,1": 1, "1,1": 2, "1,2": 3, "2,2": 4, "2,3": 5, "3,3": 6,
  };
  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) cells.push({ r, c });

  return (
    <div className="tut-gwrap" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
      {cells.map(({ r, c }) => {
        const order = path[`${r},${c}`];
        return (
          <div
            key={`${r}-${c}`}
            className={order !== undefined ? "tut-gdot lit acc-primary" : "tut-gdot"}
            style={order !== undefined ? { animationDelay: `${order * 260}ms` } : undefined}
          />
        );
      })}
    </div>
  );
}

/** Minimax decision tree: root -> 3 possible moves -> 2 opponent replies each. The rightmost
 *  subtree is rendered "pruned" (dashed edges, dimmed nodes, a label) - alpha-beta cutting off a
 *  branch that can't change the outcome, without needing a real search-tree instrumentation. */
export function MinimaxTree() {
  return (
    <svg viewBox="0 0 300 160" className="tut-tree-svg">
      <path className="tut-tedge e-root" d="M150,18 L60,75" />
      <path className="tut-tedge e-root" d="M150,18 L150,75" />
      <path className="tut-tedge e-root" d="M150,18 L240,75" />
      <path className="tut-tedge e-child" d="M60,75 L35,135" />
      <path className="tut-tedge e-child" d="M60,75 L85,135" />
      <path className="tut-tedge e-child" d="M150,75 L125,135" />
      <path className="tut-tedge e-child" d="M150,75 L175,135" />
      <path className="tut-tedge e-child pruned" strokeDasharray="3,3" d="M240,75 L215,135" />
      <path className="tut-tedge e-child pruned" strokeDasharray="3,3" d="M240,75 L265,135" />
      <circle className="tut-tnode n-root" cx="150" cy="18" r="6" />
      <circle className="tut-tnode n-child" cx="60" cy="75" r="5" />
      <circle className="tut-tnode n-child" cx="150" cy="75" r="5" />
      <circle className="tut-tnode n-child" cx="240" cy="75" r="5" />
      <circle className="tut-tnode n-grand" cx="35" cy="135" r="4" />
      <circle className="tut-tnode n-grand" cx="85" cy="135" r="4" />
      <circle className="tut-tnode n-grand" cx="125" cy="135" r="4" />
      <circle className="tut-tnode n-grand" cx="175" cy="135" r="4" />
      <circle className="tut-tnode n-grand pruned" cx="215" cy="135" r="4" />
      <circle className="tut-tnode n-grand pruned" cx="265" cy="135" r="4" />
      <text className="tut-prune-label" x="203" y="154">
        podado
      </text>
    </svg>
  );
}

/** The A* route-drawing demo, blown up large - same shape/paths the small home-page card preview
 *  uses (see components/home/ModulePreviews.tsx MazePreview), duplicated here rather than shared
 *  since that component's CSS assumes the small fixed-height card context. */
export function TutorialMazeHero() {
  return (
    <div className="tut-maze-hero">
      <svg viewBox="0 0 110 66">
        <defs>
          <pattern id="tutMazeGrid" width="11" height="11" patternUnits="userSpaceOnUse">
            <circle className="tut-maze-dot" cx="1" cy="1" r="0.6" />
          </pattern>
        </defs>
        <rect width="110" height="66" fill="url(#tutMazeGrid)" />
        <rect className="tut-maze-wall" x="18" y="8" width="8" height="24" />
        <rect className="tut-maze-wall" x="46" y="30" width="8" height="24" />
        <rect className="tut-maze-wall" x="78" y="20" width="20" height="8" />
        <rect className="tut-maze-wall" x="8" y="8" width="16" height="8" />
        <path className="tut-maze-dead d1" d="M10,58 L10,45 L25,45 L25,30" />
        <path className="tut-maze-dead d2" d="M38,38 L38,55 L55,55" />
        <path className="tut-maze-route" d="M10,58 L10,38 L38,38 L38,16 L70,16 L70,46 L100,46 L100,10" />
        <circle className="tut-maze-spark" r="3" />
        <circle className="tut-maze-wp start" cx="10" cy="58" r="3" />
        <circle className="tut-maze-wp goal" cx="100" cy="10" r="3" />
      </svg>
    </div>
  );
}

const GEN_START_HEIGHTS = [22, 48, 14, 58, 10, 34, 18, 50, 26, 15];
const GEN_CONVERGED_HEIGHTS = [86, 94, 80, 97, 84, 90, 78, 95, 88, 91];

/** Genetic Algorithm: a population's fitness (bar height) at generation 0 - random, mostly low -
 *  versus a late generation - mostly high, but not perfectly uniform, since selection favors the
 *  fittest without erasing all variation. Each bar eases up from near-zero to its target height on
 *  a loop, staggered left to right, echoing WaveGrid's staggered reveal for BFS/DFS. */
export function GenerationBars({ variant }: { variant: "start" | "converged" }) {
  const heights = variant === "start" ? GEN_START_HEIGHTS : GEN_CONVERGED_HEIGHTS;
  return (
    <div className="tut-bars">
      {heights.map((h, i) => (
        <div
          key={i}
          className={`tut-bar ${variant}`}
          style={{ "--bar-h": `${h}%`, animationDelay: `${i * 90}ms` } as CSSProperties}
        />
      ))}
    </div>
  );
}

const PRUNE_ROWS = 5;
const PRUNE_COLS = 5;
// The same 5-queen solution (one per column) both variants land on - what differs is how much of
// the board gets touched on the way there.
const PRUNE_SOLVED = new Set(["0,0", "1,2", "2,4", "3,1", "4,3"]);
// Forward Checking prunes these candidate cells the instant they conflict, so they get a small "x"
// instead of ever being explored - the cells outside both sets are simply never visited at all.
const PRUNE_ONLY = new Set(["0,2", "0,3", "0,4", "1,0", "1,4", "2,1", "2,2", "3,3", "3,4"]);

/** CSP comparison: plain Backtracking lights up almost every cell before landing on the solution
 *  (it has to actually try - and fail - each conflicting placement); Forward Checking marks a
 *  conflicting cell with an "x" the moment a queen makes it invalid, and never visits it at all. */
export function QueensPruneGrid({ variant }: { variant: "backtracking" | "forwardchecking" }) {
  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < PRUNE_ROWS; r++) for (let c = 0; c < PRUNE_COLS; c++) cells.push({ r, c });

  return (
    <div className="tut-gwrap" style={{ gridTemplateColumns: `repeat(${PRUNE_COLS}, 1fr)` }}>
      {cells.map(({ r, c }) => {
        const key = `${r},${c}`;
        if (PRUNE_SOLVED.has(key)) {
          return <div key={key} className="tut-gdot lit acc-primary" style={{ animationDelay: `${c * 300}ms` }} />;
        }
        if (variant === "forwardchecking" && PRUNE_ONLY.has(key)) {
          return <div key={key} className="tut-gdot pruned" style={{ animationDelay: `${c * 300 + 120}ms` }} />;
        }
        if (variant === "backtracking") {
          return <div key={key} className="tut-gdot lit acc-secondary" style={{ animationDelay: `${(r * PRUNE_COLS + c) * 55}ms` }} />;
        }
        return <div key={key} className="tut-gdot" />;
      })}
    </div>
  );
}

const RL_COLS = 8;
const RL_ROWS = 5;
const RL_GOAL: [number, number] = [RL_ROWS - 1, RL_COLS - 1];
const RL_WALL: [number, number] = [1, 4];
const RL_PIT: [number, number] = [3, 2];
const RL_MAX_DIST = RL_ROWS - 1 + (RL_COLS - 1);
// The agent's fixed learned route from start to goal, avoiding the wall and the pit - drives both
// the SVG path cells never touch and the .tut-rl-agent offset-path animation in CSS.
const RL_ROUTE: [number, number][] = [
  [0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [2, 3], [2, 4], [2, 5], [2, 6], [3, 6], [4, 6], [4, 7],
];

/** RL hero (screen 9) - same "blow up the home-card preview's visual language" approach
 *  TutorialMazeHero already uses for the maze: a bigger heatmap grid (warmer near the goal) with
 *  one agent dot walking RL_ROUTE via offset-path, duplicated rather than shared for the same
 *  reason TutorialMazeHero is (the small card preview's CSS assumes its fixed card context). The
 *  offset-path string is computed from RL_ROUTE rather than hand-typed, so it can't silently drift
 *  out of sync with RL_WALL/RL_PIT if this route ever changes. */
export function TutorialRLHero() {
  const cellW = 110 / RL_COLS;
  const cellH = 66 / RL_ROWS;
  const center = (r: number, c: number) => [(c + 0.5) * cellW, (r + 0.5) * cellH];
  const routePath = RL_ROUTE.map(([r, c], i) => `${i === 0 ? "M" : "L"}${center(r, c).join(",")}`).join(" ");

  return (
    <div className="tut-rl-hero">
      <svg viewBox="0 0 110 66">
        {Array.from({ length: RL_ROWS }, (_, r) =>
          Array.from({ length: RL_COLS }, (_, c) => {
            const isWall = r === RL_WALL[0] && c === RL_WALL[1];
            const isPit = r === RL_PIT[0] && c === RL_PIT[1];
            const isGoal = r === RL_GOAL[0] && c === RL_GOAL[1];
            const dist = Math.abs(RL_GOAL[0] - r) + Math.abs(RL_GOAL[1] - c);
            const heat = 1 - dist / RL_MAX_DIST;
            return (
              <rect
                key={`${r}-${c}`}
                className={`tut-rl-cell ${isWall ? "wall" : isPit ? "pit" : isGoal ? "goal" : ""}`}
                x={c * cellW}
                y={r * cellH}
                width={cellW}
                height={cellH}
                style={isWall || isPit || isGoal ? undefined : { opacity: 0.28 + heat * 0.6 }}
              />
            );
          })
        )}
        <circle className="tut-rl-agent" r="2.4" style={{ offsetPath: `path("${routePath}")` }} />
      </svg>
    </div>
  );
}
