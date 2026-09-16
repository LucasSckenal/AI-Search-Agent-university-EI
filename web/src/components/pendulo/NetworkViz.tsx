import { LAYER_SIZES, extractWeights, forward } from "@/lib/pendulo/agent";

const VIEW_W = 400;
const VIEW_H = 280;
const TOP_PAD = 26;
const BOTTOM_PAD = 14;
const COL_MARGIN = 46;
const USABLE_H = VIEW_H - TOP_PAD - BOTTOM_PAD;

const INPUT_LABELS = ["posição", "veloc.", "ângulo", "vel. ang."];
const NEGATIVE_COLOR = "#7ea8f5";

function colX(layerIndex: number): number {
  return COL_MARGIN + (layerIndex / (LAYER_SIZES.length - 1)) * (VIEW_W - 2 * COL_MARGIN);
}

function nodeY(index: number, count: number): number {
  return TOP_PAD + ((index + 0.5) / count) * USABLE_H;
}

/**
 * Live diagram of the pole-balancing network: every node's brightness reflects its current
 * activation and every edge's color/thickness reflects its weight, both recomputed each frame from
 * the same genome driving the cart-pole scene next to it. This is the part that actually answers
 * "eu nem vi a rede neural" - watching the network react to the pole tipping, not just being told a
 * network exists somewhere behind the result.
 */
export function NetworkViz({
  genome,
  inputs,
  accentColor = "var(--primary)",
}: {
  genome: Float64Array;
  inputs: number[];
  accentColor?: string;
}) {
  const layers = forward(genome, inputs);
  const { weights } = extractWeights(genome);

  let maxAbsWeight = 1e-6;
  for (const layer of weights) for (const row of layer) for (const w of row) maxAbsWeight = Math.max(maxAbsWeight, Math.abs(w));

  // The input layer's own values are the raw [-1, 1] readings (not sigmoid output like every other
  // layer), so they need their own mapping to a 0..1 brightness for a consistent visual treatment.
  const brightness = (layerIndex: number, value: number) => (layerIndex === 0 ? (value + 1) / 2 : value);

  const outputValue = layers[layers.length - 1][0];
  const decision = outputValue > 0.5 ? "→ direita" : "← esquerda";

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <text x={VIEW_W / 2} y={14} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--on-surface-variant)">
        Rede Neural ({LAYER_SIZES.join("→")})
      </text>

      {/* Edges, drawn before nodes so nodes sit on top */}
      {weights.map((layerWeights, l) =>
        layerWeights.map((row, n) =>
          row.map((w, p) => {
            const strength = Math.abs(w) / maxAbsWeight;
            return (
              <line
                key={`${l}-${n}-${p}`}
                x1={colX(l)}
                y1={nodeY(p, LAYER_SIZES[l])}
                x2={colX(l + 1)}
                y2={nodeY(n, LAYER_SIZES[l + 1])}
                stroke={w >= 0 ? accentColor : NEGATIVE_COLOR}
                strokeWidth={0.5 + 2 * strength}
                opacity={0.12 + 0.6 * strength}
              />
            );
          })
        )
      )}

      {/* Nodes, brightness driven by this frame's activation */}
      {layers.map((layerValues, l) =>
        layerValues.map((value, n) => {
          const b = Math.max(0, Math.min(1, brightness(l, value)));
          const cx = colX(l);
          const cy = nodeY(n, LAYER_SIZES[l]);
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
                <text x={cx - 14} y={cy + 3} textAnchor="end" fontSize={8.5} fill="var(--on-surface-variant)">
                  {INPUT_LABELS[n]}
                </text>
              )}
            </g>
          );
        })
      )}

      <text x={colX(LAYER_SIZES.length - 1) + 14} y={nodeY(0, 1) + 3} fontSize={10} fontWeight={600} fill={accentColor}>
        {decision}
      </text>
    </svg>
  );
}
