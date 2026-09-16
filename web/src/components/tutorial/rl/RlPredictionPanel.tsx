"use client";

import { Icon } from "@/components/shared/Panel";
import { Rollout } from "@/lib/rl/model";
import { RlOutcomeGuess, classifyOutcome, explainPredictionChoice, outcomeLabel } from "@/lib/tutorial/rl-explain";

const CARDS: { id: RlOutcomeGuess; label: string; desc: string }[] = [
  { id: "match", label: "Vai empatar", desc: "O Q-learning aprende exatamente a mesma recompensa ótima da Iteração de Valor." },
  { id: "worse", label: "Vai chegar, mas pior", desc: "O Q-learning alcança o objetivo, mas por um caminho menos eficiente." },
  { id: "fail", label: "Vai falhar", desc: "O Q-learning nem chega ao objetivo dentro do orçamento de episódios." },
];

/** The real qRollout/viRollout for the chosen preset at RL_TUTORIAL_EPISODES are passed down
 *  already-computed (the page runs them once via runRlComparison, shared with steps 05/06/07) so
 *  this panel never re-runs training itself - just classifies and narrates the real result. */
export function RlPredictionPanel({
  qRollout,
  viRollout,
  episodes,
  selectedId,
  onSelect,
  revealed,
}: {
  qRollout: Rollout;
  viRollout: Rollout;
  episodes: number;
  selectedId: RlOutcomeGuess | null;
  onSelect: (id: RlOutcomeGuess) => void;
  revealed: boolean;
}) {
  const correctId = classifyOutcome(qRollout, viRollout);
  const feedback = revealed && selectedId ? explainPredictionChoice(selectedId, qRollout, viRollout, episodes) : null;

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
            ) : id === correctId ? (
              <span className="lab-prediction-meta" style={{ flexWrap: "wrap", gap: "6px 12px" }}>
                <span>{outcomeLabel(qRollout.outcome)}</span>
                <span>recompensa {qRollout.reward.toFixed(2)}</span>
              </span>
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
