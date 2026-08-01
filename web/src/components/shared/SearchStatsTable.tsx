import { AlgorithmId, ALGORITHM_LABELS, SearchResult } from "@/lib/core/search";
import { effectiveBranchingFactor } from "@/lib/core/metrics";

export const ALGO_COLOR: Record<AlgorithmId, string> = {
  bfs: "#afc6ff",
  dfs: "#cebdff",
  ucs: "#ffb77b",
  greedy: "#7ee0a8",
  astar: "#ff9b9b",
};

export function SearchStatsTable<S, A>({ results }: { results: SearchResult<S, A>[] }) {
  if (results.length === 0) {
    return <p className="text-xs text-on-surface-variant">Execute os algoritmos para ver a comparação aqui.</p>;
  }

  const bestCost = Math.min(...results.filter((r) => r.found).map((r) => r.cost));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-white/10 text-on-surface-variant">
            <th className="px-2 py-2 text-left font-medium">Algoritmo</th>
            <th className="px-2 py-2 text-right font-medium">Encontrado</th>
            <th className="px-2 py-2 text-right font-medium">Custo</th>
            <th className="px-2 py-2 text-right font-medium">Nós expandidos</th>
            <th className="px-2 py-2 text-right font-medium">Nós gerados</th>
            <th className="px-2 py-2 text-right font-medium" title="Fator de ramificação que uma árvore uniforme da mesma profundidade precisaria ter para gerar esse número de nós. Quanto mais perto de 1, mais a heurística podou a busca.">
              b*
            </th>
            <th className="px-2 py-2 text-right font-medium">Tempo (ms)</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.algorithm} className="border-b border-white/5">
              <td className="px-2 py-2">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: ALGO_COLOR[r.algorithm], boxShadow: `0 0 8px ${ALGO_COLOR[r.algorithm]}66` }} />
                  {ALGORITHM_LABELS[r.algorithm]}
                </span>
              </td>
              <td className="px-2 py-2 text-right">
                {r.found ? (
                  <span className="text-primary">sim</span>
                ) : (
                  <span className="text-error">{r.truncated ? "limite atingido" : "não"}</span>
                )}
              </td>
              <td
                className={`px-2 py-2 text-right font-mono ${
                  r.found && Math.abs(r.cost - bestCost) < 1e-9 ? "font-semibold text-primary" : ""
                }`}
              >
                {r.found ? r.cost.toFixed(2) : "—"}
              </td>
              <td className="px-2 py-2 text-right font-mono">{r.nodesExpanded.toLocaleString("pt-BR")}</td>
              <td className="px-2 py-2 text-right font-mono">{r.nodesGenerated.toLocaleString("pt-BR")}</td>
              <td className="px-2 py-2 text-right font-mono">
                {r.found ? (effectiveBranchingFactor(r.nodesGenerated, r.actions.length)?.toFixed(2) ?? "—") : "—"}
              </td>
              <td className="px-2 py-2 text-right font-mono">{r.timeMs.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
