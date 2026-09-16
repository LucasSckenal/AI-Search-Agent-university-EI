/** Reference content about exact mine-probability inference as a technique - textbook facts, not
 *  execution output, same role as the other four labs' datasheets. */
export interface CmDatasheet {
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

export const CM_DATASHEET: CmDatasheet = {
  nome: "Inferência Probabilística Exata (Campo Minado)",
  tipo: "Raciocínio sob incerteza por enumeração combinatória - calcula a probabilidade exata de cada célula oculta ser uma mina, dado tudo o que já foi revelado.",
  estrategia:
    "Quando a dedução lógica (regras de ponto único e subconjunto) trava, particiona as células da fronteira em componentes conectados, enumera por busca exaustiva com poda toda atribuição de minas consistente com as restrições de cada componente, combina os histogramas por convolução, e pesa cada total pelo número de formas de distribuir o resto das minas entre as células livres do tabuleiro inteiro - não só a fronteira. O resultado é uma probabilidade exata, não uma estimativa: a soma de todas as probabilidades sempre bate exatamente com o número de minas restantes.",
  completo: "Sim, para o cálculo de probabilidades em si (sempre produz um número exato por célula, dado tempo suficiente); não garante resolver o tabuleiro - alguns tabuleiros exigem um palpite genuinamente arriscado, e esse palpite pode acertar ou explodir.",
  otimo: "Sim - dado o estado atual do tabuleiro, nenhuma outra estratégia pode identificar uma célula mais segura do que a de menor probabilidade calculada exatamente. É a melhor decisão possível com a informação disponível, não uma garantia de sucesso.",
  complexidadeTemporal:
    "Exponencial no tamanho de cada componente da fronteira (2^k atribuições candidatas, podadas durante a busca) - por isso o motor limita a enumeração exata a componentes de até 20 células, caindo para uma aproximação por densidade média além disso, uma escolha documentada, nunca silenciosa.",
  complexidadeEspacial: "O(componentes × atribuições válidas) para os histogramas por componente - pequeno na prática, já que a poda descarta a maioria das atribuições antes de completá-las.",
  requisitos: [
    "Um conjunto de restrições numéricas locais (células reveladas com contagem de minas vizinhas) formando uma fronteira sobre as células ainda ocultas",
    "O número total de minas restantes no tabuleiro (para pesar corretamente as células livres, fora da fronteira)",
  ],
  quandoUsar:
    "Exatamente quando a dedução lógica local trava - ou seja, quando nenhuma célula pode ser provada segura ou minada só comparando vizinhanças, mas ainda existe informação suficiente (a contagem total de minas) para calcular um risco exato em vez de arriscar às cegas.",
  limitacoes:
    "Componentes de fronteira grandes demais (mais de 20 células conectadas) forçam uma aproximação por densidade média em vez do cálculo exato - documentada, não escondida. E mesmo a melhor probabilidade calculada pode não ser 0%: quando não é, o palpite é genuinamente arriscado, e pode explodir.",
};
