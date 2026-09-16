import { AlgorithmId, ALGORITHM_LABELS, SearchResult } from "@/lib/core/search";
import { TraceStep } from "@/lib/core/search-trace";
import { MazeState, rc } from "@/lib/maze/model";

/**
 * Pure text-generation functions consumed by every step of the tutorial (03/04/06/07/08) that needs
 * to explain *why* the algorithm did something. Isolated here, instead of inline in components, so
 * every one of those steps narrates from the same source instead of five hand-written copies - and
 * so every sentence is built from real numbers on a real `TraceStep`/`SearchResult`, never hardcoded.
 */

export function describeCell(maze: MazeState, s: number): string {
  const [r, c] = rc(maze, s);
  return `(${r},${c})`;
}

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function explainSelection<S>(step: TraceStep<S>, algorithm: AlgorithmId, maze: MazeState): { title: string; reason: string } {
  const cell = describeCell(maze, step.current as unknown as number);

  if (step.isGoal) {
    return {
      title: `${cell} · objetivo`,
      reason:
        algorithm === "bfs" || algorithm === "dfs"
          ? `Chegou ao objetivo depois de ${step.visitedCount} nó(s) expandido(s) — a busca para assim que o objetivo é descoberto, mesmo sem ele nunca ter sido expandido.`
          : `Chegou ao objetivo com custo acumulado g(n) = ${fmt(step.g)}. Nenhum outro nó na fronteira tinha ${step.basis === "h" ? "estimativa" : "prioridade"} menor que essa, então a busca para aqui.`,
    };
  }

  switch (step.basis) {
    case "fifo":
      return {
        title: `${cell} · expandido`,
        reason: `Este foi o primeiro nó a entrar na fila e ainda não ter sido expandido (FIFO). A Busca em Largura sempre expande nessa ordem de chegada, por isso explora o mapa em camadas, uma distância de cada vez.`,
      };
    case "lifo":
      return {
        title: `${cell} · expandido`,
        reason: `Este foi o último nó empilhado (LIFO). A Busca em Profundidade sempre expande o topo da pilha, então mergulha por um caminho até o fim antes de considerar qualquer alternativa mais rasa.`,
      };
    case "g":
      return {
        title: `${cell} · g(n) = ${fmt(step.g)}`,
        reason: `Este nó tem o menor custo acumulado g(n) = ${fmt(step.g)} entre todos os nós na fronteira. A Busca de Custo Uniforme ignora quão perto o nó parece estar do objetivo e sempre expande o mais barato de alcançar até agora.`,
      };
    case "h":
      return {
        title: `${cell} · h(n) = ${fmt(step.h)}`,
        reason: `Este nó tem a menor estimativa heurística h(n) = ${fmt(step.h)} até o objetivo. A busca Gulosa ignora o custo já percorrido — só olha pra estimativa — e por isso pode se deixar enganar por um atalho aparente que não é realmente o mais barato.`,
      };
    case "f":
    default:
      return {
        title: `${cell} · f(n) = ${fmt(step.f)}`,
        reason: `Este nó tem o menor custo estimado total: f(n) = g(n) + h(n) = ${fmt(step.g)} + ${fmt(step.h)} = ${fmt(step.f)}. O A* soma o que já foi percorrido com a estimativa até o objetivo e sempre expande o menor f(n) da fronteira — por isso equilibra "já andei bastante" com "ainda falta pouco".`,
      };
  }
}

export function explainPathChoice(
  chosenPath: number[],
  chosenCost: number,
  actualPath: number[],
  actualCost: number,
  algorithm: AlgorithmId
): { correct: boolean; message: string } {
  const correct = chosenPath.length === actualPath.length && chosenPath.every((s, i) => s === actualPath[i]);
  if (correct) {
    return { correct: true, message: `Você acertou! O ${ALGORITHM_LABELS[algorithm]} realmente escolheu esse caminho, de custo ${fmt(actualCost)}.` };
  }
  const cheaper = actualCost < chosenCost - 1e-9;
  const costNote = cheaper
    ? `o caminho real custa ${fmt(actualCost)}, mais barato que o ${fmt(chosenCost)} do caminho que você escolheu`
    : Math.abs(actualCost - chosenCost) < 1e-9
      ? `os dois custam o mesmo (${fmt(actualCost)}), mas o algoritmo chegou lá por outra rota`
      : `o caminho real custa ${fmt(actualCost)}, mais caro que o ${fmt(chosenCost)} do caminho que você escolheu — o que parece atalho nem sempre é ótimo`;
  return {
    correct: false,
    message: `Quase! O ${ALGORITHM_LABELS[algorithm]} escolheu outro caminho: ${costNote}.`,
  };
}

/** "X expandiu Y% menos nós que Z" - compares `chosen` against BFS as the naive baseline the user
 *  already saw first (or, if BFS itself is what's chosen, against whichever other algorithm did
 *  best) - always computed from real `SearchResult`s, never a canned number. */
export function compareInsight<S, A>(results: SearchResult<S, A>[], chosen: AlgorithmId): string | null {
  const chosenResult = results.find((r) => r.algorithm === chosen);
  if (!chosenResult || !chosenResult.found) return null;

  const others = results.filter((r) => r.algorithm !== chosen && r.found);
  if (others.length === 0) return null;

  const baseline = chosen === "bfs" ? others.reduce((best, r) => (r.nodesExpanded < best.nodesExpanded ? r : best)) : results.find((r) => r.algorithm === "bfs" && r.found);
  if (!baseline || baseline.nodesExpanded === 0) return null;

  const diff = baseline.nodesExpanded - chosenResult.nodesExpanded;
  if (diff === 0) return `Neste cenário, ${ALGORITHM_LABELS[chosen]} expandiu o mesmo número de nós que ${ALGORITHM_LABELS[baseline.algorithm]} (${chosenResult.nodesExpanded}).`;

  const pct = Math.abs((diff / baseline.nodesExpanded) * 100);
  const verb = diff > 0 ? "expandiu" : "precisou expandir";
  const compareWord = diff > 0 ? "menos" : "mais";
  return `Neste cenário, ${ALGORITHM_LABELS[chosen]} ${verb} ${pct.toFixed(0)}% ${compareWord} nós que ${ALGORITHM_LABELS[baseline.algorithm]} (${chosenResult.nodesExpanded} vs. ${baseline.nodesExpanded}).`;
}

export function explainChallengeChoice<S, A>(algorithm: AlgorithmId, result: SearchResult<S, A>): string {
  if (!result.found) {
    return `${ALGORITHM_LABELS[algorithm]} não encontrou um caminho dentro do limite de busca.`;
  }
  if (algorithm === "bfs" || algorithm === "dfs") {
    return `${ALGORITHM_LABELS[algorithm]} conta passos, não custo — encontrou um caminho de custo ${fmt(result.cost)}, mas ignorou completamente a lama mais cara pelo caminho. Se o mapa tem áreas de custo diferente, contar passos não é a mesma coisa que minimizar custo.`;
  }
  if (algorithm === "ucs") {
    return `Busca de Custo Uniforme sempre expande o nó mais barato conhecido, então encontra a rota de menor custo garantida — aqui, ${fmt(result.cost)} — mesmo sem saber onde fica o objetivo, o que custa expandir mais nós do que necessário.`;
  }
  return `A* combina o custo já percorrido com uma estimativa até o objetivo, então encontra a mesma rota ótima de custo ${fmt(result.cost)} que a Busca de Custo Uniforme encontraria, mas guiado pela heurística — geralmente expandindo bem menos nós.`;
}
