import { EpisodeSummary, GridWorld, Rollout } from "@/lib/rl/model";
import { rolloutForSnapshot } from "@/lib/tutorial/rl-run";

const fmt = (n: number): string => n.toFixed(2);

export function outcomeLabel(outcome: Rollout["outcome"]): string {
  if (outcome === "goal") return "Objetivo alcançado";
  if (outcome === "pit") return "Caiu no buraco";
  return "Não alcançou (tempo esgotado)";
}

export type RlOutcomeGuess = "match" | "worse" | "fail";

/** The real, computed classification of how a trained Q-learning policy's rollout compares to
 *  Value Iteration's - never guessed, always derived from the two real rollouts. */
export function classifyOutcome(qRollout: Rollout, viRollout: Rollout): RlOutcomeGuess {
  if (qRollout.outcome !== "goal") return "fail";
  if (Math.abs(qRollout.reward - viRollout.reward) < 1e-6) return "match";
  return "worse";
}

export function explainPredictionChoice(
  guess: RlOutcomeGuess,
  qRollout: Rollout,
  viRollout: Rollout,
  episodes: number
): { correct: boolean; message: string } {
  const actual = classifyOutcome(qRollout, viRollout);
  const correct = guess === actual;

  if (actual === "match") {
    return {
      correct,
      message: `Com apenas ${episodes} episódios de treino, o Q-learning ainda bateu com a Iteração de Valor: recompensa ${fmt(qRollout.reward)} nos dois. Aconteceu de o agente já ter experimentado o suficiente deste mapa específico para aprender a rota ótima.`,
    };
  }
  if (actual === "worse") {
    return {
      correct,
      message: `Com apenas ${episodes} episódios, o Q-learning chegou ao objetivo, mas por um caminho pior: recompensa ${fmt(qRollout.reward)} contra ${fmt(viRollout.reward)} da Iteração de Valor (que conhece o mapa de antemão). O agente aprendeu UM jeito de chegar lá, não necessariamente o melhor.`,
    };
  }
  return {
    correct,
    message: `Com apenas ${episodes} episódios, o Q-learning nem chegou ao objetivo (${outcomeLabel(qRollout.outcome).toLowerCase()}, recompensa ${fmt(qRollout.reward)}), enquanto a Iteração de Valor - que conhece o mapa e as regras de antemão - garante a rota ótima (recompensa ${fmt(viRollout.reward)}). Épsilon já decaiu para seu valor mínimo antes do agente encontrar uma rota confiável, e o pouco de exploração restante não foi suficiente para corrigir isso.`,
  };
}

/** Narrates one Q-table snapshot from a real training run: what the greedy policy learned so far
 *  would actually do, computed by rolling it out live (cheap on these grid sizes), never invented. */
export function explainSnapshot(
  world: GridWorld,
  snapshot: { episode: number; q: Float32Array },
  episodeSummaries: EpisodeSummary[],
  maxStepsPerEpisode: number
): { title: string; reason: string; rollout: Rollout } {
  const rollout = rolloutForSnapshot(world, snapshot.q, maxStepsPerEpisode);
  const summary = episodeSummaries[snapshot.episode];
  const epsilon = summary?.epsilon ?? 0;
  const title = `Episódio ${snapshot.episode} · ε=${epsilon.toFixed(2)}`;

  if (rollout.outcome === "goal") {
    const wandered = rollout.path.length - 1;
    const reason =
      epsilon > 0.3
        ? `Se o treino parasse aqui, a política gulosa já chegaria ao objetivo (recompensa ${fmt(rollout.reward)}, ${wandered} passos) - mas ε=${epsilon.toFixed(2)} ainda é alto, então boa parte das ações DURANTE o treino continuam sendo aleatórias, não seguindo essa política ainda instável.`
        : `Com ε já baixo (${epsilon.toFixed(2)}), o agente está principalmente explorando o que aprendeu, não mais o mapa - e o que aprendeu já leva ao objetivo (recompensa ${fmt(rollout.reward)}, ${wandered} passos).`;
    return { title, reason, rollout };
  }
  if (rollout.outcome === "pit") {
    return {
      title,
      reason: `Se o treino parasse aqui, a política gulosa levaria o agente direto a um buraco (recompensa ${fmt(rollout.reward)}) - o Q-table ainda não aprendeu a evitar essa célula a partir de algum estado do caminho.`,
      rollout,
    };
  }
  return {
    title,
    reason: `Se o treino parasse aqui, a política gulosa nem chegaria ao objetivo dentro do orçamento de passos (recompensa ${fmt(rollout.reward)}) - o Q-table ainda não tem um caminho confiável aprendido para este estado inicial.`,
    rollout,
  };
}

/** "Com orçamento curto o Q-learning ficou X abaixo do ótimo; com o orçamento padrão, Y" -
 *  computed from three real rollouts (short-budget Q-learning, full-budget Q-learning, Value
 *  Iteration), never invented. Uses the raw reward gap rather than a percentage-of-optimal: RL
 *  rewards here can be small or negative, so dividing by the optimal reward can blow up into a
 *  meaningless percentage (e.g. "perdeu 1200%") - the gap in the same reward units the bars above
 *  already show is always legible. */
export function compareRlInsight(
  shortQRollout: Rollout,
  fullQRollout: Rollout,
  viRollout: Rollout,
  shortEpisodes: number,
  fullEpisodes: number
): string {
  const shortGap = viRollout.reward - shortQRollout.reward;
  const fullGap = viRollout.reward - fullQRollout.reward;

  if (shortGap <= 0.01 && fullGap <= 0.01) {
    return `Neste mapa, tanto ${shortEpisodes} quanto ${fullEpisodes} episódios já bastaram para o Q-learning igualar a recompensa ótima da Iteração de Valor (${fmt(viRollout.reward)}).`;
  }
  if (fullGap <= 0.01) {
    return `Com apenas ${shortEpisodes} episódios, o Q-learning ficou ${fmt(shortGap)} de recompensa abaixo do ótimo (${fmt(shortQRollout.reward)} contra ${fmt(viRollout.reward)}). Com ${fullEpisodes} episódios - o padrão usado no módulo livre /aprendizado - o agente fecha essa diferença por completo, igualando a Iteração de Valor: foi só uma questão de dar mais experiência de tentativa e erro a ele.`;
  }
  return `Com ${shortEpisodes} episódios, o Q-learning ficou ${fmt(shortGap)} de recompensa abaixo do ótimo (${fmt(shortQRollout.reward)} contra ${fmt(viRollout.reward)}); com ${fullEpisodes} episódios essa diferença ${fullGap < shortGap ? `cai para ${fmt(fullGap)}` : `continua em ${fmt(fullGap)}`} (${fmt(fullQRollout.reward)}) - mais experiência de tentativa e erro aproxima o agente da política ótima que a Iteração de Valor calcula de uma vez, sabendo o mapa inteiro de antemão.`;
}

export function explainChallengeResult(qRollout: Rollout, viRollout: Rollout, episodes: number): string {
  const gap = classifyOutcome(qRollout, viRollout);
  if (gap === "match") {
    return `Com ${episodes} episódios, seu agente igualou a recompensa ótima da Iteração de Valor (${fmt(viRollout.reward)}) - orçamento suficiente para este mapa.`;
  }
  if (gap === "worse") {
    return `Com ${episodes} episódios, seu agente chegou ao objetivo mas por um caminho pior que o ótimo: ${fmt(qRollout.reward)} contra ${fmt(viRollout.reward)}. Tente mais episódios para fechar essa diferença.`;
  }
  return `Com apenas ${episodes} episódios, seu agente nem chegou ao objetivo (${outcomeLabel(qRollout.outcome).toLowerCase()}). Aumente o orçamento de episódios para dar mais tempo de exploração antes de ε cair.`;
}
