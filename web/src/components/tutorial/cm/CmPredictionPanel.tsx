"use client";

import { Icon } from "@/components/shared/Panel";
import { MinesweeperStep } from "@/lib/campo-minado/model";
import { CmOutcomeGuess, classifyOutcome, explainPredictionChoice } from "@/lib/tutorial/cm-explain";

const CARDS: { id: CmOutcomeGuess; label: string; desc: string }[] = [
  { id: "certain", label: "Vai ser certeza (~0%)", desc: "A lógica travou, mas a probabilidade prova que a melhor célula é segura de verdade." },
  { id: "risky-safe", label: "Vai arriscar e acertar", desc: "A melhor célula tem uma chance real de ser mina, mas o palpite dá certo." },
  { id: "risky-explodes", label: "Vai arriscar e explodir", desc: "A melhor célula disponível ainda tem uma chance real de ser mina - e desta vez é." },
];

/** The real probSteps/logicaSteps for the chosen preset are passed down already-computed (the page
 *  runs them once via runCmComparison, shared with steps 05/06/07) so this panel never re-solves
 *  the board itself - just classifies and narrates the real result. */
export function CmPredictionPanel({
  probSteps,
  logicaSteps,
  selectedId,
  onSelect,
  revealed,
}: {
  probSteps: MinesweeperStep[];
  logicaSteps: MinesweeperStep[];
  selectedId: CmOutcomeGuess | null;
  onSelect: (id: CmOutcomeGuess) => void;
  revealed: boolean;
}) {
  const correctId = classifyOutcome(probSteps);
  const feedback = revealed && selectedId ? explainPredictionChoice(selectedId, probSteps, logicaSteps.length - 1) : null;
  const firstGuess = probSteps.find((s) => s.action === "guess");

  return (
    <div className="lab-prediction-grid">
      {CARDS.map(({ id, label, desc }) => {
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
            ) : id === correctId && firstGuess ? (
              <span className="lab-prediction-meta">{(firstGuess.guessProbability! * 100).toFixed(1)}% de chance de mina na célula escolhida</span>
            ) : (
              <span className="lab-prediction-meta">{desc}</span>
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
