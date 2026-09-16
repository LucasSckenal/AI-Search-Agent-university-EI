import Link from "next/link";
import { Icon } from "@/components/shared/Panel";
import { FrontierShader } from "@/components/home/FrontierShader";
import { HeroTicker } from "@/components/home/HeroTicker";
import { HomeDemoCarousel } from "@/components/home/HomeDemoCarousel";
import { MazePreview, CubePreview, TttPreview, GoosePreview, TspPreview, QueensPreview, RLPreview, Game2048Preview, TetrisPreview, Lig4Preview, SudokuPreview, SnakePreview, MinesweeperPreview, BattleshipPreview, DungeonPreview, PenduloPreview, AstarPreview, MinimaxPreview, AlgoritmoGeneticoPreview, PerceptronPreview, HopfieldPreview, DigitosPreview, GatosCachorrosPreview } from "@/components/home/ModulePreviews";

const MODULES = [
  {
    href: "/labirinto",
    title: "Labirinto",
    accent: "maze",
    preview: MazePreview,
    desc: "Navegação em uma grade com paredes e terreno com custo. Visualize a expansão da fronteira em tempo real e encontre o caminho ótimo.",
    algos: ["BFS", "DFS", "UCS", "Gulosa", "A*", "AG"],
    statLine: "6 algoritmos · grid até 35×45",
  },
  {
    href: "/cubo",
    title: "Cubo Mágico 2x2",
    accent: "cube",
    preview: CubePreview,
    desc: "Resolução de um Pocket Cube embaralhado. Observe o agente encontrando a sequência mínima de movimentos num espaço de 3.674.160 estados.",
    algos: ["BFS", "UCS", "Gulosa", "A*"],
    statLine: "3.674.160 estados possíveis",
  },
  {
    href: "/jogo",
    title: "Jogo da Velha N×N",
    accent: "game",
    preview: TttPreview,
    desc: "Busca adversária para jogos competitivos. Veja como o agente antecipa suas jogadas com Minimax e poda Alfa-Beta.",
    algos: ["Minimax", "Alfa-Beta"],
    statLine: "Minimax + Alfa-Beta · tabuleiro até 6×6",
  },
  {
    href: "/goose",
    title: "Goose",
    accent: "goose",
    preview: GoosePreview,
    desc: "Uma população de redes neurais evolui, geração após geração, para sobreviver o máximo de tempo possível desviando de cactos e pássaros.",
    algos: ["Algoritmo Genético"],
    statLine: "Seleção, cruzamento e mutação · N gerações",
  },
  {
    href: "/tsp",
    title: "Caixeiro Viajante",
    accent: "tsp",
    preview: TspPreview,
    desc: "Encontre a rota mais curta que visita todas as cidades exatamente uma vez e retorna ao início. Compare uma heurística construtiva, busca local, um algoritmo genético e a solução exata.",
    algos: ["Vizinho Mais Próximo", "2-opt", "AG", "Held-Karp"],
    statLine: "4 algoritmos · solução exata até 12 cidades",
  },
  {
    href: "/rainhas",
    title: "N-Rainhas",
    accent: "rainhas",
    preview: QueensPreview,
    desc: "Posicione N rainhas num tabuleiro sem que nenhuma ataque outra. Compare backtracking puro, forward checking com propagação de restrições, busca local por reparo de conflitos e um algoritmo genético.",
    algos: ["Backtracking", "Forward Checking", "Min-Conflitos", "AG"],
    statLine: "4 algoritmos · tabuleiro até 16×16",
  },
  {
    href: "/aprendizado",
    title: "Aprendizado por Reforço",
    accent: "aprendizado",
    preview: RLPreview,
    desc: "Um agente aprende a chegar ao objetivo por tentativa e erro num mundo de grade com buracos e paredes. Compare Q-learning, que não conhece o modelo, com Iteração de Valor, que conhece e converge para a política ótima.",
    algos: ["Q-Learning", "Iteração de Valor"],
    statLine: "2 algoritmos · grade até 12×12",
  },
  {
    href: "/2048",
    title: "2048",
    accent: "g2048",
    preview: Game2048Preview,
    desc: "Deslize e combine blocos iguais até chegar a 2048. Compare uma heurística gulosa, um Algoritmo Genético que evolui os pesos dessa heurística, e Expectimax — a variante estocástica do Minimax que olha turnos à frente — ou jogue você mesmo.",
    algos: ["Heurística Gulosa", "Algoritmo Genético", "Expectimax"],
    statLine: "3 algoritmos · tabuleiro até 6×6",
  },
  {
    href: "/tetris",
    title: "Tetris",
    accent: "tetris",
    preview: TetrisPreview,
    desc: "Encaixe as peças que caem e limpe linhas o quanto der. Compare uma heurística gulosa que avalia cada posição de queda com um Algoritmo Genético que evolui os pesos dela, ou jogue você mesmo.",
    algos: ["Heurística Gulosa", "Algoritmo Genético"],
    statLine: "2 algoritmos · tabuleiro 10×20",
  },
  {
    href: "/lig4",
    title: "Lig 4",
    accent: "lig4",
    preview: Lig4Preview,
    desc: "Solte peças numa coluna e alinhe quatro antes do adversário. Estende a busca adversária do Jogo da Velha para um tabuleiro bem maior e apresenta a Busca em Árvore de Monte Carlo (MCTS), que simula partidas aleatórias em vez de explorar a árvore por completo.",
    algos: ["Minimax", "Alfa-Beta", "MCTS"],
    statLine: "3 algoritmos · tabuleiro 7×6",
  },
  {
    href: "/sudoku",
    title: "Sudoku",
    accent: "sudoku",
    preview: SudokuPreview,
    desc: "Preencha a grade 9×9 sem repetir dígitos em linha, coluna ou bloco. Compare backtracking puro, forward checking e AC-3 — consistência de arco por propagação de restrições —, ou jogue você mesmo.",
    algos: ["Backtracking", "Forward Checking", "AC-3"],
    statLine: "3 algoritmos · grade 9×9",
  },
  {
    href: "/snake",
    title: "Cobrinha",
    accent: "snake",
    preview: SnakePreview,
    desc: "Guie a cobra até a comida sem colidir. Compare A*, que replaneja o caminho mais curto a cada passo mas pode se prender sozinho conforme cresce, com um Ciclo Hamiltoniano que percorre uma rota fixa e nunca colide, ou jogue você mesmo.",
    algos: ["A*", "Ciclo Hamiltoniano"],
    statLine: "2 algoritmos · tabuleiro 20×20",
  },
  {
    href: "/campo-minado",
    title: "Campo Minado",
    accent: "campo-minado",
    preview: MinesweeperPreview,
    desc: "Revele todas as células sem mina. Compare Dedução Lógica — que só age com certeza absoluta e às vezes trava — com Inferência Probabilística, que calcula a chance exata de cada célula ser mina e arrisca o palpite mais seguro quando a lógica pura não basta.",
    algos: ["Dedução Lógica", "Inferência Probabilística"],
    statLine: "2 algoritmos · tabuleiro até 30×16",
  },
  {
    href: "/batalha-naval",
    title: "Batalha Naval",
    accent: "batalha-naval",
    preview: BattleshipPreview,
    desc: "Afunde toda a frota inimiga disparando num tabuleiro 10×10. Compare Caça e Alvo — que varre em paridade de tabuleiro de xadrez e depois isola a linha de um navio atingido — com Mapa de Densidade, que enumera todos os posicionamentos válidos da frota restante e sempre dispara na célula mais coberta, ou jogue você mesmo.",
    algos: ["Caça e Alvo", "Mapa de Densidade"],
    statLine: "2 algoritmos · tabuleiro 10×10, frota clássica de 5 navios",
  },
  {
    href: "/pacman",
    title: "Masmorra",
    accent: "masmorra",
    preview: DungeonPreview,
    desc: "Fuja dos monstros e colete todos os itens de um labirinto gerado por algoritmo a cada partida. Compare o conjunto de monstros especializados — cada um com uma regra de alvo própria (perseguição direta, emboscada, flanco e recuo) — com monstros gulosos que perseguem todos a mesma posição atual do herói, ou jogue você mesmo.",
    algos: ["Perseguição Especializada", "Perseguição Gulosa"],
    statLine: "2 algoritmos · labirinto procedural 21×21, 4 monstros",
  },
  {
    href: "/pendulo",
    title: "Pêndulo Invertido",
    accent: "pendulo",
    preview: PenduloPreview,
    desc: "Equilibre um pêndulo sobre um carrinho, o clássico problema de controle usado desde os anos 80 para testar aprendizado de máquina. Compare uma rede neural de duas camadas ocultas — visível ao vivo, neurônio por neurônio — cujos pesos evoluem por Algoritmo Genético com um controlador PD escrito à mão, que reage ao ângulo e à posição sem aprender nada, ou jogue você mesmo.",
    algos: ["Neuroevolução", "Controlador PD"],
    statLine: "2 algoritmos · física contínua, controle bang-bang",
  },
  {
    href: "/astar",
    title: "Busca A*",
    accent: "astar",
    preview: AstarPreview,
    desc: "Aula interativa focada só no A*: veja a fila de prioridade (fronteira) ordenada por f = g + h ao vivo, nó a nó, decidindo qual expandir a seguir, com garantia de caminho ótimo sob heurística admissível.",
    algos: ["A* (Explicação Interativa)"],
    statLine: "1 algoritmo · fronteira ao vivo, passo a passo",
  },
  {
    href: "/minimax",
    title: "Minimax",
    accent: "minimax",
    preview: MinimaxPreview,
    desc: "Aula interativa focada só no Minimax: veja a árvore de um fim de jogo do velha crescer nó a nó, os valores subindo das folhas até a raiz, e compare com poda Alfa-Beta ligada e desligada — mesma resposta, bem menos nós visitados.",
    algos: ["Minimax (Explicação Interativa)", "Alfa-Beta (Explicação Interativa)"],
    statLine: "2 algoritmos · árvore de busca real, nó a nó",
  },
  {
    href: "/algoritmo-genetico",
    title: "Algoritmo Genético",
    accent: "algoritmo-genetico",
    preview: AlgoritmoGeneticoPreview,
    desc: "Aula interativa focada só no Algoritmo Genético: uma população inteira de sequências de movimento evolui por seleção, cruzamento (de ponto único, sobre um genoma sequencial) e mutação, e você vê o enxame inteiro — não só o melhor indivíduo — convergindo para o alvo, geração a geração.",
    algos: ["Genético (Explicação Interativa)"],
    statLine: "1 algoritmo · população inteira visível, geração a geração",
  },
  {
    href: "/perceptron",
    title: "Classificador Linear",
    accent: "perceptron",
    preview: PerceptronPreview,
    desc: "Aula interativa focada só em redes neurais treinadas de verdade: uma rede pequena aprende a separar pontos de duas classes por gradiente descendente, sem nenhum algoritmo genético. Desligue a camada oculta e veja o perceptron clássico falhar em XOR e num círculo — a limitação que Minsky e Papert apontaram em 1969 — e ligue de novo pra ver a fronteira curvar e resolver os dois.",
    algos: ["Gradiente Descendente (Backpropagation)"],
    statLine: "1 algoritmo · fronteira de decisão ao vivo, época a época",
  },
  {
    href: "/hopfield",
    title: "Hopfield",
    accent: "hopfield",
    preview: HopfieldPreview,
    desc: "Memória associativa de verdade: sem gradiente, sem época de treino. Aprendizado de Hebb guarda padrões numa grade 10×10 numa única passada, e a recuperação corrige ruído por minimização de energia - até um certo limite de padrões guardados, depois do qual o recall começa a falhar.",
    algos: ["Aprendizado de Hebb"],
    statLine: "1 algoritmo · grade 10×10, recall por minimização de energia",
  },
  {
    href: "/digitos",
    title: "Dígitos Manuscritos",
    accent: "digitos",
    preview: DigitosPreview,
    desc: "O mesmo gradiente descendente do Classificador Linear, generalizado de duas classes num plano 2D pra dez classes numa imagem 8×8 desenhada à mão - softmax e entropia cruzada no lugar de sigmoid e entropia binária. Desenhe seu próprio dígito e veja a rede reconhecer ao vivo, traço a traço.",
    algos: ["Backpropagation Multi-Classe (Softmax)"],
    statLine: "1 algoritmo · reconhecimento ao vivo enquanto você desenha",
  },
  {
    href: "/gatos-cachorros",
    title: "Gatos vs Cachorros",
    accent: "gatos-cachorros",
    preview: GatosCachorrosPreview,
    desc: "O primeiro módulo do site com convolução de verdade: filtros 3×3 aprendidos, ReLU, max-pool e duas camadas densas, forward e backward de cada camada escritos à mão. Treinado com 30 fotos reais de gatos e cachorros (licença aberta, Wikimedia Commons) - poucas fotos de verdade pra uma rede com milhares de pesos, uma lição bem mais honesta que dado sintético perfeito.",
    algos: ["Rede Convolucional (Conv + Max-Pool)"],
    statLine: "1 algoritmo · 30 fotos reais, mapas de ativação ao vivo",
  },
] as const;

const STATS = [
  {
    num: "43",
    label:
      "Algoritmos implementados — BFS, DFS, UCS, Gulosa, A*, Minimax, Alfa-Beta, Genético, Vizinho Mais Próximo, 2-opt, Held-Karp, Backtracking, Forward Checking, Min-Conflitos, Q-Learning, Iteração de Valor, Heurística Gulosa (2048), Expectimax, Heurística Gulosa (Tetris), Genético (Tetris), Minimax (Lig 4), Alfa-Beta (Lig 4), MCTS, Backtracking (Sudoku), Forward Checking (Sudoku), AC-3, Ciclo Hamiltoniano, Dedução Lógica, Inferência Probabilística, Caça e Alvo, Mapa de Densidade, IA de Perseguição Especializada por Papel, Perseguição Gulosa Uniforme, Neuroevolução (Rede Neural evoluída por Algoritmo Genético), Controlador Heurístico Realimentado (PD), A* (Explicação Interativa), Minimax (Explicação Interativa), Alfa-Beta (Explicação Interativa), Genético (Explicação Interativa), Gradiente Descendente (Backpropagation), Aprendizado de Hebb (Hopfield), Backpropagation Multi-Classe (Softmax), Rede Convolucional (Conv + Max-Pool)",
  },
  { num: "3.674.160", label: "Estados possíveis do Cubo Mágico 2×2, verificados por BFS exaustiva" },
  { num: "100%", label: "Execução local no navegador — nenhuma chamada a servidor" },
] as const;

const FLOW = [
  { icon: "tune", title: "Configurar", desc: "Escolha o problema, o tamanho e o algoritmo de busca." },
  { icon: "play_arrow", title: "Executar", desc: "Veja o agente expandir nós passo a passo, em tempo real." },
  { icon: "compare_arrows", title: "Comparar", desc: "Confronte custo, nós expandidos e tempo entre algoritmos." },
] as const;

const ABOUT_STATS = [
  { k: "Problemas", v: "23", icon: "apps", accent: "primary", live: false },
  { k: "Algoritmos", v: "43", icon: "account_tree", accent: "primary", live: false },
  { k: "Estados do cubo", v: "3.674.160", icon: "view_in_ar", accent: "tertiary", live: false },
  { k: "Execução", v: "100% local", icon: "bolt", accent: "secondary", live: true },
] as const;

export default function Home() {
  return (
    <div className="h-full overflow-y-auto content-scroll">
      {/* Hero: full-bleed WebGL "search frontier" backdrop behind the pitch */}
      {/* rounded-t matches .main-shell's own radius: this section is the first child of a nested
          overflow-y:auto scroller, and Firefox doesn't carry main-shell's rounded clip through
          into that nested scroll container, leaving square corners on this full-bleed hero. */}
      <section className="relative flex min-h-[92vh] items-center overflow-hidden rounded-t-[32px] px-6 pb-24 pt-24 lg:rounded-t-[40px]">
        <div className="hero-backdrop absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <FrontierShader />
        </div>
        <div className="hero-vignette absolute inset-0 z-0 pointer-events-none" />
        <div className="hero-fade absolute inset-0 z-0 pointer-events-none" />

        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
          <span className="hero-kicker mb-7 inline-flex items-center gap-2 rounded-full border border-primary/45 bg-primary/15 px-4 py-1.5">
            <span className="dot h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
              Inteligência Artificial
            </span>
          </span>

          <h1 className="hero-headline mb-6 max-w-3xl bg-gradient-to-b from-white to-on-surface-variant bg-clip-text text-[clamp(46px,6.2vw,84px)] font-bold leading-[1.03] tracking-[-0.03em] text-transparent">
            Agentes inteligentes de busca
          </h1>
          <p className="mb-10 max-w-xl text-lg leading-relaxed text-on-surface-variant">
            Explore a lógica por trás dos algoritmos clássicos de busca através de visualizações
            3D interativas — configure o problema, execute o agente passo a passo e compare o
            desempenho entre busca cega, informada e adversária.
          </p>

          <div className="mb-11 flex flex-wrap justify-center gap-3.5">
            <Link href="/labirinto" className="btn btn-primary btn-hero-glow !rounded-xl !px-7 !py-4 !text-[15px]">
              <Icon name="play_arrow" /> Começar exploração
            </Link>
            <a href="#sobre" className="btn btn-secondary !rounded-xl !px-7 !py-4 !text-[15px] backdrop-blur-md">
              Sobre o projeto
            </a>
          </div>

          <div className="hero-readout flex items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 font-mono text-xs text-on-surface-variant">
            <span className="blip h-1.5 w-1.5 rounded-full bg-tertiary" />
            agente ativo · <HeroTicker /> · 0 nós expandidos
          </div>
        </div>
      </section>

      {/* Live demo carousel: six modules auto-cycling, right after the pitch and before any stats */}
      <div className="relative z-[1] pb-16">
        <HomeDemoCarousel />
      </div>

      {/* Stats strip */}
      <div className="stats-strip relative z-[1] border-b border-white/[0.07] bg-surface-container-lowest/70">
        <div className="mx-auto grid max-w-7xl grid-cols-1 sm:grid-cols-3">
          {STATS.map((s, i) => (
            <div
              key={s.num}
              className={`flex flex-col gap-1.5 px-8 py-8 ${i > 0 ? "border-t sm:border-l sm:border-t-0" : ""} border-white/[0.07]`}
            >
              <div className="stat-num font-mono text-[32px] font-semibold tracking-[-0.01em] text-primary">
                {s.num}
              </div>
              <div className="text-[12.5px] text-on-surface-variant">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Module cards */}
      <section className="px-6 py-24">
        <div className="mx-auto mb-10 max-w-7xl">
          <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
            Vinte e três problemas, cinco famílias de algoritmos
          </div>
          <h2 className="mb-2.5 text-[28px] font-semibold tracking-[-0.015em]">Escolha um módulo para explorar</h2>
          <p className="max-w-xl text-[14.5px] text-on-surface-variant">
            Busca clássica, algoritmos genéticos, satisfação de restrições, aprendizado por reforço
            e redes neurais — de BFS até convolução escrita à mão, cada módulo executa de verdade,
            com estatísticas reais e parâmetros ajustáveis.
          </p>
        </div>

        <div className="cards-grid mx-auto max-w-7xl">
          {MODULES.map((m) => {
            const Preview = m.preview;
            return (
              <Link key={m.href} href={m.href} className={`card ${m.accent} flex flex-col p-7`}>
                <Preview />
                <h3 className="mb-2.5 mt-5 flex items-center justify-between text-[16.5px] font-semibold">
                  {m.title}
                  <span className="arrow text-[15px] text-on-surface-variant">→</span>
                </h3>
                <p className="mb-5 flex-grow text-[13.5px] leading-relaxed text-on-surface-variant">{m.desc}</p>
                <div className="mb-5 flex flex-wrap gap-1.5">
                  {m.algos.map((a) => (
                    <span
                      key={a}
                      className="chip"
                      style={{
                        background: `color-mix(in srgb, var(--accent, var(--primary)) 14%, transparent)`,
                        color: "var(--accent, var(--primary))",
                      }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
                <div className="stat-line flex items-center gap-2 border-t border-white/[0.07] pt-4 font-mono text-xs text-on-surface-variant">
                  <span className="sq h-[5px] w-[5px] rounded-[1px]" />
                  {m.statLine}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* About */}
      <section id="sobre" className="scroll-mt-20 px-6 pb-24">
        <div className="mx-auto mb-10 max-w-7xl">
          <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
            Como funciona
          </div>
          <h2 className="text-[28px] font-semibold tracking-[-0.015em]">Sobre o projeto</h2>
        </div>

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl border border-white/[0.07] bg-surface-container p-9">
            <p className="mb-8 text-sm leading-relaxed text-on-surface-variant">
              Aplicação educacional com cinco famílias de algoritmos: busca clássica (BFS, DFS, UCS,
              Gulosa, A*), busca adversária (Minimax, Alfa-Beta, MCTS), Algoritmos Genéticos,
              satisfação de restrições e busca local, aprendizado por reforço, e redes neurais — de
              Hebb e backpropagation até convolução, tudo implementado à mão. Cada módulo expõe os
              parâmetros do problema e do algoritmo, executa com estatísticas reais e permite
              comparar resultados.
            </p>
            <div className="grid grid-cols-1 gap-7 sm:grid-cols-3 sm:gap-4">
              {FLOW.map((step, i) => (
                <div key={step.title} className="relative flex flex-col items-center text-center">
                  <span className="flow-num relative z-[1] mb-3 flex h-9 w-9 items-center justify-center rounded-lg">
                    <Icon name={step.icon} className="text-[18px]" />
                  </span>
                  {i < FLOW.length - 1 && (
                    <span className="flow-line absolute left-1/2 top-[18px] hidden h-px w-[calc(100%_+_1rem)] sm:block" />
                  )}
                  <h3 className="mb-1 text-sm font-semibold text-on-surface">{step.title}</h3>
                  <p className="text-xs leading-relaxed text-on-surface-variant">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07]">
            {ABOUT_STATS.map((s) => (
              <div
                key={s.k}
                className={`about-stat acc-${s.accent} group flex flex-col gap-3 bg-surface-container p-6 transition-colors hover:bg-surface-container-high`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[color:var(--accent)]">
                  <Icon name={s.icon} className="text-[16px]" />
                </span>
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.06em] text-on-surface-variant">{s.k}</div>
                  <div className="mini-stat mt-1 flex items-center gap-1.5 font-mono text-base font-semibold text-[color:var(--accent)]">
                    {s.live && <span className="blip h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />}
                    {s.v}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto flex max-w-7xl flex-col items-center gap-6 border-t border-white/[0.07] px-6 py-8 md:flex-row md:justify-between">
        <div className="flex flex-col items-center gap-1 md:items-start">
          <span className="text-sm font-bold text-on-surface">Agentes de Busca</span>
          <p className="text-center text-xs text-on-surface-variant md:text-left">
            Trabalho de Inteligência Artificial — busca não-informada, informada e adversária.
          </p>
        </div>
        {/* flex-wrap is load-bearing here: 15 modules in one unbroken row (the original flex gap-8,
            no wrap) forced this div past its container's width, which is what put the whole page
            into horizontal scroll - wrapping keeps every screen width self-contained instead. */}
        <div className="flex max-w-2xl flex-wrap justify-center gap-x-6 gap-y-2 md:justify-end">
          {MODULES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="text-xs font-medium text-on-surface-variant opacity-80 transition-colors hover:text-on-surface hover:opacity-100"
            >
              {m.title}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
