# Agentes Inteligentes de Busca — Labirinto, Cubo Mágico e Jogo da Velha

Aplicação web interativa (Next.js + TypeScript) com três agentes inteligentes, cada um resolvendo
um problema computacional clássico por meio de algoritmos de busca. Cada módulo permite
configurar o problema e o algoritmo, executar e visualizar a busca passo a passo, e comparar o
desempenho entre algoritmos diferentes na mesma instância do problema.

| Módulo | Problema | Categoria de busca | Algoritmos |
| --- | --- | --- | --- |
| [`/labirinto`](web/src/app/labirinto/page.tsx) | Labirinto (grid com paredes e terreno) | Não-informada e informada | BFS, DFS, UCS, Gulosa, A* |
| [`/cubo`](web/src/app/cubo/page.tsx) | Cubo Mágico 2x2 (Pocket Cube) | Espaço de estados | BFS, UCS, Gulosa, A* |
| [`/jogo`](web/src/app/jogo/page.tsx) | Jogo da Velha N×N | Adversária (jogos) | Minimax, Minimax + poda Alfa-Beta |

## Como executar

```bash
cd web
npm install
npm run dev       # http://localhost:3000
```

Outros comandos úteis:

```bash
npm run build      # build de produção (verifica tipos e compila as 4 rotas estaticamente)
npm run test       # testes rápidos: motor de busca, labirinto e jogo da velha
npm run test:cube  # testes do cubo mágico, incluindo BFS exaustiva do espaço de estados (~2-3 min)
npm run lint       # ESLint
```

Nenhuma variável de ambiente ou serviço externo é necessário — é uma aplicação 100% client-side.

## Design

A interface segue o design system **"Obsidian Flux"** criado no [Stitch](https://stitch.withgoogle.com)
(projeto "AI Search Visualizer" — telas *Maze Challenge*, *Flow Field* e *Network Graph*): tema
escuro em glassmorphism, com cabeçalho, barra lateral de configuração, painel de estatísticas e
barra de status flutuantes sobre o canvas de visualização, ícones Material Symbols e os tokens de
cor/tipografia exatos gerados pelo Stitch (`src/app/globals.css`).

## Estrutura do projeto

```
web/
  src/lib/core/          motor de busca genérico (independente de domínio)
    priority-queue.ts    heap binário usado por UCS, Gulosa e A*
    search.ts            BFS, DFS, UCS, Gulosa e A* sobre uma interface SearchProblem<S, A>
  src/lib/maze/model.ts  geração de labirinto, terreno com custo, adaptação para SearchProblem
  src/lib/cube/model.ts  motor do cubo 2x2 (rotações 3D reais), heurística, adaptação p/ SearchProblem
  src/lib/game/model.ts  tabuleiro N×N, Minimax e Minimax + poda Alfa-Beta
  src/app/{labirinto,cubo,jogo}/page.tsx   UI de cada módulo (React, client components)
  src/components/                          componentes de visualização e UI compartilhada
  test/*.test.ts          testes automatizados (rodam com tsx, sem framework de teste)
```

Os três módulos compartilham o mesmo motor de busca (`src/lib/core/search.ts`), cada um definindo
apenas seu `SearchProblem` (estado inicial, teste de objetivo, vizinhos/custo e heurística). Isso
mantém BFS/DFS/UCS/Gulosa/A* implementados uma única vez e garante que a comparação entre
algoritmos seja justa (mesma implementação, mesmo critério de nós expandidos/gerados).

---

## a) Descrição e contextualização dos problemas

### Labirinto

Um agente parte de uma célula inicial e precisa alcançar uma célula-objetivo em um grid 2D que
contém paredes (intransponíveis) e trechos de "lama" (transponíveis, porém com custo maior). É o
problema didático clássico para comparar busca não-informada (BFS/DFS/UCS) e informada (Gulosa/A*)
em um espaço de estados finito e visualmente intuitivo (cada estado = uma célula do grid).

### Cubo Mágico 2x2 (Pocket Cube)

Um cubo 2x2x2 embaralhado deve ser resolvido movimento a movimento até voltar ao estado "resolvido"
(cada face com uma única cor). Diferente do labirinto, aqui os "estados" não têm estrutura espacial
2D óbvia — é um problema de busca em espaço de estados combinatorial, o mesmo tipo de formulação
usada para o 8-puzzle, torres de Hanói etc., mas com uma motivação mais tangível.

### Jogo da Velha N×N

Dois agentes (ou um humano e um agente) se alternam marcando um tabuleiro N×N, vencendo quem
formar primeiro uma sequência de K marcas em linha (linha, coluna ou diagonal). Diferente dos dois
problemas anteriores, aqui existe um **adversário** ativo: o algoritmo não busca "um caminho até o
objetivo", mas a melhor jogada assumindo que o oponente também joga de forma ótima — o problema
representativo clássico de busca adversária (minimax) em IA.

---

## b) Algoritmos implementados

Implementados uma única vez em [`src/lib/core/search.ts`](web/src/lib/core/search.ts), todos como
busca em grafo (mantêm um conjunto de visitados, evitando reexpandir estados):

- **BFS (Busca em Largura)** — fronteira FIFO. Ótimo quando todos os custos de aresta são iguais.
- **DFS (Busca em Profundidade)** — fronteira LIFO. Completa (em espaços finitos) mas **não** ótima;
  incluída propositalmente para mostrar esse contraste nas comparações.
- **UCS (Custo Uniforme / Dijkstra)** — fronteira de prioridade por custo acumulado `g(n)`. Ótima em
  qualquer grafo com custos não negativos.
- **Gulosa (Greedy Best-First)** — fronteira de prioridade pela heurística `h(n)`, ignorando o custo
  já pago. Rápida, mas não garante otimalidade.
- **A\*** — fronteira de prioridade por `f(n) = g(n) + h(n)`. Ótima quando `h` é admissível.

Para o **Jogo da Velha**, o algoritmo é outro (busca adversária), implementado em
[`src/lib/game/model.ts`](web/src/lib/game/model.ts):

- **Minimax** — explora a árvore de jogo completa (ou até um limite de profundidade), maximizando
  o resultado para X e minimizando para O.
- **Minimax + poda Alfa-Beta** — mesmo algoritmo, mas descarta ramos que provadamente não podem
  mudar a decisão do nó pai, sem alterar o resultado. Para tabuleiros maiores que os limites de
  profundidade tratáveis, usa uma função de avaliação heurística (contagem de linhas abertas
  ponderadas) nos nós-folha do corte.

## c) Parâmetros configuráveis

**Labirinto** ([`/labirinto`](web/src/app/labirinto/page.tsx)): dimensões do grid (linhas/colunas),
modo de geração (labirinto perfeito via *recursive backtracker*, obstáculos aleatórios com
densidade configurável, ou grid vazio para edição manual), movimento diagonal on/off, heurística
(Manhattan, Euclidiana, Chebyshev, Octile), algoritmo, velocidade de animação, e edição manual do
grid com um pincel (parede / lama / vazio / início / objetivo).

**Cubo Mágico** ([`/cubo`](web/src/app/cubo/page.tsx)): profundidade do embaralhamento (1 a 7
movimentos aleatórios a partir do estado resolvido) e algoritmo de resolução.

**Jogo da Velha** ([`/jogo`](web/src/app/jogo/page.tsx)): tamanho do tabuleiro (3×3 a 6×6),
sequência vencedora K, profundidade máxima de busca (completa para 3×3; limitada com avaliação
heurística para tabuleiros maiores), modo (humano contra o agente, ou agente contra agente) e
algoritmo do agente (Minimax puro ou com poda Alfa-Beta).

## d) Demonstração do funcionamento (roteiro sugerido para o vídeo)

1. **Labirinto**: gerar um labirinto perfeito, executar A* animado (mostrar a expansão em azul e o
   caminho final), depois trocar para "Comparar todos os algoritmos" e mostrar a tabela — destacar
   que BFS/UCS/A* empatam no custo ótimo, DFS geralmente encontra um caminho bem mais longo, e A*
   expande muito menos nós que BFS. Editar manualmente uma parede com o pincel e reexecutar para
   mostrar a reatividade do agente a mudanças no ambiente.
2. **Cubo Mágico**: embaralhar com profundidade 4-5, resolver com A* (poucos nós, poucos ms),
   depois "Comparar algoritmos" e destacar BFS/UCS/A* chegando ao mesmo custo ótimo com esforços
   muito diferentes, e a Gulosa eventualmente encontrando uma solução muito mais longa (ilustra o
   risco de usar só a heurística, sem custo acumulado).
3. **Jogo da Velha**: jogar uma partida 3×3 contra o agente (mostrar que ele nunca perde — no
   máximo empata), depois "Comparar Minimax vs. Alfa-Beta" na mesma posição e destacar a redução
   de nós explorados. Trocar para um tabuleiro 4×4/5×5 e modo agente-vs-agente para mostrar a
   avaliação heurística em ação quando a árvore completa é grande demais.

## e) Apresentação e análise da solução encontrada

- **Labirinto**: a solução é o caminho (sequência de células/direções) do início ao objetivo. Sua
  qualidade é medida pelo custo acumulado (soma dos custos das arestas percorridas — 1 em terreno
  normal, 5 em lama, ×√2 na diagonal). BFS/UCS/A* sempre retornam o custo ótimo; DFS e Gulosa não
  têm essa garantia e tipicamente retornam soluções mais longas/caras.
- **Cubo Mágico**: a solução é a sequência de movimentos (`U`, `R'`, `F2`, ...) que leva do estado
  embaralhado ao estado resolvido. Como o "custo" de cada movimento é 1 (métrica *half-turn*), o
  custo da solução é simplesmente seu número de movimentos.
- **Jogo da Velha**: a "solução" a cada turno é a melhor jogada disponível (índice da casa) e o seu
  valor minimax (positivo favorece X, negativo favorece O, zero é empate com jogo perfeito de
  ambos os lados). Contra o agente em 3×3 o resultado ótimo conhecido é **empate** — os testes
  automatizados (`test/game.test.ts`) confirmam que dois agentes ótimos sempre empatam.

## f) Comparação de resultados entre algoritmos

Exemplo real capturado ao resolver o mesmo embaralhamento de 4 movimentos do cubo (`U R F' R2`)
com os quatro algoritmos disponíveis:

| Algoritmo | Ótimo? | Custo | Nós expandidos | Nós gerados | Tempo |
| --- | --- | --- | --- | --- | --- |
| BFS | sim | 4 | 266 | 1.557 | 12,2 ms |
| UCS | sim | 4 | 1.324 | 7.402 | 34,9 ms |
| Gulosa | **não** | **1074** | 12.688 | 73.001 | 311,1 ms |
| A* | sim | 4 | **57** | 337 | **1,0 ms** |

Leituras interessantes para o relatório: (1) BFS, UCS e A* concordam no custo ótimo (4), como
esperado — todos são ótimos com custo de aresta uniforme; (2) A* expande ~4,7× menos nós que BFS
graças à heurística guiando a busca; (3) UCS, apesar de ótimo, expande *mais* nós que BFS neste
caso — com custos de aresta todos iguais a 1, o desempate da fila de prioridade do UCS é menos
eficiente que o FIFO puro do BFS; (4) a Gulosa, por ignorar o custo acumulado, encontra uma
solução válida porém **270× mais longa que a ótima**, evidenciando por que otimalidade não pode
ser assumida sem custo no critério de prioridade.

No **Jogo da Velha** 3×3, comparando Minimax puro vs. Alfa-Beta a partir do tabuleiro vazio:

| Algoritmo | Nós explorados | Ramos podados | Tempo |
| --- | --- | --- | --- |
| Minimax puro | 549.945 | — | ~250 ms |
| Minimax + Alfa-Beta | 12.931 | 4.468 | ~6 ms |

Ambos chegam à **mesma avaliação** (0 = empate com jogo perfeito) e à mesma jogada ótima — a poda
Alfa-Beta não muda o resultado, apenas evita explorar ramos que não podem influenciá-lo, reduzindo
os nós explorados em ~42× nesse caso.

No **Labirinto**, A* consistentemente expande igual ou menos nós que UCS/BFS para o mesmo custo
ótimo (verificado também em `test/maze.test.ts`), com a vantagem crescendo em labirintos maiores.

## g) Dificuldades encontradas e possíveis melhorias

- **Escolha do 3x3 vs. 2x2 no cubo mágico**: o espaço de estados do cubo 3x3 (~4,3×10¹⁹ estados)
  torna BFS/UCS/A* sem heurística de qualidade inviáveis de rodar no navegador. Optamos pelo cubo
  **2x2** (3.674.160 estados), grande o bastante para ser um problema real, mas pequeno o
  suficiente para uma busca cega (BFS) ainda terminar em tempo interativo em embaralhamentos
  curtos — permitindo a comparação honesta entre busca cega e informada que era o objetivo
  didático. Melhoria possível: estender para 3x3 usando IDA* com heurísticas de *pattern database*
  (a técnica real usada por solucionadores ótimos de cubo mágico).
- **Correção do motor do cubo**: implementar as rotações de um cubo mágico "à mão" (tabelas de
  ciclos de facelets) é uma fonte clássica de bugs sutis de sinal/orientação. Para evitar isso, o
  motor foi modelado com coordenadas 3D reais e matrizes de rotação padrão (regra da mão direita)
  em vez de ciclos derivados manualmente, e validado com testes automatizados
  (`test/cube.test.ts`) que incluem uma **busca em largura exaustiva de todo o espaço de estados**,
  confirmando exatamente 3.674.160 estados alcançáveis — o valor conhecido na literatura para o
  Pocket Cube — o que dá alta confiança de que o motor de movimentos está correto.
- **Heurística do cubo é fraca**: usamos `⌈peças fora do lugar / 4⌉` (admissível, pois cada
  movimento corrige no máximo 4 peças), mas ela tem muitos platôs (muitos estados com o mesmo
  valor), o que explica o comportamento errático da busca Gulosa observado na tabela acima. Uma
  melhoria natural seria uma heurística de *pattern database* (custo real pré-computado para
  subconjuntos de peças), muito mais informativa.
- **Desempenho no navegador**: BFS/UCS em buscas com muitos nós rodam de forma síncrona na thread
  principal, podendo travar a UI por alguns segundos em embaralhamentos de cubo mais profundos
  (por isso o limite de 7 movimentos no slider, com aviso na interface). Melhoria possível: mover
  a busca para um *Web Worker*.
- **Jogo da Velha em tabuleiros grandes**: para N > 3 a árvore de jogo cresce rápido demais para
  busca completa; usamos limite de profundidade + avaliação heurística, o que é padrão em IA de
  jogos, mas significa que o agente deixa de jogar de forma comprovadamente ótima nesses tamanhos.
  Melhorias possíveis: ordenação de jogadas mais sofisticada (killer moves), tabela de
  transposição, ou aprofundamento iterativo (*iterative deepening*) com orçamento de tempo.
- **Tornar visível a diferença entre algoritmos, não só os números**: a tabela comparativa (seção
  f) mostra custo/nós/tempo, mas não *por que* BFS explora mais nós que A* no mesmo labirinto.
  Implementamos um "modo corrida" (labirinto → Corrida entre algoritmos) que roda os 5 algoritmos
  simultaneamente sobre a mesma instância, revelando as células exploradas de cada um em tempo real
  na mesma velocidade — quem expande menos nós termina visivelmente primeiro, transformando a
  eficiência de um número abstrato em algo que se vê acontecer. Limitação atual: cada mini-tabuleiro
  é uma cena Three.js independente (5 canvases simultâneos), o que não escalaria para labirintos
  muito maiores sem otimizações como *instanced meshes*.
