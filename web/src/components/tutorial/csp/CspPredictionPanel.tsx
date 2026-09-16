"use client";

import { useMemo } from "react";
import { Icon } from "@/components/shared/Panel";
import { backtrackingSteps, forwardCheckingSteps } from "@/lib/queens/model";
import { finalStats, explainPredictionChoice } from "@/lib/tutorial/csp-explain";

export type CspTechniqueId = "backtracking" | "forwardchecking";

/** Runs both real solvers for the chosen N eagerly (cheap - see csp-presets.ts's step-count table,
 *  a few hundred steps at most for N<=12) so the reveal can show real backtrack/node counts, never
 *  invented ones. Before reveal only the technique's description is shown, not the outcome. */
export function CspPredictionPanel({
  n,
  selectedId,
  onSelect,
  revealed,
}: {
  n: number;
  selectedId: CspTechniqueId | null;
  onSelect: (id: CspTechniqueId) => void;
  revealed: boolean;
}) {
  const bt = useMemo(() => finalStats(backtrackingSteps(n)), [n]);
  const fc = useMemo(() => finalStats(forwardCheckingSteps(n)), [n]);
  const feedback = revealed && selectedId ? explainPredictionChoice(selectedId, bt, fc) : null;
  const fcWins = fc.backtracks <= bt.backtracks;
  const correctId: CspTechniqueId = fcWins ? "forwardchecking" : "backtracking";

  const cards: { id: CspTechniqueId; label: string; desc: string; stats: { nodesExpanded: number; backtracks: number } }[] = [
    { id: "backtracking", label: "Backtracking puro", desc: "Testa restrições só no momento de tentar cada linha - sem antecipação.", stats: bt },
    { id: "forwardchecking", label: "Forward Checking", desc: "Poda os domínios das colunas seguintes assim que uma rainha é colocada.", stats: fc },
  ];

  return (
    <div className="lab-prediction-grid">
      {cards.map(({ id, label, desc, stats }) => {
        const isSelected = selectedId === id;
        const isCorrect = revealed && id === correctId;
        const isWrongSelection = revealed && isSelected && id !== correctId;
        const classes = ["lab-prediction-card"];
        if (isCorrect) classes.push("correct");
        else if (isWrongSelection) classes.push("wrong");
        else if (isSelected) classes.push("selected");

        return (
          <button key={id} type="button" disabled={revealed} className={classes.join(" ")} onClick={() => onSelect(id)}>
            <span className="lab-prediction-label">
              {label}
              {revealed && id === correctId && <Icon name="check_circle" className="ml-1.5 align-middle text-[14px] text-primary" />}
            </span>
            {!revealed ? (
              <span className="lab-prediction-meta">{desc}</span>
            ) : (
              <span className="lab-prediction-meta" style={{ flexWrap: "wrap", gap: "6px 12px" }}>
                <span>{stats.nodesExpanded} nós explorados</span>
                <span>{stats.backtracks} retrocessos</span>
              </span>
            )}
          </button>
        );
      })}
      {revealed && feedback && (
        <div className="glass col-span-full rounded-2xl p-4 text-[13px] leading-relaxed text-on-surface">{feedback.message}</div>
      )}
    </div>
  );
}
