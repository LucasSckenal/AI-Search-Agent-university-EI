import Link from "next/link";
import { Icon } from "@/components/shared/Panel";
import { FrontierShader } from "@/components/home/FrontierShader";
import { HeroTicker } from "@/components/home/HeroTicker";
import { MazePreview, CubePreview, TttPreview } from "@/components/home/ModulePreviews";

const MODULES = [
  {
    href: "/labirinto",
    title: "Labirinto",
    accent: "maze",
    preview: MazePreview,
    desc: "Navegação em uma grade com paredes e terreno com custo. Visualize a expansão da fronteira em tempo real e encontre o caminho ótimo.",
    algos: ["BFS", "DFS", "UCS", "Gulosa", "A*"],
    statLine: "5 algoritmos · grid até 35×45",
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
] as const;

const STATS = [
  { num: "7", label: "Algoritmos implementados — BFS, DFS, UCS, Gulosa, A*, Minimax, Alfa-Beta" },
  { num: "3.674.160", label: "Estados possíveis do Cubo Mágico 2×2, verificados por BFS exaustiva" },
  { num: "100%", label: "Execução local no navegador — nenhuma chamada a servidor" },
] as const;

const FLOW = [
  { icon: "tune", title: "Configurar", desc: "Escolha o problema, o tamanho e o algoritmo de busca." },
  { icon: "play_arrow", title: "Executar", desc: "Veja o agente expandir nós passo a passo, em tempo real." },
  { icon: "compare_arrows", title: "Comparar", desc: "Confronte custo, nós expandidos e tempo entre algoritmos." },
] as const;

const ABOUT_STATS = [
  { k: "Problemas", v: "3", live: false },
  { k: "Algoritmos", v: "7", live: false },
  { k: "Estados do cubo", v: "3.674.160", live: false },
  { k: "Execução", v: "100% local", live: true },
] as const;

export default function Home() {
  return (
    <div className="h-full overflow-y-auto">
      {/* Hero: full-bleed WebGL "search frontier" backdrop behind the pitch */}
      <section className="relative flex min-h-[92vh] items-center overflow-hidden px-6 pb-24 pt-24">
        <div className="hero-backdrop absolute inset-0 z-0 pointer-events-none">
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
            Três problemas, um motor de busca
          </div>
          <h2 className="mb-2.5 text-[28px] font-semibold tracking-[-0.015em]">Escolha um módulo para explorar</h2>
          <p className="max-w-xl text-[14.5px] text-on-surface-variant">
            Cada problema expõe os parâmetros do agente e do algoritmo, executa a busca com
            estatísticas reais e permite comparar algoritmos na mesma instância.
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
              Aplicação educacional para aplicar algoritmos clássicos de busca (BFS, DFS, UCS,
              Gulosa, A*, Minimax e Alfa-Beta) na resolução de três problemas computacionais. Cada
              módulo expõe os parâmetros do problema e do algoritmo, executa a busca com
              estatísticas reais e permite comparar algoritmos na mesma instância.
            </p>
            <div className="grid grid-cols-1 gap-7 sm:grid-cols-3 sm:gap-4">
              {FLOW.map((step) => (
                <div key={step.title} className="flex flex-col items-center text-center">
                  <span className="flow-num mb-3 flex h-9 w-9 items-center justify-center rounded-lg">
                    <Icon name={step.icon} className="text-[18px]" />
                  </span>
                  <h3 className="mb-1 text-sm font-semibold text-on-surface">{step.title}</h3>
                  <p className="text-xs leading-relaxed text-on-surface-variant">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07]">
            {ABOUT_STATS.map((s) => (
              <div key={s.k} className="flex flex-col gap-1.5 bg-surface-container p-6">
                <span className="text-[10.5px] uppercase tracking-[0.06em] text-on-surface-variant">{s.k}</span>
                <span className="mini-stat flex items-center gap-1.5 font-mono text-sm text-primary">
                  {s.live && <span className="blip h-1.5 w-1.5 rounded-full bg-secondary" />}
                  <span className={s.live ? "text-secondary" : undefined}>{s.v}</span>
                </span>
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
        <div className="flex gap-8">
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
