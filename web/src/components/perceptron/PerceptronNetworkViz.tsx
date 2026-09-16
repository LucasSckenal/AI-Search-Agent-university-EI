import { forward, Network } from "@/lib/perceptron/model";

const VIEW_W = 400;
const VIEW_H = 220;
const TOP_PAD = 24;
const BOTTOM_PAD = 14;
const COL_MARGIN = 46;
const USABLE_H = VIEW_H - TOP_PAD - BOTTOM_PAD;

const INPUT_LABELS = ["x", "y"];
const NEGATIVE_COLOR = "#7ea8f5";

function nodeY(index: number, count: number): number {
  return TOP_PAD + ((index + 0.5) / count) * USABLE_H;
}

/**
 * Live diagram of the classifier network - same visual language as Pêndulo's NetworkViz (node
 * brightness = activation, edge color/thickness = weight sign/magnitude, both recomputed every
 * frame from the same network driving the decision boundary next to it) but generic to whether a
 * hidden layer exists, since this page toggles that live to demonstrate the Minsky-Papert limit.
 */
export function PerceptronNetworkViz({
  network,
  point,
  accentColor = "var(--primary)",
}: {
  network: Network;
  point: { x: number; y: number };
  accentColor?: string;
}) {
  const { hidden, output } = forward(network, point.x, point.y);
  const layerSizes = network.useHidden ? [2, network.hiddenSize, 1] : [2, 1];
  const layerValues: number[][] = network.useHidden
    ? [[point.x, point.y], hidden, [output]]
    : [[point.x, point.y], [output]];

  const colX = (layerIndex: number) => COL_MARGIN + (layerIndex / (layerSizes.length - 1)) * (VIEW_W - 2 * COL_MARGIN);

  // Edge list: (layer l -> l+1), each with its weight.
  type Edge = { x1: number; y1: number; x2: number; y2: number; w: number };
  const edges: Edge[] = [];
  if (network.useHidden) {
    network.w1.forEach((row, j) => {
      row.forEach((w, p) => {
        edges.push({ x1: colX(0), y1: nodeY(p, 2), x2: colX(1), y2: nodeY(j, network.hiddenSize), w });
      });
    });
    network.w2.forEach((w, j) => {
      edges.push({ x1: colX(1), y1: nodeY(j, network.hiddenSize), x2: colX(2), y2: nodeY(0, 1), w });
    });
  } else {
    network.w2.forEach((w, p) => {
      edges.push({ x1: colX(0), y1: nodeY(p, 2), x2: colX(1), y2: nodeY(0, 1), w });
    });
  }

  let maxAbsWeight = 1e-6;
  for (const e of edges) maxAbsWeight = Math.max(maxAbsWeight, Math.abs(e.w));

  // Inputs and tanh hidden activations range over [-1, 1], so they need remapping to a 0..1
  // brightness; the final layer is already a sigmoid probability in [0, 1] and needs none.
  const isLastLayer = (layerIndex: number) => layerIndex === layerSizes.length - 1;
  const brightness = (layerIndex: number, value: number) => (isLastLayer(layerIndex) ? value : (value + 1) / 2);

  const decision = output > 0.5 ? "classe 1" : "classe 0";

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <text x={VIEW_W / 2} y={14} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--on-surface-variant)">
        Rede Neural ({layerSizes.join("→")})
      </text>

      {edges.map((e, i) => {
        const strength = Math.abs(e.w) / maxAbsWeight;
        return (
          <line
            key={i}
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke={e.w >= 0 ? accentColor : NEGATIVE_COLOR}
            strokeWidth={0.5 + 2 * strength}
            opacity={0.12 + 0.6 * strength}
          />
        );
      })}

      {layerValues.map((values, l) =>
        values.map((value, n) => {
          const b = Math.max(0, Math.min(1, brightness(l, value)));
          const cx = colX(l);
          const cy = nodeY(n, layerSizes[l]);
          return (
            <g key={`${l}-${n}`}>
              <circle
                cx={cx}
                cy={cy}
                r={8}
                fill={accentColor}
                fillOpacity={0.12 + 0.8 * b}
                style={{ filter: `drop-shadow(0 0 ${2 + 5 * b}px color-mix(in srgb, ${accentColor} ${40 + 50 * b}%, transparent))` }}
              />
              <circle cx={cx} cy={cy} r={8} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
              {l === 0 && (
                <text x={cx - 14} y={cy + 3} textAnchor="end" fontSize={9} fill="var(--on-surface-variant)">
                  {INPUT_LABELS[n]}
                </text>
              )}
            </g>
          );
        })
      )}

      <text
        x={colX(layerSizes.length - 1) + 14}
        y={nodeY(0, 1) + 3}
        fontSize={10}
        fontWeight={600}
        fill={accentColor}
      >
        {decision}
      </text>
    </svg>
  );
}
