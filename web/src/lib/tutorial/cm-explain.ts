import { MinesweeperAction, MinesweeperStep } from "@/lib/campo-minado/model";

export function actionLabel(action: MinesweeperAction): string {
  switch (action) {
    case "solved":
      return "Resolvido";
    case "exploded":
      return "Explodiu";
    case "stuck":
      return "Travou";
    case "guess":
      return "Palpite calculado";
    case "flag":
      return "Marcar mina";
    case "reveal":
      return "Revelar seguro";
  }
}

export function finalStats(steps: MinesweeperStep[]): { action: MinesweeperAction; stepCount: number; guesses: number; cellsRevealed: number; cellsFlagged: number } {
  const last = steps[steps.length - 1];
  return {
    action: last.action,
    stepCount: steps.length,
    guesses: steps.filter((s) => s.action === "guess").length,
    cellsRevealed: last.cellsRevealed,
    cellsFlagged: last.cellsFlagged,
  };
}

const RULE_LABEL: Record<NonNullable<MinesweeperStep["rule"]>, string> = {
  "single-point": "Ponto único",
  subset: "Subconjunto",
  probability: "Inferência probabilística",
};

/** Narrates one real step from the trace - the step's own `reason` field already carries a fully
 *  grounded, human-readable explanation (which cells, why), so this only adds a short title, never
 *  inventing new justification text. */
export function explainStep(step: MinesweeperStep): { title: string; reason: string } {
  const ruleLabel = step.rule ? RULE_LABEL[step.rule] : null;
  const title = ruleLabel ? `${actionLabel(step.action)} · ${ruleLabel}` : actionLabel(step.action);
  return { title, reason: step.reason };
}

export type CmOutcomeGuess = "certain" | "risky-safe" | "risky-explodes";

/** The real, computed classification of what happened once logic stalled and probability took
 *  over - never guessed, always derived from the real probabilidadeSteps() run. */
export function classifyOutcome(probSteps: MinesweeperStep[]): CmOutcomeGuess {
  if (probSteps[probSteps.length - 1].action === "exploded") return "risky-explodes";
  const firstGuess = probSteps.find((s) => s.action === "guess");
  const p = firstGuess?.guessProbability ?? 0;
  return p < 0.03 ? "certain" : "risky-safe";
}

export function explainPredictionChoice(
  guess: CmOutcomeGuess,
  probSteps: MinesweeperStep[],
  logicaFinalSteps: number
): { correct: boolean; message: string } {
  const actual = classifyOutcome(probSteps);
  const correct = guess === actual;
  const firstGuess = probSteps.find((s) => s.action === "guess");
  const pct = firstGuess ? (firstGuess.guessProbability! * 100).toFixed(1) : "0.0";

  if (actual === "certain") {
    return {
      correct,
      message: `A dedução lógica travou depois de ${logicaFinalSteps} passos, mas a inferência probabilística calculou ${pct}% de chance de mina na melhor célula - efetivamente zero. A lógica local (regras de ponto único e subconjunto) só compara vizinhanças; ela não enxerga esse tipo de certeza, que exige contar o total de minas restantes contra o total de células livres do tabuleiro inteiro.`,
    };
  }
  if (actual === "risky-safe") {
    return {
      correct,
      message: `A dedução lógica travou, e a inferência probabilística precisou arriscar de verdade: ${pct}% de chance de mina na melhor célula disponível - e o palpite acertou. Não era garantido; era só a aposta mais segura possível com a informação disponível.`,
    };
  }
  return {
    correct,
    message: `A dedução lógica travou, e mesmo a melhor célula segundo a inferência probabilística tinha ${pct}% de chance de ser mina - um risco real, calculado com exatidão, que desta vez não compensou. Esse é o ponto central de decidir sob incerteza: a melhor decisão possível ainda pode dar errado.`,
  };
}

/** "Lógica revelou X e travou; Probabilidade continuou até Y" - computed from two real runs on
 *  the same opening, never invented. */
export function compareLogicaProbabilidade(logica: MinesweeperStep[], prob: MinesweeperStep[]): string {
  const lFinal = logica[logica.length - 1];
  const pFinal = prob[prob.length - 1];
  const guesses = prob.filter((s) => s.action === "guess").length;
  return `Dedução Lógica revelou ${lFinal.cellsRevealed} células e então ${actionLabel(lFinal.action).toLowerCase()} - ela só age quando tem certeza absoluta, nunca arrisca. Inferência Probabilística continuou exatamente de onde a lógica travou, arriscando ${guesses} palpite(s) calculado(s) pela chance mais baixa disponível, e terminou com ${pFinal.cellsRevealed} células reveladas (${actionLabel(pFinal.action).toLowerCase()}).`;
}
