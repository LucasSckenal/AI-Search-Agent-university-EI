import { AlgorithmId } from "@/lib/core/search";

/**
 * Reference content about each algorithm's class-level properties (completeness, optimality,
 * complexity) - textbook facts (AIMA-level), not execution output, so unlike everything else in
 * the tutorial these ARE static. See lib/tutorial/explain.ts for the execution-derived text.
 */
export interface AlgorithmDatasheet {
  nome: string;
  tipo: string;
  estrategia: string;
  completo: string;
  otimo: string;
  complexidadeTemporal: string;
  complexidadeEspacial: string;
  requisitos: string[];
  quandoUsar: string;
  limitacoes: string;
}

export const ALGORITHM_DATASHEETS: Record<AlgorithmId, AlgorithmDatasheet> = {
  bfs: {
    nome: "Busca em Largura (BFS)",
    tipo: "Busca cega (não-informada)",
    estrategia:
      "Expande sempre o nó mais antigo na fronteira (fila FIFO), explorando o espaço de estados em camadas de profundidade crescente.",
    completo: "Sim, se o fator de ramificação b for finito.",
    otimo:
      "Só se todos os custos de passo forem iguais (ou monotonicamente não-decrescentes com a profundidade). Com custos desiguais, o primeiro caminho encontrado pode não ser o mais barato.",
    complexidadeTemporal: "O(b^d), onde b é o fator de ramificação e d a profundidade da solução mais rasa.",
    complexidadeEspacial: "O(b^d) — precisa manter toda a fronteira (uma camada inteira) em memória.",
    requisitos: ["Espaço de estados com fator de ramificação finito", "Nenhuma heurística necessária"],
    quandoUsar:
      "Quando todos os passos têm o mesmo custo e a solução está numa profundidade relativamente rasa — encontra o caminho com menos passos.",
    limitacoes:
      "O consumo de memória cresce exponencialmente com a profundidade, tornando-a impraticável em espaços grandes ou profundos; não considera custo quando os passos são desiguais.",
  },
  dfs: {
    nome: "Busca em Profundidade (DFS)",
    tipo: "Busca cega (não-informada)",
    estrategia:
      "Expande sempre o nó mais recentemente gerado (pilha LIFO), mergulhando por um ramo até o fim antes de retroceder (backtrack) para explorar alternativas.",
    completo:
      "Não em espaços infinitos ou com ciclos sem verificação de estados repetidos (pode entrar em loop). Em espaços finitos com detecção de repetidos (como implementado aqui), é completa.",
    otimo: "Não. A primeira solução encontrada pode estar muito mais profunda do que uma alternativa mais rasa e barata.",
    complexidadeTemporal: "O(b^m), onde m é a profundidade máxima do espaço de estados (pode ser muito maior que d).",
    complexidadeEspacial: "O(b·m) — só precisa manter um único caminho da raiz até a folha atual, mais os irmãos não explorados.",
    requisitos: ["Verificação de estados visitados para evitar ciclos", "Nenhuma heurística necessária"],
    quandoUsar:
      "Quando a memória é o recurso mais restrito e qualquer solução serve, não necessariamente a mais curta ou mais barata.",
    limitacoes:
      "Pode encontrar um caminho muito mais longo e caro do que o necessário, especialmente em espaços profundos; não garante otimalidade nem o menor número de passos.",
  },
  ucs: {
    nome: "Busca de Custo Uniforme (UCS)",
    tipo: "Busca cega (não-informada), generalização do BFS para custos desiguais",
    estrategia:
      "Expande sempre o nó de menor custo acumulado g(n) na fronteira (fila de prioridade), garantindo que cada nó só é expandido quando o caminho mais barato até ele já é conhecido.",
    completo: "Sim, se o custo de cada passo for maior ou igual a um ε > 0 (evita caminhos de custo infinitamente decrescente).",
    otimo: "Sim — sempre encontra o caminho de menor custo total até o objetivo.",
    complexidadeTemporal: "O(b^(1+⌊C*/ε⌋)), onde C* é o custo da solução ótima — pode expandir muitos nós de baixo custo antes de alcançar o objetivo.",
    complexidadeEspacial: "O(b^(1+⌊C*/ε⌋)) — mantém toda a fronteira, semelhante ao BFS.",
    requisitos: ["Custos de passo não-negativos", "Nenhuma heurística necessária"],
    quandoUsar: "Quando os passos têm custos diferentes e é preciso garantir o caminho de menor custo, sem informação adicional sobre o objetivo.",
    limitacoes:
      "Explora 'às cegas' em todas as direções de custo baixo, incluindo as que se afastam do objetivo — sem uma heurística, não prioriza nós que parecem mais promissores.",
  },
  greedy: {
    nome: "Busca Gulosa (Greedy Best-First)",
    tipo: "Busca informada (heurística)",
    estrategia:
      "Expande sempre o nó que parece mais próximo do objetivo segundo a heurística h(n), ignorando completamente o custo já percorrido g(n).",
    completo:
      "Não em geral (pode ficar presa em loops ou seguir por um ramo infinito enganada pela heurística); completa em espaços finitos com verificação de estados repetidos.",
    otimo: "Não. Uma heurística pode apontar para um vizinho que parece próximo mas leva a um caminho global muito mais caro.",
    complexidadeTemporal: "O(b^m) no pior caso, mas na prática muito menor com uma boa heurística.",
    complexidadeEspacial: "O(b^m) — mantém toda a fronteira em memória, como os demais métodos de busca em grafo.",
    requisitos: ["Uma função heurística h(n) que estime o custo até o objetivo"],
    quandoUsar:
      "Quando se quer uma resposta rápida e uma heurística razoável está disponível, e otimalidade não é essencial.",
    limitacoes:
      "Míope: pode ser enganada por uma heurística que subestima mal a distância real, seguindo caminhos que parecem bons localmente mas são ruins globalmente.",
  },
  astar: {
    nome: "A* (A-estrela)",
    tipo: "Busca informada (heurística)",
    estrategia:
      "Expande sempre o nó de menor custo total estimado f(n) = g(n) + h(n), combinando o custo já percorrido com a estimativa até o objetivo.",
    completo: "Sim, em espaços finitos com custos de passo positivos (ou infinitos com heurística admissível e outras condições padrão).",
    otimo:
      "Sim, desde que a heurística h(n) seja admissível (nunca superestima o custo real até o objetivo) — com verificação de estados repetidos, também precisa ser consistente.",
    complexidadeTemporal:
      "Depende da qualidade da heurística: no pior caso exponencial como UCS, mas fortemente reduzido por uma heurística informativa.",
    complexidadeEspacial: "O(b^d) — mantém todos os nós gerados em memória, o principal fator limitante em problemas grandes.",
    requisitos: ["Uma função heurística admissível h(n)", "Custos de passo não-negativos"],
    quandoUsar:
      "O padrão quando existe uma boa heurística admissível disponível e otimalidade é necessária — expande tipicamente muito menos nós que UCS.",
    limitacoes:
      "O consumo de memória (mantém toda a fronteira e os nós explorados) pode inviabilizá-lo em espaços de estados muito grandes, mesmo quando o tempo de execução seria aceitável.",
  },
};
