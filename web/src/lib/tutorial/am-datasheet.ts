/** Reference content about Minimax/Alfa-Beta as an algorithm class - textbook facts (AIMA-level),
 *  not execution output, same role as lib/tutorial/datasheets.ts plays for the 5 search algorithms
 *  and ga-datasheet.ts plays for the Genetic Algorithm. There is only one entry since the tutorial
 *  compares one algorithm's two modes (with/without pruning) on different positions, not several
 *  distinct algorithms. */
export interface AmDatasheet {
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

export const AM_DATASHEET: AmDatasheet = {
  nome: "Minimax com poda Alfa-Beta",
  tipo: "Busca adversarial completa em árvore de jogo - dois jogadores, soma zero, informação perfeita",
  estrategia:
    "Explora recursivamente a árvore de jogo alternando dois papéis: MAX escolhe, entre os filhos, o de maior valor; MIN escolhe o de menor valor. Os valores só existem nas folhas (vitória, derrota ou empate) e sobem pela árvore, nível a nível, até a raiz decidir a melhor jogada. A poda Alfa-Beta mantém dois limites (α = melhor garantia de MAX até agora, β = melhor garantia de MIN) e corta um ramo assim que α ≥ β - prova de que aquele ramo não pode mais mudar a decisão do nó acima, então nem precisa ser visitado.",
  completo: "Sim, para árvores de jogo finitas (todo jogo termina em vitória, derrota ou empate em profundidade limitada).",
  otimo: "Sim, contra um oponente que também joga de forma ótima - minimax garante o melhor resultado possível no pior caso, não apenas em média.",
  complexidadeTemporal:
    "O(b^m) para minimax puro (b = fator de ramificação, m = profundidade máxima); O(b^(m/2)) com poda Alfa-Beta e ordenação de jogadas próxima da ideal - na prática, o ganho real depende de quão cedo os melhores lances aparecem na ordem de busca.",
  complexidadeEspacial:
    "O(b·m) - como uma busca em profundidade, mantém só um caminho da raiz até a folha atual na memória a cada momento, mais os filhos ainda não explorados em cada nível.",
  requisitos: [
    "Um jogo de dois jogadores, soma zero (o que é bom para um é ruim para o outro), com informação perfeita (nenhum estado oculto)",
    "Uma função que gere os movimentos legais e aplique cada um a um novo estado",
    "Um teste de fim de jogo e, se a árvore não couber por inteiro, uma função heurística para avaliar posições não-terminais",
  ],
  quandoUsar:
    "Jogos de tabuleiro de dois jogadores com estado totalmente visível (jogo da velha, xadrez, damas, Lig 4) - onde é preciso planejar contra um adversário que também está otimizando, não apenas navegar um ambiente estático.",
  limitacoes:
    "Sem poda, o custo cresce exponencialmente com a profundidade - inviável para jogos com árvores grandes sem também limitar a profundidade e usar uma heurística. A poda Alfa-Beta reduz nós visitados mas não muda a complexidade de pior caso; sua eficácia depende muito da ordem em que os lances são testados.",
};
