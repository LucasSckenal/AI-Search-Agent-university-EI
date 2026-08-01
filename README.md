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
npm run test       # testes rápidos: motor de busca, labirinto, jogo da velha e cubo (smoke test)
npm run test:cube  # suíte completa do cubo, incluindo BFS exaustiva do espaço de estados (~2-3 min)
npm run lint       # ESLint
```

Nenhuma variável de ambiente ou serviço externo é necessário — é uma aplicação 100% client-side.
O workflow em [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda typecheck, lint, os
testes rápidos, a suíte completa do cubo (incluindo a BFS exaustiva) e o build a cada push/PR,
então nada disso fica só "de memória" antes de entregar.

## Deploy (Vercel)

O app não tem variáveis de ambiente, banco de dados ou API routes — é só o build estático do
Next.js — então o deploy na Vercel é essencialmente zero-config, com um único ajuste: o projeto
Next.js vive em `web/`, não na raiz do repositório.

1. [Importe o repositório](https://vercel.com/new) na Vercel.
2. Em **Build & Development Settings**, defina **Root Directory** = `web`. A partir daí a Vercel
   detecta o framework Next.js automaticamente (build/output/install command não precisam de
   override).
3. Deploy — nenhuma variável de ambiente a configurar.

Via CLI, o equivalente é rodar a partir de `web/`:

```bash
cd web
npx vercel        # preview
npx vercel --prod # produção
```

Cada push em `main`/`master` também roda o [workflow de CI](.github/workflows/ci.yml) (typecheck,
lint, testes e build); vale manter esse pipeline verde antes de promover um deploy para produção.

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

### Complexidade teórica × fator de ramificação real de cada problema

| Algoritmo | Tempo | Espaço | Ótimo? |
| --- | --- | --- | --- |
| BFS | O(b^d) | O(b^d) | Sim, se custo de aresta uniforme |
| DFS | O(b^m) | O(b·m) | Não |
| UCS | O(b^(1+⌊C\*/ε⌋)) | O(b^(1+⌊C\*/ε⌋)) | Sim |
| Gulosa | O(b^m) no pior caso | O(b^m) no pior caso | Não |
| A\* | O(b^d) no pior caso, muito menos com boa heurística | O(b^d) | Sim, se `h` admissível (e aqui, consistente — ver abaixo) |

(`b` = fator de ramificação do problema, `d` = profundidade da solução ótima, `m` = profundidade
máxima da árvore de busca, `C*` = custo da solução ótima, `ε` = menor custo de aresta positivo.)

Essas fórmulas são abstratas até se conectar `b` a um número real de cada problema — é aí que a
tabela vira previsão testável, não só teoria:

- **Labirinto**: `b` ≤ 4 (movimento ortogonal) ou ≤ 8 (diagonal ligado), tipicamente bem menor na
  prática por causa das paredes. Com um labirinto pequeno (`d` de dezenas de passos), mesmo BFS em
  O(b^d) é tratável — por isso o app usa grids de até 35×45, não maiores.
- **Cubo Mágico**: `b` = 9 (2x2, 9 movimentos possíveis: `U R F` e variantes) ou 18 (3x3, seis
  faces × 3 variantes). Essa é exatamente a razão de existir a coluna b\* na seção f) — ela mede o
  fator de ramificação que o algoritmo *realmente* enfrentou, então comparar b (teórico, fixo) com
  b\* (medido, por algoritmo) mostra quantitativamente quanto cada heurística podou: no exemplo da
  seção f), UCS mede b\*≈9,01 (praticamente igual ao `b`=9 teórico — ele quase não poda nada além do
  que a busca cega já faria) enquanto A\* mede b\*≈3,99 (reduz o fator de ramificação *percebido*
  para menos da metade, sem mudar o `b`=9 real do problema, que é fixo pela definição do cubo).
- **Jogo da Velha**: `b` não é constante — começa em `N²` (tabuleiro vazio) e decresce 1 a cada
  jogada até 1, o que é exatamente por que a árvore completa (`O(b^m)` com `m` até `N²`) só é
  tratável para `N`=3 (9! = 362.880 folhas no pior caso) e precisa de poda Alfa-Beta ou avaliação
  heurística de profundidade limitada para `N` maior — ver seção c).

### Admissibilidade não basta: por que as heurísticas aqui também precisam ser consistentes

O texto de otimalidade do A\* costuma citar só admissibilidade (`h(n)` nunca superestima o custo
real até o objetivo), mas essa garantia formal — Russell & Norvig, seção 3.5.2 — só vale sem
ressalvas para busca em *árvore*. A implementação em
[`search.ts`](web/src/lib/core/search.ts) (bloco UCS/Gulosa/A\*, por volta das linhas 170-197) é
busca em *grafo* com lista fechada
(`visited`) que **nunca reabre um nó já expandido** (`if (visited.has(key)) continue`, sem
comparar se o novo caminho é mais barato) — a forma clássica de implementar A\* eficientemente,
mas que só preserva a otimalidade se `h` for **consistente** (monotônica): `h(n) ≤ custo(n, n') +
h(n')` para toda aresta `(n, n')`. Consistência implica admissibilidade, mas a volta não vale — e é
exatamente esse buraco que causou um bug real, encontrado escrevendo esta seção:

**Bug encontrado e corrigido**: a heurística Manhattan (`|Δlinha| + |Δcoluna|`) é consistente para
movimento só-ortogonal, mas deixa de ser *admissível* quando movimento diagonal está ligado — um
passo diagonal cobre `Δlinha=Δcoluna=1` (2 unidades de distância Manhattan) por apenas `√2×` o
custo de um passo ortogonal, então Manhattan **superestima** o custo real sempre que existe atalho
diagonal. Isso não é só teórico: testando A\* com Manhattan+diagonal contra UCS (que é ótimo
independente de heurística) em 500 labirintos aleatórios, A\* voltou com um caminho pior que o
ótimo em **93 casos (18,6%)**. A correção, em
[`labirinto/page.tsx`](web/src/app/labirinto/page.tsx): a opção "Manhattan" some do seletor de
heurística sempre que o movimento diagonal está ligado (e troca automaticamente para Octile se
já estivesse selecionada), com uma nota explicando o motivo na interface. Um teste de regressão em
[`test/maze.test.ts`](web/test/maze.test.ts) verifica, em 8 labirintos aleatórios × 3 heurísticas,
que as heurísticas ainda oferecidas com diagonal ligado (Euclidiana, Chebyshev, Octile) sempre
batem o custo ótimo do UCS.

Prova rápida de que as outras se mantêm consistentes (com ou sem diagonal, já que o custo por
célula é sempre ≥ 1):

- **Euclidiana** (`√(Δlinha² + Δcoluna²)`): é a distância geométrica em linha reta entre duas
  células. Como o custo de qualquer passo (ortogonal ou diagonal) é sempre ≥ ao comprimento
  euclidiano desse passo (custo mínimo 1 por unidade de terreno, e a diagonal já é ponderada por
  `√2`), a desigualdade triangular garante `h(n) ≤ custo(n,n') + h(n')` diretamente — a heurística
  geométrica clássica que nunca precisa de ajuste por direção de movimento permitida.
- **Chebyshev** (`max(|Δlinha|, |Δcoluna|)`): decresce no máximo 1 por passo, em qualquer uma das 8
  direções — e todo passo custa ≥ 1 (ortogonal) ou ≥ `√2` (diagonal), ambos ≥ 1. Fica consistente
  mas *subestima* mais que o necessário com diagonal ligado (assume que diagonal custa o mesmo que
  ortogonal) — por isso o app também oferece Octile, que corrige exatamente essa lacuna.
- **Octile** (`max(Δlinha,Δcoluna) + (√2-1)·min(Δlinha,Δcoluna)`): a heurística "certa" para
  movimento de 8 direções com diagonal custando `√2×` o ortogonal — o mesmo argumento de Chebyshev,
  mas contabilizando o custo real de cada diagonal ao invés de assumir custo 1.

No **Cubo Mágico**, a heurística `⌈peças fora do lugar / k⌉` (`k` = `piecesPerMove(size)`, 4 no
2x2) é consistente pelo mesmo argumento usado para provar admissibilidade, só que aplicado
*aresta a aresta* em vez de ao problema todo: cada movimento corrige no máximo `k` peças, então
`misplaced(n) - misplaced(n') ≤ k` para qualquer aresta `(n,n')`. Usando a propriedade
`⌈(a-k)/k⌉ = ⌈a/k⌉ - 1` para `a,k` inteiros positivos, isso dá `h(n) - h(n') ≤ 1`, e como todo
movimento custa exatamente 1 (métrica *half-turn*), `h(n) ≤ 1 + h(n') = custo(n,n') + h(n')` —
exatamente a definição de consistência. Diferente do labirinto, aqui não há uma "opção perigosa"
paralela (o cubo só tem essa heurística), então não havia bug a encontrar — mas vale registrar a
prova, já que "admissível" sozinho (o que a interface já dizia) não seria suficiente para justificar
a otimalidade do A\* do jeito que ele está implementado.

**Por que o Cubo Mágico não oferece DFS**: é uma decisão deliberada, não uma omissão. O espaço de
estados do cubo é um grafo denso e cheio de ciclos (qualquer sequência de movimentos pode ser
desfeita) — DFS puro em busca-em-grafo ainda termina (a lista de visitados evita laços infinitos),
mas sem limite de profundidade ele mergulha em ramos arbitrariamente longos antes de sequer
considerar voltar, o que na prática significa "encontra uma solução absurdamente comprida, se
encontrar alguma antes do limite de segurança de nós". No labirinto DFS é interessante justamente
por *mostrar* esse comportamento ruim de forma legível (um caminho zigue-zague visível no grid);
no cubo o mesmo comportamento só produziria uma sequência de dezenas de milhares de movimentos sem
nenhum valor pedagógico a mais que o labirinto já não desse. A alternativa real para tornar DFS
útil aqui seria *iterative deepening* (IDDFS/IDA\*) — descartada pelo mesmo motivo do IDA\* completo
citado na seção g): o ganho de espaço O(bd) não compensa a implementação extra para um cubo onde
A\* já resolve embaralhamentos rasos em poucos milissegundos.

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
2. **Cubo Mágico**: embaralhar com profundidade 4-5 e resolver com BFS para ver a solução animada
   movimento a movimento. Opcionalmente, nos Parâmetros avançados, ativar a "Pré-visualização da
   busca" (desligada por padrão — pisca em ~35 quadros/s, acima do limiar de 3 flashes/s associado
   a epilepsia fotossensível, então é opt-in) para ver, antes da solução, o cubo passando por uma
   amostra dos estados que o algoritmo realmente visitou (`exploredOrder`, devolvido pelo mesmo
   `search()` genérico do labirinto) com um contador ao vivo ("Explorando nó X / N nós
   expandidos") — evidencia BFS "tateando" muitos estados versus A*/Gulosa indo quase direto à
   solução. Depois "Comparar algoritmos" e destacar BFS/UCS/A* chegando ao mesmo custo ótimo com
   esforços muito diferentes, e a Gulosa eventualmente encontrando uma solução muito mais longa
   (ilustra o risco de usar só a heurística, sem custo acumulado).
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

| Algoritmo | Ótimo? | Custo | Nós expandidos | Nós gerados | b* | Tempo |
| --- | --- | --- | --- | --- | --- | --- |
| BFS | sim | 4 | 266 | 1.557 | 6,00 | 12,2 ms |
| UCS | sim | 4 | 1.324 | 7.402 | 9,01 | 34,9 ms |
| Gulosa | **não** | **1074** | 12.688 | 73.001 | 1,01 | 311,1 ms |
| A* | sim | 4 | **57** | 337 | **3,99** | **1,0 ms** |

A coluna **b\*** é o *fator de ramificação efetivo* (Russell & Norvig, eq. 3.14): o fator de
ramificação que uma árvore uniforme da mesma profundidade precisaria ter para gerar esse número de
nós — quanto mais perto de 1, mais a busca andou "em linha reta" até a solução. É a métrica padrão
da literatura para colocar um número único na qualidade de uma heurística, em vez de só comparar
contagens brutas de nós entre algoritmos com profundidades de solução diferentes. Calculado em
[`src/lib/core/metrics.ts`](web/src/lib/core/metrics.ts) e validado em
[`test/metrics.test.ts`](web/test/metrics.test.ts) contra o exemplo do próprio livro-texto
(N=52, d=5 → b\*≈1,92) e contra uma árvore uniforme construída à mão.

Leituras interessantes para o relatório: (1) BFS, UCS e A* concordam no custo ótimo (4), como
esperado — todos são ótimos com custo de aresta uniforme; (2) A* expande ~4,7× menos nós que BFS
graças à heurística guiando a busca, e seu b\*=3,99 confirma isso quantitativamente — quase metade
do branching factor real do problema (9 movimentos possíveis por estado no 2x2); (3) UCS, apesar
de ótimo, expande *mais* nós que BFS neste caso — com custos de aresta todos iguais a 1, o
desempate da fila de prioridade do UCS é menos eficiente que o FIFO puro do BFS, e seu b\*≈9 (igual
ao branching factor real) mostra que ele não está podando *nada* além do que a busca cega já faria;
(4) a Gulosa, por ignorar o custo acumulado, encontra uma solução válida porém **270× mais longa
que a ótima** — e seu b\* baixíssimo (1,01) é justamente o porquê: a heurística a guiou "eficientemente"
por um caminho muito mais longo, ilustrando que b\* mede eficiência de busca, não qualidade da
solução — as duas métricas precisam ser lidas juntas.

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
  muito maiores sem otimizações como *instanced meshes*. A mesma ideia foi tentada no Cubo Mágico
  (piscar por uma amostra de `exploredOrder` antes da solução), mas ali o efeito troca a cena
  inteira de cor a ~35 quadros/s — acima do limiar de 3 flashes/s associado a crises epilépticas
  fotossensíveis (diretriz WCAG). Em vez de descartar a ideia, deixamos como opt-in (desligado por
  padrão, ativável nos Parâmetros avançados do cubo): a lição foi que "mostrar o algoritmo
  pensando" tem que ser avaliado também pelo risco de acessibilidade da técnica de animação
  escolhida, não só pelo efeito visual.
- **Acessibilidade das grades 3D (auditoria pós-entrega)**: uma auditoria geral do projeto expôs
  que pintar o labirinto e jogar a velha eram interações só de mouse/touch — clicar numa malha
  WebGL não tem equivalente nativo de teclado. Adicionamos navegação por setas + Enter/espaço nas
  duas grades, com um anel 3D (`FocusRing`, em `Maze3D.tsx`/`Game3D.tsx`) marcando a célula
  focada, já que o canvas não tem indicador de foco nativo. O `Select` customizado também ganhou o
  padrão ARIA de listbox (`role`, `aria-expanded`, `aria-activedescendant`, navegação por setas).
  Limitação que permanece: sem uma estrutura DOM paralela por célula, não dá para expor uma grade
  ARIA completa (`role="grid"`/`gridcell`) sobre um canvas WebGL — o que existe é operável por
  teclado e anunciado via `aria-label`, mas um leitor de tela não consegue "varrer" cada célula
  individualmente como faria numa tabela HTML real.
