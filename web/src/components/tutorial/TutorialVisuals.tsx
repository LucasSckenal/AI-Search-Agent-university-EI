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
