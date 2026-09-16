"use client";

import { useMemo } from "react";
import { CmPreset, openingFor } from "@/lib/tutorial/cm-presets";
import { runCmComparison } from "@/lib/tutorial/cm-run";
import { actionLabel, compareLogicaProbabilidade, finalStats } from "@/lib/tutorial/cm-explain";

/** Runs both real solvers for the chosen preset and renders a cells-revealed bar chart + a computed
 *  (never invented) insight sentence. The Probabilísticos analog of CspComparisonPanel/AmComparisonPanel. */
export function CmComparisonPanel({ preset }: { preset: CmPreset }) {
  const { logica, probabilidade } = useMemo(() => {
    const opening = openingFor(preset);
    return runCmComparison(opening.instance, opening.revealed, opening.flagged);
  }, [preset]);

  const logicaStats = finalStats(logica);
  const probStats = finalStats(probabilidade);
  const insight = compareLogicaProbabilidade(logica, probabilidade);
  const maxRevealed = Math.max(logicaStats.cellsRevealed, probStats.cellsRevealed, 1);

  const bars: { label: string; value: number; note: string; color: string }[] = [
    { label: "Dedução Lógica", value: logicaStats.cellsRevealed, note: actionLabel(logicaStats.action), color: "#ff9b9b" },
    { label: "Inferência Probabilística", value: probStats.cellsRevealed, note: actionLabel(probStats.action), color: "#7ee0a8" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="lab-bars">
        {bars.map((b) => (
          <div key={b.label} className="lab-bars-col">
            <span className="lab-bars-value">
              {b.value.toLocaleString("pt-BR")} células
              <br />
              <span className="text-on-surface-variant/70">{b.note}</span>
            </span>
            <div className="lab-bars-fill" style={{ height: `${Math.max(4, (b.value / maxRevealed) * 100)}%`, background: b.color }} />
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
