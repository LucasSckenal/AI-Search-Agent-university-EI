"use client";

import { Icon } from "@/components/shared/Panel";
import { GaConvergenceChart } from "@/components/shared/GaConvergenceChart";
import { GaRunResult } from "@/lib/core/genetic";
import { Genome } from "@/lib/algoritmo-genetico/model";
import { GaPreset } from "@/lib/tutorial/ga-presets";
import { generationSolved } from "@/lib/tutorial/ga-explain";

export interface GaPredictionCandidate {
  preset: GaPreset;
  result: GaRunResult<Genome>;
}

/**
 * Candidates are real - each is an already-executed evolve() run for a named preset (see
 * ga-presets.ts). Before reveal, only the RECIPE (population/mutation/crossover/elite) is shown -
 * not the outcome - so predicting requires reasoning about what each knob does, not reading a
 * result. After reveal, each card gets its own real convergence chart and the generation it
 * actually reached the target (or "não convergiu"), never invented.
 */
export function GaPredictionPanel({
  candidates,
  selectedId,
  onSelect,
  revealed,
  correctId,
}: {
  candidates: GaPredictionCandidate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  revealed: boolean;
  correctId: string | null;
}) {
  return (
    <div className="lab-prediction-grid">
      {candidates.map(({ preset, result }) => {
        const isSelected = selectedId === preset.id;
        const isCorrect = revealed && preset.id === correctId;
        const isWrongSelection = revealed && isSelected && preset.id !== correctId;
        const classes = ["lab-prediction-card"];
        if (isCorrect) classes.push("correct");
        else if (isWrongSelection) classes.push("wrong");
        else if (isSelected) classes.push("selected");
        const solvedAt = generationSolved(result);

        return (
          <button key={preset.id} type="button" disabled={revealed} className={classes.join(" ")} onClick={() => onSelect(preset.id)}>
            <span className="lab-prediction-label">
              {preset.label}
              {revealed && preset.id === correctId && <Icon name="check_circle" className="ml-1.5 align-middle text-[14px] text-primary" />}
            </span>
            {!revealed ? (
              <span className="lab-prediction-meta" style={{ flexWrap: "wrap", gap: "6px 12px" }}>
                <span>pop. {preset.populationSize}</span>
                <span>mutação {(preset.mutationRate * 100).toFixed(0)}%</span>
                <span>cruzamento {(preset.crossoverRate * 100).toFixed(0)}%</span>
                <span>elite {preset.eliteCount}</span>
              </span>
            ) : (
              <>
                <GaConvergenceChart generations={result.generations} unitLabel="Geração" />
                <span className="lab-prediction-meta">
                  <span>{solvedAt !== null ? `convergiu na geração ${solvedAt}` : "não convergiu"}</span>
                  <span>fitness final {result.bestEverFitness.toFixed(2)}</span>
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
