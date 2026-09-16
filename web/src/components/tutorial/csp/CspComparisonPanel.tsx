"use client";

import { useMemo } from "react";
import { backtrackingSteps, forwardCheckingSteps } from "@/lib/queens/model";
import { finalStats, compareBacktrackingForwardChecking } from "@/lib/tutorial/csp-explain";

/** Runs the real (eager) backtrackingSteps()/forwardCheckingSteps() on the same N and renders a
 *  nodes-explored bar chart + a computed (never invented) insight sentence. The CSP analog of
 *  AmComparisonPanel (adversarial search) / GaComparisonPanel (GA). */
export function CspComparisonPanel({ n }: { n: number }) {
  const bt = useMemo(() => finalStats(backtrackingSteps(n)), [n]);
  const fc = useMemo(() => finalStats(forwardCheckingSteps(n)), [n]);
  const insight = compareBacktrackingForwardChecking(bt, fc);
  const maxNodes = Math.max(bt.nodesExpanded, fc.nodesExpanded, 1);

  const bars: { label: string; value: number; color: string }[] = [
    { label: "Backtracking puro", value: bt.nodesExpanded, color: "#ff9b9b" },
    { label: "Forward Checking", value: fc.nodesExpanded, color: "#7ee0a8" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="lab-bars">
        {bars.map((b) => (
          <div key={b.label} className="lab-bars-col">
            <span className="lab-bars-value">{b.value.toLocaleString("pt-BR")} nós</span>
            <div className="lab-bars-fill" style={{ height: `${Math.max(4, (b.value / maxNodes) * 100)}%`, background: b.color }} />
            <span className="lab-bars-label">{b.label}</span>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-4 text-[13px] leading-relaxed text-on-surface">
        <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 align-middle text-[11px] text-primary">★</span>
        {insight}
      </div>
    </div>
  );
}
