import { GaGenerationSummary } from "@/lib/core/genetic";

const BEST_COLOR = "#afc6ff";
const MEAN_COLOR = "#cebdff";

/**
 * Dependency-free inline SVG line chart of best/mean fitness per generation - the GA analog of
 * BatchStatsTable's BatchBarChart (same viewBox/axis-tick/on-surface-variant conventions), reused
 * verbatim by both the maze GA and the Goose GA since GaGenerationSummary is domain-agnostic. The
 * label props default to the original GA wording so every existing caller (maze/goose/tsp/queens
 * GeneticModal) needs no changes; the RL page passes "Recompensa"/"Episódio" wording instead, since
 * it plots reward-per-episode through this same shape rather than fitness-per-generation.
 */
export function GaConvergenceChart({
  generations,
  unitLabel = "Geração",
  bestLabel = "Melhor fitness",
  meanLabel = "Média da população",
}: {
  generations: GaGenerationSummary[];
  unitLabel?: string;
  bestLabel?: string;
  meanLabel?: string;
}) {
  if (generations.length === 0) return null;

  const width = 560;
  const height = 200;
  const padLeft = 44;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 24;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const allValues = generations.flatMap((g) => [g.bestFitness, g.meanFitness]);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const span = rawMax - rawMin || 1;
  const yMin = rawMin - span * 0.08;
  const yMax = rawMax + span * 0.08;

  const x = (i: number) => padLeft + (generations.length === 1 ? 0 : (i / (generations.length - 1)) * plotW);
  const y = (v: number) => padTop + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const linePath = (values: number[]) => values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const bestPath = linePath(generations.map((g) => g.bestFitness));
  const meanPath = linePath(generations.map((g) => g.meanFitness));

  const yTicks = [yMin + (yMax - yMin) * 0.02, (yMin + yMax) / 2, yMax - (yMax - yMin) * 0.02];
  const lastGen = generations[generations.length - 1];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-[11px] text-on-surface-variant">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: BEST_COLOR, boxShadow: `0 0 8px ${BEST_COLOR}66` }} />
          {bestLabel} ({lastGen.bestFitness.toFixed(2)})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: MEAN_COLOR }} />
          {meanLabel} ({lastGen.meanFitness.toFixed(2)})
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`${bestLabel} e ${meanLabel} por ${unitLabel.toLowerCase()}`}>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padLeft} y1={y(t)} x2={width - padRight} y2={y(t)} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <text x={padLeft - 6} y={y(t) + 3} fontSize={9} textAnchor="end" fill="var(--on-surface-variant)">
              {t >= 1000 || t <= -1000 ? `${(t / 1000).toFixed(1)}k` : t.toFixed(1)}
            </text>
          </g>
        ))}
        <text x={padLeft} y={height - 6} fontSize={9} fill="var(--on-surface-variant)">
          {unitLabel} 0
        </text>
        <text x={width - padRight} y={height - 6} fontSize={9} textAnchor="end" fill="var(--on-surface-variant)">
          {unitLabel} {generations.length - 1}
        </text>
        <path d={meanPath} fill="none" stroke={MEAN_COLOR} strokeWidth={1.5} opacity={0.75} />
        <path d={bestPath} fill="none" stroke={BEST_COLOR} strokeWidth={2} />
      </svg>
    </div>
  );
}
