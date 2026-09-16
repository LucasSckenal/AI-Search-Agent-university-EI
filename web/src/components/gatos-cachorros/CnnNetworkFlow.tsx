import { Network } from "@/lib/gatos-cachorros/model";

const VIEW_W = 480;
const VIEW_H = 280;
const TOP_PAD = 30;
const BOTTOM_PAD = 20;
const USABLE_H = VIEW_H - TOP_PAD - BOTTOM_PAD;
const THUMB = 46;
const FILTER_X = 66;
const HIDDEN_X = 268;
const OUTPUT_X = 420;
const NEGATIVE_COLOR = "#7ea8f5";

function nodeY(index: number, count: number, topPad = TOP_PAD, usableH = USABLE_H): number {
  return topPad + ((index + 0.5) / count) * usableH;
}

/** One filter's pooled activation grid, drawn inline as a small square of cells - the same
 *  brightness-per-cell language as the shared GrayscaleGrid, just positioned as a node in this
 *  diagram instead of standing alone in its own <svg>. */
function FilterThumb({ values, size, cx, cy, ring, accentColor }: { values: number[]; size: number; cx: number; cy: number; ring: number; accentColor: string }) {
  const cell = THUMB / size;
  const x0 = cx - THUMB / 2;
  const y0 = cy - THUMB / 2;
  return (
    <g>
      <rect
        x={x0 - 3}
        y={y0 - 3}
        width={THUMB + 6}
        height={THUMB + 6}
        rx={6}
        fill="none"
        stroke={accentColor}
        strokeOpacity={0.15 + 0.55 * ring}
        strokeWidth={1.5}
      />
      <rect x={x0} y={y0} width={THUMB} height={THUMB} fill="var(--surface-container-lowest)" rx={4} />
      {values.map((v, i) => {
        const r = Math.floor(i / size);
        const c = i % size;
        return (
          <rect
            key={i}
            x={x0 + c * cell}
            y={y0 + r * cell}
            width={cell}
            height={cell}
            fill={accentColor}
            fillOpacity={Math.max(0, Math.min(1, v))}
          />
        );
      })}
    </g>
  );
}

/**
 * The forward pass as a live flow diagram, in the same visual language as Perceptron's network
 * viz (node brightness = activation, edge color/thickness = weight sign/magnitude) but adapted for
 * a CNN: the 4 conv filters are drawn as their actual pooled activation grids rather than plain
 * circles (there's no single "weight" from a 32x32 image to a filter, so a thumbnail is the honest
 * stand-in), then a real dense layer (16 hidden units) and a real output unit, both using the
 * network's actual weights. Filter->hidden edges use the average of that filter's 225 flatten
 * weights into each hidden unit - a genuine aggregate, not an invented number, since a hidden unit
 * has no single scalar connection to a whole filter. Layers fade in with a staggered delay (see
 * .flow-stage in globals.css) so watching a fresh prediction land reads as data moving through the
 * network left to right, not just four unrelated panels appearing at once.
 */
export function CnnNetworkFlow({
  network,
  pooled,
  hidden,
  output,
  labels,
  accentColor = "var(--primary)",
}: {
  network: Network;
  pooled: number[][][];
  hidden: number[];
  output: number;
  labels: string[];
  accentColor?: string;
}) {
  const numFilters = pooled.length;
  const poolSize = pooled[0]?.length ?? 0;
  const hiddenCount = hidden.length;
  const span = poolSize * poolSize;

  const filterHiddenWeight = (f: number, j: number): number => {
    let sum = 0;
    const base = f * span;
    for (let i = 0; i < span; i++) sum += network.denseW[j][base + i];
    return sum / span;
  };

  type Edge = { x1: number; y1: number; x2: number; y2: number; w: number };
  const fhEdges: Edge[] = [];
  for (let f = 0; f < numFilters; f++) {
    for (let j = 0; j < hiddenCount; j++) {
      fhEdges.push({ x1: FILTER_X, y1: nodeY(f, numFilters), x2: HIDDEN_X, y2: nodeY(j, hiddenCount), w: filterHiddenWeight(f, j) });
    }
  }
  let maxFh = 1e-6;
  for (const e of fhEdges) maxFh = Math.max(maxFh, Math.abs(e.w));

  const hoEdges: Edge[] = network.outW.map((w, j) => ({
    x1: HIDDEN_X,
    y1: nodeY(j, hiddenCount),
    x2: OUTPUT_X,
    y2: VIEW_H / 2,
    w,
  }));
  let maxHo = 1e-6;
  for (const e of hoEdges) maxHo = Math.max(maxHo, Math.abs(e.w));

  const predictedIsSecond = output >= 0.5;
  const decisionLabel = predictedIsSecond ? labels[1] : labels[0];
  const decisionPct = Math.round((predictedIsSecond ? output : 1 - output) * 100);

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <g className="flow-stage" style={{ animationDelay: "0ms" }}>
        {pooled.map((grid, f) => {
          const flat = grid.flat();
          const avg = flat.reduce((a, v) => a + v, 0) / (flat.length || 1);
          return <FilterThumb key={f} values={flat} size={poolSize} cx={FILTER_X} cy={nodeY(f, numFilters)} ring={avg} accentColor={accentColor} />;
        })}
      </g>

      <g className="flow-stage" style={{ animationDelay: "260ms" }}>
        {fhEdges.map((e, i) => {
          const strength = Math.abs(e.w) / maxFh;
          return (
            <line
              key={i}
              className="flow-edge"
              x1={e.x1 + THUMB / 2 + 3}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke={e.w >= 0 ? accentColor : NEGATIVE_COLOR}
              strokeWidth={0.4 + 1.2 * strength}
              opacity={0.05 + 0.35 * strength}
              style={{ animationDuration: `${1.1 + (i % 5) * 0.15}s` }}
            />
          );
        })}
      </g>

      <g className="flow-stage" style={{ animationDelay: "520ms" }}>
        {hidden.map((v, j) => {
          const b = Math.max(0, Math.min(1, (v + 1) / 2));
          const cx = HIDDEN_X;
          const cy = nodeY(j, hiddenCount);
          return (
            <circle
              key={j}
              cx={cx}
              cy={cy}
              r={5.5}
              fill={accentColor}
              fillOpacity={0.1 + 0.8 * b}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={1}
            />
          );
        })}
      </g>

      <g className="flow-stage" style={{ animationDelay: "780ms" }}>
        {hoEdges.map((e, i) => {
          const strength = Math.abs(e.w) / maxHo;
          return (
            <line
              key={i}
              className="flow-edge"
              x1={e.x1}
              y1={e.y1}
              x2={e.x2 - 12}
              y2={e.y2}
              stroke={e.w >= 0 ? accentColor : NEGATIVE_COLOR}
              strokeWidth={0.5 + 1.8 * strength}
              opacity={0.1 + 0.55 * strength}
              style={{ animationDuration: `${1 + (i % 6) * 0.12}s` }}
            />
          );
        })}
      </g>

      <g className="flow-stage" style={{ animationDelay: "1000ms" }}>
        <circle
          className="flow-decision-pulse"
          cx={OUTPUT_X}
          cy={VIEW_H / 2}
          r={12}
          fill={accentColor}
          fillOpacity={0.15 + 0.75 * (predictedIsSecond ? output : 1 - output)}
          style={{
            filter: `drop-shadow(0 0 6px color-mix(in srgb, ${accentColor} ${40 + 40 * decisionPct * 0.01}%, transparent))`,
          }}
        />
        <circle cx={OUTPUT_X} cy={VIEW_H / 2} r={12} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1.2} />
        <text x={OUTPUT_X} y={VIEW_H / 2 + 30} textAnchor="middle" fontSize={12} fontWeight={600} fill={accentColor}>
          {decisionLabel}
        </text>
        <text x={OUTPUT_X} y={VIEW_H / 2 + 44} textAnchor="middle" fontSize={10} fill="var(--on-surface-variant)">
          {decisionPct}% de confiança
        </text>
      </g>

      <text x={FILTER_X} y={16} textAnchor="middle" fontSize={9} fill="var(--on-surface-variant)">
        4 filtros
      </text>
      <text x={HIDDEN_X} y={16} textAnchor="middle" fontSize={9} fill="var(--on-surface-variant)">
        16 neurônios
      </text>
      <text x={OUTPUT_X} y={16} textAnchor="middle" fontSize={9} fill="var(--on-surface-variant)">
        decisão
      </text>
    </svg>
  );
}
