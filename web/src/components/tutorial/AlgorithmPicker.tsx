"use client";

import { CSSProperties } from "react";
import { AlgorithmId, ALGORITHM_LABELS } from "@/lib/core/search";
import { ALGO_COLOR } from "@/components/shared/SearchStatsTable";

const ALL: AlgorithmId[] = ["bfs", "dfs", "ucs", "greedy", "astar"];

export function AlgorithmPicker({
  value,
  onChange,
  options = ALL,
}: {
  value: AlgorithmId | null;
  onChange: (a: AlgorithmId) => void;
  options?: AlgorithmId[];
}) {
  return (
    <div className="lab-algo-picker">
      {options.map((a) => (
        <button
          key={a}
          type="button"
          className={`lab-algo-pill ${value === a ? "active" : ""}`}
          style={{ "--accent": ALGO_COLOR[a] } as CSSProperties}
          onClick={() => onChange(a)}
        >
          <span className="lab-algo-pill-dot" />
          {ALGORITHM_LABELS[a]}
        </button>
      ))}
    </div>
  );
}
