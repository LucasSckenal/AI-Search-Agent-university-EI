/** Reference content about Backtracking/Forward Checking as CSP techniques - textbook facts
 *  (AIMA-level), not execution output, same role as the other three labs' datasheets. There is only
 *  one entry since the tutorial compares one algorithm's two modes (with/without forward checking)
 *  on different board sizes, not several distinct algorithms. */
export interface CspDatasheet {
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

export const CSP_DATASHEET: CspDatasheet = {
  nome: "Backtracking com Forward Checking",
  tipo: "Busca sistemática em problemas de satisfação de restrições (CSP) - variáveis, domínios e restrições",
  estrategia:
    "Atribui valores a variáveis uma de cada vez (aqui, uma coluna de cada vez), testando a cada atribuição se ela respeita as restrições com o que já foi atribuído, e retrocedendo (backtracking) quando nenhum valor restante funciona. Backtracking puro só verifica isso no momento da atribuição; Forward Checking vai além - depois de cada atribuição, remove antecipadamente dos domínios das variáveis AINDA NÃO atribuídas qualquer valor que já entraria em conflito, detectando becos sem saída (domínio vazio) colunas inteiras antes de backtracking puro chegar lá.",
  completo: "Sim - o espaço de busca é finito e, na pior das hipóteses, percorrido por completo, então uma solução é encontrada se existir.",
  otimo: "Não se aplica - CSP é um problema de satisfação, não de otimização: qualquer atribuição que respeite todas as restrições é igualmente válida, não há uma \"melhor\" entre soluções.",
  complexidadeTemporal:
    "O(d^n) no pior caso (d = tamanho do domínio, n = número de variáveis) para as duas técnicas - Forward Checking não muda a complexidade de pior caso, mas na prática poda ramos mortos muito mais cedo, visitando bem menos nós.",
  complexidadeEspacial:
    "O(n·d) - guarda a atribuição parcial atual e, no caso do Forward Checking, o domínio restante de cada variável ainda não atribuída.",
  requisitos: [
    "Um conjunto de variáveis com domínios finitos (aqui, uma coluna por variável, linhas como domínio)",
    "Restrições que possam ser testadas entre uma atribuição nova e as já existentes (aqui, mesma linha ou mesma diagonal)",
  ],
  quandoUsar:
    "Problemas onde a resposta é uma atribuição completa e consistente de valores a variáveis - coloração de mapas, agendamento, sudoku, N-rainhas - não uma busca por caminho nem uma otimização.",
  limitacoes:
    "Sem nenhuma forma de antecipação, backtracking puro só descobre um beco sem saída quando chega nele - podendo refazer o mesmo erro em ramos diferentes. Forward Checking ajuda bastante, mas ainda não detecta todo tipo de inconsistência futura (isso exigiria consistência de arco completa, como o algoritmo AC-3).",
};
