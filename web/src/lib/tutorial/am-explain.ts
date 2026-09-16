import { MinimaxResult, Player } from "@/lib/game/model";
import { MinimaxNode } from "@/lib/minimax/trace";

export const CELL_LABEL: Record<number, string> = { 1: "X", [-1]: "O", 0: "" };
export const playerLabel = (p: Player): string => (p === 1 ? "X (maximizando)" : "O (minimizando)");

function outcomeLabel(score: number): string {
  if (score >= 9_000) return "X venceu";
  if (score <= -9_000) return "O venceu";
  if (score === 0) return "Empate";
  return "Avaliação heurística";
}

/** Explains one node of a real traceMinimax() run - a pruned stub, a terminal position, or an
 *  internal node whose value already resolved from its children - purely from the fields the trace
 *  itself carries (score/alpha/beta/toMove), never a guess. */
export function explainNode(node: MinimaxNode): { title: string; reason: string } {
  if (node.pruned) {
    return {
      title: `Casa ${node.moveApplied} — ramo podado`,
      reason: `Este ramo nunca foi avaliado: assim que o nó pai viu α ≥ β (α=${node.alpha}, β=${node.beta} no momento do corte), ficou provado que nada aqui poderia mudar a decisão do nível acima — continuar explorando seria trabalho desperdiçado.`,
    };
  }
  if (node.terminal) {
    const label = outcomeLabel(node.score as number);
    return {
      title: `Casa ${node.moveApplied ?? "—"} — posição final (${label})`,
      reason: `Fim de jogo nesta linha: ${label}. Valor ${node.score} — o placar desconta a profundidade (10000 − profundidade, ou o inverso), para que o algoritmo prefira vencer rápido e perder devagar entre dois desfechos iguais.`,
    };
  }
  const chooser = playerLabel(node.toMove);
  const verb = node.toMove === 1 ? "o MAIOR" : "o MENOR";
  return {
    title: node.parentId === null ? `Raiz — valor ${node.score}` : `Casa ${node.moveApplied} — valor ${node.score}`,
    reason: `Era a vez de ${chooser}: depois de avaliar todos os filhos possíveis a partir daqui, escolheu ${verb} valor entre eles, ${node.score} — esse valor sobe para o nó pai como a consequência de jogar aqui.`,
  };
}

/** Prediction-step feedback: did the user's guessed cell match the real move minimax() computed? */
export function explainPredictionChoice(userMove: number, best: MinimaxResult): { correct: boolean; message: string } {
  if (userMove === best.move) {
    return {
      correct: true,
      message: `Você acertou! A casa ${best.move} é realmente a melhor jogada, com valor ${best.score} — nenhuma outra garante um resultado tão bom contra um oponente que também joga de forma ótima.`,
    };
  }
  return {
    correct: false,
    message: `Quase! A casa ${best.move} é a que o minimax escolheu, com valor ${best.score} — jogar lá garante o melhor resultado possível supondo que o oponente também jogue da melhor forma.`,
  };
}

/** "Poda Alfa-Beta explorou X% menos nós, mesma jogada" - computed from two real minimax() calls on
 *  the same position (useAlphaBeta true/false), never invented. */
export function compareMinimaxAlphaBeta(plain: MinimaxResult, ab: MinimaxResult): string {
  const sameMove = plain.move === ab.move && plain.score === ab.score;
  const reduction = plain.nodesExplored > 0 ? (1 - ab.nodesExplored / plain.nodesExplored) * 100 : 0;
  const base = sameMove
    ? `Minimax puro e poda Alfa-Beta escolheram exatamente a mesma jogada (casa ${plain.move}, valor ${plain.score})`
    : `Minimax puro escolheu a casa ${plain.move} (valor ${plain.score}) e poda Alfa-Beta escolheu a casa ${ab.move} (valor ${ab.score})`;
  return `${base}. Mas o minimax puro explorou ${plain.nodesExplored.toLocaleString("pt-BR")} nós contra apenas ${ab.nodesExplored.toLocaleString("pt-BR")} da poda Alfa-Beta — uma redução de ${reduction.toFixed(0)}%, cortando ${ab.prunedBranches.toLocaleString("pt-BR")} ramos inteiros sem nunca avaliá-los.`;
}
