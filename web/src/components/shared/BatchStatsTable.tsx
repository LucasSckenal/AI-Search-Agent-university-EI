import { AlgorithmId, ALGORITHM_LABELS } from "@/lib/core/search";
import { AlgorithmBatchSummary } from "@/lib/core/batch";
import { ALGO_COLOR } from "@/components/shared/SearchStatsTable";
import { Icon } from "@/components/shared/Panel";

function fmt(v: number | undefined, digits = 2): string {
  if (v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

const CSV_HEADER = [
  "Algoritmo",
  "Execuções",
  "Sucesso (%)",
  "Custo (média)",
  "Custo (desvio)",
  "Expandidos (média)",
  "Expandidos (desvio)",
  "Gerados (média)",
  "Gerados (desvio)",
  "b* (média)",
  "b* (desvio)",
  "Tempo ms (média)",
  "Tempo ms (desvio)",
];

/** Client-side CSV download - no server round-trip needed since the data is already in memory. */
function downloadCsv(summaries: AlgorithmBatchSummary[]) {
  const rows = summaries.map((s) => [
    ALGORITHM_LABELS[s.algorithm],
    s.trials,
    (s.successRate * 100).toFixed(0),
    s.cost?.mean.toFixed(4) ?? "",
    s.cost?.std.toFixed(4) ?? "",
    s.nodesExpanded?.mean.toFixed(2) ?? "",
    s.nodesExpanded?.std.toFixed(2) ?? "",
    s.nodesGenerated?.mean.toFixed(2) ?? "",
    s.nodesGenerated?.std.toFixed(2) ?? "",
    s.effectiveBranching?.mean.toFixed(4) ?? "",
    s.effectiveBranching?.std.toFixed(4) ?? "",
    s.timeMs?.mean.toFixed(3) ?? "",
    s.timeMs?.std.toFixed(3) ?? "",
  ]);
  const csv = [CSV_HEADER, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comparacao-lote-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
        <Icon name={icon} className="text-[14px]" />
        {label}
      </div>
      <p className="mt-1.5 text-lg font-semibold tracking-tight" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-on-surface-variant">{sub}</p>}
    </div>
  );
}

/**
 * Horizontal bar chart of mean nodes-expanded ± 1 std per algorithm - the headline story of a
 * batch comparison ("does this algorithm reliably expand fewer nodes, or did we just get lucky on
 * one instance?") is easier to read as bars-with-error-bars than as a column of numbers. The
 * winning algorithm (lowest mean) gets a subtle outline + colored value so it reads at a glance.
 */
function BatchBarChart({ summaries, winnerAlgo }: { summaries: AlgorithmBatchSummary[]; winnerAlgo?: AlgorithmId }) {
  const rows = summaries.filter((s) => s.nodesExpanded);
  if (rows.length === 0) return null;

  const width = 560;
  const labelWidth = 150;
  const chartWidth = width - labelWidth - 90;
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
        const isWinner = r.algorithm === winnerAlgo;
        const errX0 = labelWidth + (Math.max(mean - std, 0) / maxVal) * chartWidth;
        const errX1 = labelWidth + (Math.min(mean + std, maxVal) / maxVal) * chartWidth;
        return (
          <g key={r.algorithm}>
            <text
              x={labelWidth - 10}
              y={y + 12}
              fontSize={11}
              textAnchor="end"
              fill="var(--on-surface)"
              fontWeight={isWinner ? 600 : 400}
            >
              {ALGORITHM_LABELS[r.algorithm].split(" (")[0]}
            </text>
            <rect
              x={labelWidth}
              y={y}
              width={Math.max(barLen, 2)}
              height={16}
              rx={4}
              fill={color}
              opacity={isWinner ? 1 : 0.7}
              stroke={isWinner ? "var(--on-surface)" : "none"}
              strokeWidth={isWinner ? 1.5 : 0}
            />
            <line x1={errX0} y1={y + 8} x2={errX1} y2={y + 8} stroke="var(--on-surface)" strokeWidth={1.5} opacity={0.7} />
            <line x1={errX0} y1={y + 4} x2={errX0} y2={y + 12} stroke="var(--on-surface)" strokeWidth={1.5} opacity={0.7} />
            <line x1={errX1} y1={y + 4} x2={errX1} y2={y + 12} stroke="var(--on-surface)" strokeWidth={1.5} opacity={0.7} />
            <text
              x={Math.max(labelWidth + barLen, errX1) + 8}
              y={y + 12}
              fontSize={10}
              fill={isWinner ? color : "var(--on-surface-variant)"}
              className={`font-mono ${isWinner ? "font-semibold" : ""}`}
            >
              {fmt(mean, 0)}
              {isWinner ? " · melhor" : ""}
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

  const winner = summaries.reduce<AlgorithmBatchSummary | null>((best, s) => {
    if (!s.nodesExpanded) return best;
    if (!best || !best.nodesExpanded) return s;
    return s.nodesExpanded.mean < best.nodesExpanded.mean ? s : best;
  }, null);
  const avgSuccessRate = summaries.reduce((a, s) => a + s.successRate, 0) / summaries.length;
  const totalTrials = summaries.reduce((a, s) => a + s.trials, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          icon="emoji_events"
          label="Melhor algoritmo"
          value={winner ? ALGORITHM_LABELS[winner.algorithm].split(" (")[0] : "—"}
          sub={winner?.nodesExpanded ? `${fmt(winner.nodesExpanded.mean, 0)} nós expandidos (μ)` : undefined}
          accent={winner ? ALGO_COLOR[winner.algorithm] : undefined}
        />
        <SummaryCard
          icon="verified"
          label="Taxa de sucesso média"
          value={`${(avgSuccessRate * 100).toFixed(0)}%`}
          sub={avgSuccessRate === 1 ? "Todos os lotes concluídos" : undefined}
        />
        <SummaryCard
          icon="database"
          label="Execuções totais"
          value={totalTrials.toLocaleString("pt-BR")}
          sub={`N=${summaries[0]?.trials ?? 0} × ${summaries.length} algoritmos`}
        />
      </div>

      <div className="rounded-2xl bg-white/5 p-4">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
          Nós expandidos (média ± desvio padrão)
        </h4>
        <BatchBarChart summaries={summaries} winnerAlgo={winner?.algorithm} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Tabela comparativa detalhada
          </h4>
          <button
            onClick={() => downloadCsv(summaries)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-on-surface-variant transition-colors hover:bg-white/5 hover:text-on-surface"
          >
            <Icon name="download" className="text-[14px]" /> Exportar CSV
          </button>
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
              {summaries.map((s) => {
                const isWinner = winner?.algorithm === s.algorithm;
                return (
                  <tr key={s.algorithm} className={`border-b border-white/5 ${isWinner ? "bg-white/[0.04]" : ""}`}>
                    <td className="px-2 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: ALGO_COLOR[s.algorithm], boxShadow: `0 0 8px ${ALGO_COLOR[s.algorithm]}66` }}
                        />
                        <span className={isWinner ? "font-semibold text-on-surface" : ""}>
                          {ALGORITHM_LABELS[s.algorithm]}
                        </span>
                        {isWinner && (
                          <Icon name="emoji_events" className="text-[13px]" style={{ color: ALGO_COLOR[s.algorithm] }} />
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right font-mono">{s.trials}</td>
                    <td className={`px-2 py-3 text-right font-mono ${s.successRate < 1 ? "text-error" : ""}`}>
                      {(s.successRate * 100).toFixed(0)}%
                    </td>
                    <td className="px-2 py-3 text-right font-mono">
                      {s.cost ? `${fmt(s.cost.mean)} ± ${fmt(s.cost.std)}` : "—"}
                    </td>
                    <td className="px-2 py-3 text-right font-mono">
                      {s.nodesExpanded ? `${fmt(s.nodesExpanded.mean, 0)} ± ${fmt(s.nodesExpanded.std, 0)}` : "—"}
                    </td>
                    <td className="px-2 py-3 text-right font-mono">
                      {s.nodesGenerated ? `${fmt(s.nodesGenerated.mean, 0)} ± ${fmt(s.nodesGenerated.std, 0)}` : "—"}
                    </td>
                    <td className="px-2 py-3 text-right font-mono">
                      {s.effectiveBranching ? `${fmt(s.effectiveBranching.mean)} ± ${fmt(s.effectiveBranching.std)}` : "—"}
                    </td>
                    <td className="px-2 py-3 text-right font-mono">
                      {s.timeMs ? `${fmt(s.timeMs.mean)} ± ${fmt(s.timeMs.std)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
