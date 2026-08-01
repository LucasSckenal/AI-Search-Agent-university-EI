import { ALGORITHM_LABELS } from "@/lib/core/search";
import { AlgorithmBatchSummary } from "@/lib/core/batch";
import { ALGO_COLOR } from "@/components/shared/SearchStatsTable";

function fmt(v: number | undefined, digits = 2): string {
  if (v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/**
 * Horizontal bar chart of mean nodes-expanded ± 1 std per algorithm - the headline story of a
 * batch comparison ("does this algorithm reliably expand fewer nodes, or did we just get lucky on
 * one instance?") is easier to read as bars-with-error-bars than as a column of numbers.
 */
function BatchBarChart({ summaries }: { summaries: AlgorithmBatchSummary[] }) {
  const rows = summaries.filter((s) => s.nodesExpanded);
  if (rows.length === 0) return null;

  const width = 560;
  const labelWidth = 150;
  const chartWidth = width - labelWidth - 56;
  const rowHeight = 34;
  const height = rows.length * rowHeight + 24;
  const maxVal = Math.max(...rows.map((r) => (r.nodesExpanded!.mean + r.nodesExpanded!.std) * 1.05), 1);

  const ticks = [0, maxVal / 2, maxVal];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Nós expandidos, média e desvio padrão por algoritmo">
      {ticks.map((t, i) => {
        const x = labelWidth + (t / maxVal) * chartWidth;
        return (
          <g key={i}>
            <line x1={x} y1={4} x2={x} y2={height - 16} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <text x={x} y={height - 4} fontSize={9} textAnchor="middle" fill="var(--on-surface-variant)">
              {t >= 1000 ? `${(t / 1000).toFixed(1)}k` : Math.round(t)}
            </text>
          </g>
        );
      })}
      {rows.map((r, i) => {
        const y = i * rowHeight + 12;
        const mean = r.nodesExpanded!.mean;
        const std = r.nodesExpanded!.std;
        const barLen = (mean / maxVal) * chartWidth;
        const color = ALGO_COLOR[r.algorithm];
        const errX0 = labelWidth + (Math.max(mean - std, 0) / maxVal) * chartWidth;
        const errX1 = labelWidth + (Math.min(mean + std, maxVal) / maxVal) * chartWidth;
        return (
          <g key={r.algorithm}>
            <text x={labelWidth - 10} y={y + 12} fontSize={11} textAnchor="end" fill="var(--on-surface)">
              {ALGORITHM_LABELS[r.algorithm].split(" (")[0]}
            </text>
            <rect x={labelWidth} y={y} width={Math.max(barLen, 2)} height={16} rx={4} fill={color} opacity={0.85} />
            <line x1={errX0} y1={y + 8} x2={errX1} y2={y + 8} stroke="var(--on-surface)" strokeWidth={1.5} opacity={0.7} />
            <line x1={errX0} y1={y + 4} x2={errX0} y2={y + 12} stroke="var(--on-surface)" strokeWidth={1.5} opacity={0.7} />
            <line x1={errX1} y1={y + 4} x2={errX1} y2={y + 12} stroke="var(--on-surface)" strokeWidth={1.5} opacity={0.7} />
            <text x={labelWidth + barLen + 8} y={y + 12} fontSize={10} fill="var(--on-surface-variant)" className="font-mono">
              {fmt(mean, 0)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function BatchStatsTable({ summaries }: { summaries: AlgorithmBatchSummary[] }) {
  if (summaries.length === 0) {
    return <p className="text-xs text-on-surface-variant">Rode a comparação em lote para ver os resultados aqui.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-white/5 p-4">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
          Nós expandidos (média ± desvio padrão)
        </h4>
        <BatchBarChart summaries={summaries} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/10 text-on-surface-variant">
              <th className="px-2 py-2 text-left font-medium">Algoritmo</th>
              <th className="px-2 py-2 text-right font-medium">Execuções</th>
              <th className="px-2 py-2 text-right font-medium">Sucesso</th>
              <th className="px-2 py-2 text-right font-medium">Custo (μ ± σ)</th>
              <th className="px-2 py-2 text-right font-medium">Expandidos (μ ± σ)</th>
              <th className="px-2 py-2 text-right font-medium">Gerados (μ ± σ)</th>
              <th className="px-2 py-2 text-right font-medium">b* (μ ± σ)</th>
              <th className="px-2 py-2 text-right font-medium">Tempo ms (μ ± σ)</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => (
              <tr key={s.algorithm} className="border-b border-white/5">
                <td className="px-2 py-2">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: ALGO_COLOR[s.algorithm], boxShadow: `0 0 8px ${ALGO_COLOR[s.algorithm]}66` }}
                    />
                    {ALGORITHM_LABELS[s.algorithm]}
                  </span>
                </td>
                <td className="px-2 py-2 text-right font-mono">{s.trials}</td>
                <td className={`px-2 py-2 text-right font-mono ${s.successRate < 1 ? "text-error" : ""}`}>
                  {(s.successRate * 100).toFixed(0)}%
                </td>
                <td className="px-2 py-2 text-right font-mono">
                  {s.cost ? `${fmt(s.cost.mean)} ± ${fmt(s.cost.std)}` : "—"}
                </td>
                <td className="px-2 py-2 text-right font-mono">
                  {s.nodesExpanded ? `${fmt(s.nodesExpanded.mean, 0)} ± ${fmt(s.nodesExpanded.std, 0)}` : "—"}
                </td>
                <td className="px-2 py-2 text-right font-mono">
                  {s.nodesGenerated ? `${fmt(s.nodesGenerated.mean, 0)} ± ${fmt(s.nodesGenerated.std, 0)}` : "—"}
                </td>
                <td className="px-2 py-2 text-right font-mono">
                  {s.effectiveBranching ? `${fmt(s.effectiveBranching.mean)} ± ${fmt(s.effectiveBranching.std)}` : "—"}
                </td>
                <td className="px-2 py-2 text-right font-mono">
                  {s.timeMs ? `${fmt(s.timeMs.mean)} ± ${fmt(s.timeMs.std)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] leading-relaxed text-on-surface-variant">
        μ (média) e σ (desvio padrão) calculados sobre execuções independentes em instâncias
        aleatórias diferentes a cada rodada — diferente da comparação de instância única, isso
        mostra se a diferença entre algoritmos é consistente ou só um acaso daquela instância
        específica.
      </p>
    </div>
  );
}
