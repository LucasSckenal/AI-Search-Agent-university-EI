import { RecallStep } from "@/lib/hopfield/model";

const ENERGY_COLOR = "#8b5cf6";

/**
 * Inline SVG line chart of energy per step - the Hopfield analog of LossChart, but its own small
 * component rather than a reuse: there's no "accuracy" here, and unlike a loss curve this one is
 * guaranteed to never tick upward (the whole point of the module), which is worth seeing as a single
 * clean descending line rather than forcing it into a two-series chart built for a different domain.
 */
export function EnergyChart({ steps }: { steps: RecallStep[] }) {
  if (steps.length === 0) return null;

  const width = 560;
  const height = 140;
  const padLeft = 44;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 24;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const values = steps.map((s) => s.energy);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || 1;
  const yMin = rawMin - span * 0.08;
  const yMax = rawMax + span * 0.08;

  const x = (i: number) => padLeft + (steps.length === 1 ? 0 : (i / (steps.length - 1)) * plotW);
  const y = (v: number) => padTop + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const path = steps.map((s, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(s.energy).toFixed(1)}`).join(" ");
  const last = steps[steps.length - 1];
  const yTicks = [yMin + (yMax - yMin) * 0.02, (yMin + yMax) / 2, yMax - (yMax - yMin) * 0.02];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-[11px] text-on-surface-variant">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: ENERGY_COLOR, boxShadow: `0 0 8px ${ENERGY_COLOR}66` }} />
          Energia ({last.energy.toFixed(1)})
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Energia por passo">
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padLeft} y1={y(t)} x2={width - padRight} y2={y(t)} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <text x={padLeft - 6} y={y(t) + 3} fontSize={9} textAnchor="end" fill="var(--on-surface-variant)">
              {t.toFixed(0)}
            </text>
          </g>
        ))}
        <text x={padLeft} y={height - 6} fontSize={9} fill="var(--on-surface-variant)">
          Passo 0
        </text>
        <text x={width - padRight} y={height - 6} fontSize={9} textAnchor="end" fill="var(--on-surface-variant)">
          Passo {steps.length - 1}
        </text>
        <path d={path} fill="none" stroke={ENERGY_COLOR} strokeWidth={2} />
      </svg>
    </div>
  );
}
