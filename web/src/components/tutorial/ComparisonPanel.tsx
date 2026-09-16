"use client";

import { useMemo } from "react";
import { SearchStatsTable, ALGO_COLOR } from "@/components/shared/SearchStatsTable";
import { MazeState, HeuristicId, buildMazeProblem } from "@/lib/maze/model";
import { AlgorithmId, ALGORITHM_LABELS, search } from "@/lib/core/search";
import { compareInsight } from "@/lib/tutorial/explain";

const ALGOS: AlgorithmId[] = ["bfs", "dfs", "ucs", "greedy", "astar"];

/** Runs all 5 real algorithms on the current maze and renders the table + a nodes-expanded bar
 *  chart + a computed (never invented) insight sentence comparing `chosen` against a baseline. */
export function ComparisonPanel({
  maze,
  heuristic,
  allowDiagonal,
  chosen,
}: {
  maze: MazeState;
  heuristic: HeuristicId;
  allowDiagonal: boolean;
  chosen: AlgorithmId;
}) {
  const results = useMemo(() => {
    const problem = buildMazeProblem(maze, { allowDiagonal, heuristic });
    return ALGOS.map((a) => search(problem, a, { maxNodes: 300_000 }));
  }, [maze, allowDiagonal, heuristic]);

  const maxExpanded = Math.max(1, ...results.map((r) => r.nodesExpanded));
  const insight = compareInsight(results, chosen);

  return (
    <div className="flex flex-col gap-5">
      <div className="lab-bars">
        {results.map((r) => (
          <div key={r.algorithm} className="lab-bars-col">
            <span className="lab-bars-value">{r.nodesExpanded}</span>
            <div
              className="lab-bars-fill"
              style={{
                height: `${Math.max(4, (r.nodesExpanded / maxExpanded) * 100)}%`,
                background: ALGO_COLOR[r.algorithm],
                boxShadow: r.algorithm === chosen ? `0 0 12px ${ALGO_COLOR[r.algorithm]}88` : undefined,
                outline: r.algorithm === chosen ? `2px solid ${ALGO_COLOR[r.algorithm]}` : undefined,
                outlineOffset: 2,
              }}
            />
            <span className="lab-bars-label">{ALGORITHM_LABELS[r.algorithm]}</span>
          </div>
        ))}
      </div>

      {insight && (
        <div className="glass rounded-2xl p-4 text-[13px] leading-relaxed text-on-surface">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 align-middle text-[11px] text-primary">
            ★
          </span>
          {insight}
        </div>
      )}

      <SearchStatsTable results={results} showOptimal />
    </div>
  );
}
