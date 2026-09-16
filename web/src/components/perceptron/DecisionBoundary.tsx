import { forward, Network, Point } from "@/lib/perceptron/model";

const VIEW = 400;
const GRID = 32;
const CLASS_0_COLOR = "#7ea8f5";
const CLASS_1_COLOR = "#f2c94c";
const WRONG_COLOR = "#e0555f";

function toView(v: number): number {
  return ((v + 1) / 2) * VIEW;
}

/**
 * The main stage: a sampled heatmap of what the network currently predicts across the whole plane
 * (recomputed from the live network every frame, not pre-rendered), with the actual training points
 * on top - filled by their true label, ringed in red when the current network gets them wrong. This
 * is the one visual that actually answers "the network is learning": watching the tinted region
 * bend to match the dots, epoch by epoch.
 */
export function DecisionBoundary({
  network,
  dataset,
  onHover,
}: {
  network: Network;
  dataset: Point[];
  onHover?: (p: { x: number; y: number } | null) => void;
}) {
  const cell = VIEW / GRID;
  const cells: { x: number; y: number; p: number }[] = [];
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const worldX = ((gx + 0.5) / GRID) * 2 - 1;
      const worldY = ((gy + 0.5) / GRID) * 2 - 1;
      const { output } = forward(network, worldX, worldY);
      cells.push({ x: gx * cell, y: gy * cell, p: output });
    }
  }

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onHover) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    onHover({ x: px * 2 - 1, y: py * 2 - 1 });
  };

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      onMouseMove={handleMove}
      onMouseLeave={() => onHover?.(null)}
    >
      <rect x={0} y={0} width={VIEW} height={VIEW} fill="var(--surface-container-lowest)" />
      {cells.map((c, i) => {
        // p=0 -> class-0 tint, p=1 -> class-1 tint, confidence (distance from 0.5) drives opacity so
        // an undecided boundary region reads as neutral rather than committing to a color.
        const color = c.p > 0.5 ? CLASS_1_COLOR : CLASS_0_COLOR;
        const confidence = Math.abs(c.p - 0.5) * 2;
        return <rect key={i} x={c.x} y={c.y} width={cell + 0.5} height={cell + 0.5} fill={color} opacity={0.06 + 0.3 * confidence} />;
      })}

      {dataset.map((p, i) => {
        const { output } = forward(network, p.x, p.y);
        const predicted = output > 0.5 ? 1 : 0;
        const wrong = predicted !== p.label;
        return (
          <circle
            key={i}
            cx={toView(p.x)}
            cy={toView(p.y)}
            r={4.5}
            fill={p.label === 1 ? CLASS_1_COLOR : CLASS_0_COLOR}
            stroke={wrong ? WRONG_COLOR : "rgba(255,255,255,0.5)"}
            strokeWidth={wrong ? 2 : 1}
          />
        );
      })}
    </svg>
  );
}
