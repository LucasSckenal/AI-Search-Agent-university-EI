import { GaGenerationSummary, GaRunResult } from "@/lib/core/genetic";
import { Genome, finalDistance } from "@/lib/algoritmo-genetico/model";
import { GaPreset, GA_TUTORIAL_GENERATIONS } from "@/lib/tutorial/ga-presets";

const fmt = (n: number): string => n.toFixed(2);

/** First generation whose best genome got within striking distance (<1) of the target, or null if
 *  the run never got there within its generation budget - real, computed from `bestPerGeneration`,
 *  never guessed. */
export function generationSolved(result: GaRunResult<Genome>): number | null {
  for (let g = 0; g < result.bestPerGeneration.length; g++) {
    if (finalDistance(result.bestPerGeneration[g]) < 1) return g;
  }
  return null;
}

/** Whichever preset converged soonest (lowest non-null generationSolved), falling back to highest
 *  bestEverFitness if none converged - the real "correct answer" for the prediction step. */
export function pickBestPreset(entries: { preset: GaPreset; result: GaRunResult<Genome> }[]): GaPreset {
  let best = entries[0];
  let bestSolvedAt = generationSolved(best.result);
  for (const entry of entries.slice(1)) {
    const solvedAt = generationSolved(entry.result);
    const better =
      solvedAt !== null && (bestSolvedAt === null || solvedAt < bestSolvedAt)
        ? true
        : solvedAt === null && bestSolvedAt === null && entry.result.bestEverFitness > best.result.bestEverFitness
          ? true
          : false;
    if (better) {
      best = entry;
      bestSolvedAt = solvedAt;
    }
  }
  return best.preset;
}

export function explainGeneration(
  summary: GaGenerationSummary,
  prev: GaGenerationSummary | null
): { title: string; reason: string } {
  const title = `Geração ${summary.generation} · melhor fitness ${fmt(summary.bestFitness)}`;

  if (!prev) {
    return {
      title,
      reason: `População inicial: ${fmt(summary.meanFitness)} de fitness médio, variando de ${fmt(summary.worstFitness)} a ${fmt(summary.bestFitness)} — todo mundo começa de movimentos aleatórios, então o desvio padrão (${fmt(summary.stdFitness)}) é alto.`,
    };
  }

  const bestDelta = summary.bestFitness - prev.bestFitness;
  const meanDelta = summary.meanFitness - prev.meanFitness;
  const stdDelta = summary.stdFitness - prev.stdFitness;

  if (bestDelta > 1e-9) {
    return {
      title,
      reason: `O melhor indivíduo melhorou ${fmt(bestDelta)} em relação à geração anterior — elitismo preservou os melhores enquanto cruzamento e mutação testaram variações, e uma delas rendeu um indivíduo ainda mais apto.`,
    };
  }
  if (Math.abs(stdDelta) > 0.01 && stdDelta < 0) {
    return {
      title,
      reason: `O melhor fitness não mudou, mas a população ficou mais uniforme (desvio padrão caiu de ${fmt(prev.stdFitness)} para ${fmt(summary.stdFitness)}) — a seleção por torneio está convergindo a população inteira para perto do melhor indivíduo conhecido.`,
    };
  }
  return {
    title,
    reason: `Nenhum indivíduo superou o melhor da geração anterior (${fmt(prev.bestFitness)}) — a média da população ${meanDelta >= 0 ? "subiu" : "caiu"} ${fmt(Math.abs(meanDelta))}, mas o elitismo garante que o melhor já encontrado nunca é perdido, mesmo numa geração sem progresso.`,
  };
}

export function explainPredictionChoice(
  chosen: GaPreset,
  chosenSolvedAt: number | null,
  best: GaPreset,
  bestSolvedAt: number | null
): { correct: boolean; message: string } {
  if (chosen.id === best.id) {
    return {
      correct: true,
      message: `Você acertou! "${best.label}" foi realmente quem chegou perto do alvo primeiro${bestSolvedAt !== null ? `, na geração ${bestSolvedAt}` : ""}.`,
    };
  }
  const chosenNote = chosenSolvedAt !== null ? `chegou perto na geração ${chosenSolvedAt}` : "não chegou perto do alvo dentro do orçamento de gerações";
  const bestNote = bestSolvedAt !== null ? `chegou na geração ${bestSolvedAt}` : "também não chegou";
  return {
    correct: false,
    message: `Quase! "${chosen.label}" ${chosenNote}, mas "${best.label}" ${bestNote} — foi essa configuração que convergiu mais rápido.`,
  };
}

/** "Mutação alta convergiu X% mais devagar que Mutação baixa" - always computed from real
 *  generationSolved()/bestEverFitness numbers, never invented. */
export function compareConfigInsight(entries: { preset: GaPreset; result: GaRunResult<Genome> }[], chosenId: string): string | null {
  const chosen = entries.find((e) => e.preset.id === chosenId);
  const baseline = entries.find((e) => e.preset.id === "padrao");
  if (!chosen || !baseline || chosen === baseline) return null;

  const chosenGen = generationSolved(chosen.result);
  const baseGen = generationSolved(baseline.result);

  if (chosenGen !== null && baseGen !== null && baseGen !== 0) {
    const diff = chosenGen - baseGen;
    if (diff === 0) return `Neste cenário, "${chosen.preset.label}" convergiu na mesma geração que o padrão (geração ${chosenGen}).`;
    const pct = Math.abs((diff / baseGen) * 100);
    return `Neste cenário, "${chosen.preset.label}" convergiu ${diff > 0 ? `${pct.toFixed(0)}% mais devagar` : `${pct.toFixed(0)}% mais rápido`} que o padrão (geração ${chosenGen} vs. ${baseGen}).`;
  }
  if (chosenGen === null && baseGen !== null) {
    return `Neste cenário, "${chosen.preset.label}" nem chegou perto do alvo dentro de ${GA_TUTORIAL_GENERATIONS} gerações, enquanto o padrão convergiu na geração ${baseGen}.`;
  }
  const fitnessDiff = chosen.result.bestEverFitness - baseline.result.bestEverFitness;
  return `Neste cenário, "${chosen.preset.label}" terminou com fitness ${fitnessDiff >= 0 ? "melhor" : "pior"} que o padrão (${fmt(chosen.result.bestEverFitness)} vs. ${fmt(baseline.result.bestEverFitness)}).`;
}

export function explainChallengeResult(solvedAt: number | null, maxGenerations: number): string {
  if (solvedAt !== null) {
    return `Sua configuração chegou perto do alvo na geração ${solvedAt}, dentro do orçamento de ${maxGenerations} gerações. Mais população e mais mutação exploram mais alternativas por geração, mas cada uma custa mais tempo de computação — o ajuste certo depende de quanto orçamento de gerações você tem.`;
  }
  return `Sua configuração não chegou perto do alvo dentro de ${maxGenerations} gerações. Tente aumentar a população (mais alternativas por geração) ou a taxa de mutação (mais exploração) — ou lembre que, com poucas gerações, uma mutação baixa demais deixa a busca presa perto do ponto de partida.`;
}
