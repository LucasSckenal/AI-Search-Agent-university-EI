/** Reference content about Genetic Algorithms as a metaheuristic - textbook facts (AIMA-level),
 *  not execution output, same role as lib/tutorial/datasheets.ts plays for the 5 search algorithms.
 *  There is only one entry here since, unlike search, the tutorial doesn't compare several distinct
 *  GA "algorithms" - it compares parameter configurations of the same algorithm (see ga-presets.ts). */
export interface GaDatasheet {
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

export const GA_DATASHEET: GaDatasheet = {
  nome: "Algoritmo Genético",
  tipo: "Metaheurística populacional de otimização estocástica",
  estrategia:
    "Mantém uma população inteira de soluções candidatas (genomas). A cada geração: avalia a aptidão (fitness) de cada uma, preserva as melhores sem alteração (elitismo), seleciona pais por torneio (indivíduos mais aptos competem e vencem com mais frequência, nunca garantido), combina pares de pais (cruzamento) e aplica mutações aleatórias - formando a próxima geração.",
  completo: "Não no sentido formal de busca - não garante encontrar o ótimo global, nem garante parar ao encontrá-lo (não sabe reconhecer o objetivo como tal).",
  otimo: "Não. É uma heurística estocástica: pode convergir para um ótimo local, e duas execuções com seeds diferentes podem terminar em soluções diferentes.",
  complexidadeTemporal: "O(gerações × tamanho da população × custo de avaliar o fitness) - não depende da estrutura do espaço de busca como em busca em grafo, mas do orçamento de gerações escolhido.",
  complexidadeEspacial: "O(tamanho da população × tamanho do genoma) - mantém a população inteira em memória a cada geração.",
  requisitos: [
    "Uma representação de genoma para o problema (como codificar uma solução candidata)",
    "Uma função de fitness que avalie qualquer genoma",
    "Operadores de mutação e cruzamento compatíveis com essa representação",
  ],
  quandoUsar:
    "Quando o espaço de busca é grande demais para busca exaustiva ou informada, quando não há uma heurística admissível clara, ou quando o problema é naturalmente descrito como \"otimizar uma função\" em vez de \"encontrar um caminho\".",
  limitacoes:
    "Sensível aos parâmetros (população, taxa de mutação, taxa de cruzamento) - mutação baixa demais prende a busca perto do ponto de partida (convergência prematura), mutação alta demais degrada em busca aleatória. Sem garantia de otimalidade nem de término em um número previsível de gerações.",
};
