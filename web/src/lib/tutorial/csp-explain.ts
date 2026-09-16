import { QueensStep } from "@/lib/queens/model";

/** Last frame of a real steps[] array from backtrackingSteps()/forwardCheckingSteps() - it always
 *  carries the run's final nodesExpanded/backtracks totals and whether it ended "solved". */
export function finalStats(steps: QueensStep[]): { nodesExpanded: number; backtracks: number; solved: boolean } {
  const last = steps[steps.length - 1];
  if (!last) return { nodesExpanded: 0, backtracks: 0, solved: false };
  return { nodesExpanded: last.nodesExpanded, backtracks: last.backtracks, solved: last.action === "solved" };
}

/** Explains one real step from the trace - grounded in that step's own action/col/domains, never a
 *  guess. `prev` (the previous step in the array) lets a "place" step describe how many candidates
 *  Forward Checking just eliminated from future columns, by diffing domain sizes. */
export function explainStep(step: QueensStep, prev: QueensStep | null, n: number): { title: string; reason: string } {
  if (step.action === "solved") {
    return {
      title: "Solução encontrada",
      reason: `Todas as ${n} colunas têm uma rainha sem nenhum conflito de linha ou diagonal entre elas — uma atribuição completa e consistente, exatamente o que um CSP resolvido significa.`,
    };
  }

  if (step.action === "backtrack") {
    const reasonFC =
      step.domains !== undefined
        ? "o Forward Checking já tinha eliminado essas linhas do domínio desta coluna antes mesmo de tentar — o beco sem saída foi detectado ao colocar a rainha anterior, não agora."
        : "nenhuma das linhas restantes desta coluna passou no teste de restrição contra as rainhas já colocadas.";
    return {
      title: `Coluna ${step.col} — retrocesso`,
      reason: `Nenhuma linha segura sobrou para esta coluna: ${reasonFC} O algoritmo desfaz a rainha da coluna anterior e tenta a próxima linha disponível lá.`,
    };
  }

  // action === "place"
  const row = step.board[step.col];
  if (step.domains === undefined) {
    return {
      title: `Coluna ${step.col} — linha ${row}`,
      reason: `Linha ${row} é a primeira, em ordem, que não compartilha linha nem diagonal com nenhuma rainha já colocada nas colunas anteriores — backtracking puro só descobre se essa escolha vai dar certo quando (e se) chegar a um beco sem saída mais adiante.`,
    };
  }
  const futureRemaining = step.domains.slice(step.col + 1).reduce((sum, d) => sum + d.length, 0);
  const prevFutureRemaining =
    prev?.domains !== undefined ? prev.domains.slice(step.col + 1).reduce((sum, d) => sum + d.length, 0) : null;
  const eliminated = prevFutureRemaining !== null ? Math.max(0, prevFutureRemaining - futureRemaining) : null;
  return {
    title: `Coluna ${step.col} — linha ${row}`,
    reason:
      eliminated !== null
        ? `Linha ${row} escolhida. O Forward Checking imediatamente eliminou ${eliminated} candidato(s) dos domínios das colunas seguintes por causa desta rainha — se alguma coluna futura tivesse ficado sem nenhuma linha candidata, este ramo já teria sido abandonado sem nem tentar.`
        : `Linha ${row} escolhida. Restam ${futureRemaining} candidatos no total entre as colunas ainda não atribuídas, depois da poda do Forward Checking.`,
  };
}

/** Prediction-step feedback: did the user guess which technique needs fewer backtracks correctly? */
export function explainPredictionChoice(
  chosenId: "backtracking" | "forwardchecking",
  bt: { nodesExpanded: number; backtracks: number },
  fc: { nodesExpanded: number; backtracks: number }
): { correct: boolean; message: string } {
  const fcWins = fc.backtracks <= bt.backtracks;
  const correct = fcWins ? chosenId === "forwardchecking" : chosenId === "backtracking";
  if (fc.backtracks === bt.backtracks) {
    return {
      correct: true,
      message: `Empate real: as duas técnicas precisaram de exatamente ${bt.backtracks} retrocessos neste tabuleiro específico — Forward Checking garante nunca precisar de MAIS retrocessos que backtracking puro, mas nem sempre precisa de menos.`,
    };
  }
  return {
    correct,
    message: `Forward Checking precisou de ${fc.backtracks} retrocessos contra ${bt.backtracks} de backtracking puro (e explorou ${fc.nodesExpanded} nós contra ${bt.nodesExpanded}) — a poda antecipada dos domínios evita repetir o mesmo beco sem saída em ramos que backtracking puro só descobre coluna a coluna mais adiante.`,
  };
}

/** "Forward Checking explorou X% menos nós, Y% menos retrocessos" - computed from two real runs on
 *  the same N, never invented. */
export function compareBacktrackingForwardChecking(
  bt: { nodesExpanded: number; backtracks: number },
  fc: { nodesExpanded: number; backtracks: number }
): string {
  const nodeReduction = bt.nodesExpanded > 0 ? (1 - fc.nodesExpanded / bt.nodesExpanded) * 100 : 0;
  const backtrackReduction = bt.backtracks > 0 ? (1 - fc.backtracks / bt.backtracks) * 100 : 0;
  return `Backtracking puro explorou ${bt.nodesExpanded} nós e precisou de ${bt.backtracks} retrocessos. Forward Checking explorou ${fc.nodesExpanded} nós (${nodeReduction.toFixed(0)}% a menos) e precisou de ${fc.backtracks} retrocessos (${backtrackReduction.toFixed(0)}% a menos) — a poda antecipada dos domínios detecta becos sem saída assim que eles se tornam inevitáveis, em vez de só quando o algoritmo chega neles.`;
}
