/** Reference content about Q-learning as a technique - textbook facts (AIMA-level), not execution
 *  output, same role as the other three labs' datasheets. */
export interface RlDatasheet {
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

export const RL_DATASHEET: RlDatasheet = {
  nome: "Q-Learning (aprendizado por reforço)",
  tipo: "Aprendizado por reforço model-free - o agente não recebe o mapa, as recompensas nem as regras de transição de antemão, só descobre tudo isso agindo e observando o resultado.",
  estrategia:
    "Mantém uma tabela Q(estado, ação) estimando o retorno esperado de cada ação em cada estado. A cada passo, executa uma ação (aleatória com probabilidade ε, a melhor conhecida com probabilidade 1-ε), observa a recompensa e o próximo estado, e atualiza Q(s,a) na direção do erro entre o que esperava e o que realmente aconteceu. ε decai ao longo do treino, de mais exploração no início para mais exploração do que já foi aprendido no fim.",
  completo: "Não garantidamente dentro de um orçamento fixo de episódios - com exploração suficiente e taxa de aprendizado decrescente, converge para a política ótima no limite, mas um orçamento curto pode terminar o treino antes de descobrir uma rota confiável.",
  otimo: "No limite (infinitos episódios, exploração suficiente), sim. Na prática, com orçamento finito, a política aprendida pode ficar aquém da ótima - e essa diferença é exatamente o que este laboratório mede comparando com a Iteração de Valor.",
  complexidadeTemporal:
    "O(episódios × passos por episódio) - cada passo é O(1) (uma leitura e uma atualização na tabela Q). Sem depender do tamanho do espaço de estados sozinho, mas mapas maiores tipicamente exigem mais episódios para cobrir todos os estados relevantes.",
  complexidadeEspacial: "O(estados × ações) - uma tabela Q completa, independentemente de quantos episódios foram treinados.",
  requisitos: [
    "Um ambiente que o agente possa realmente executar ações e observar recompensa + próximo estado (não precisa do modelo de transição)",
    "Um espaço de estados e ações pequeno o bastante para uma tabela explícita (Q-learning tabular, não com aproximação de função)",
  ],
  quandoUsar:
    "Quando o modelo do ambiente (probabilidades de transição, função de recompensa) não está disponível de antemão e a única forma de aprender é interagindo - o oposto exato da Iteração de Valor, que exige conhecer esse modelo por completo.",
  limitacoes:
    "Precisa de exploração suficiente para não ficar preso numa política subótima aprendida cedo demais; converge lentamente em espaços grandes; e, com um orçamento de episódios curto demais para o mapa, pode terminar o treino com ε já baixo sem nunca ter descoberto a melhor rota - ou nenhuma rota confiável.",
};
