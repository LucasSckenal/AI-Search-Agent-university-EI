import Link from "next/link";
import { Icon } from "@/components/shared/Panel";

const MODULES = [
  {
    href: "/labirinto",
    title: "Labirinto",
    icon: "grid_view",
    accent: "primary",
    desc: "Navegação em uma grade com paredes e terreno com custo. Visualize a expansão da fronteira em tempo real e encontre o caminho ótimo.",
    algos: ["BFS", "DFS", "UCS", "Gulosa", "A*"],
  },
  {
    href: "/cubo",
    title: "Cubo Mágico 2x2",
    icon: "view_in_ar",
    accent: "tertiary",
    desc: "Resolução de um Pocket Cube embaralhado. Observe o agente encontrando a sequência mínima de movimentos num espaço de 3.674.160 estados.",
    algos: ["BFS", "UCS", "Gulosa", "A*"],
  },
  {
    href: "/jogo",
    title: "Jogo da Velha N×N",
    icon: "sports_esports",
    accent: "secondary",
    desc: "Busca adversária para jogos competitivos. Veja como o agente antecipa suas jogadas com Minimax e poda Alfa-Beta.",
    algos: ["Minimax", "Alfa-Beta"],
  },
] as const;

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-6 pb-20 pt-32">
      {/* Hero */}
      <section className="mb-28 flex flex-col items-center text-center">
        <div className="mb-8 rounded-full border border-primary/20 bg-primary/10 px-4 py-1">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            Inteligência Artificial
          </span>
        </div>
        <h1 className="mb-6 max-w-4xl bg-gradient-to-b from-white to-on-surface-variant bg-clip-text text-[40px] font-extrabold leading-tight text-transparent md:text-[56px]">
          Agentes inteligentes de busca
        </h1>
        <p className="mb-10 max-w-2xl text-base leading-relaxed text-on-surface-variant">
          Explore a lógica por trás dos algoritmos de busca clássicos através de visualizações
          interativas: configure o problema, execute o agente passo a passo e compare o
          desempenho entre busca cega, informada e adversária.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/labirinto"
            className="btn btn-primary !rounded-xl !px-7 !py-3.5 !text-sm shadow-xl shadow-primary/10"
          >
            <Icon name="play_arrow" /> Começar exploração
          </Link>
          <a href="#sobre" className="btn btn-secondary !rounded-xl !px-7 !py-3.5 !text-sm">
            Sobre o projeto
          </a>
        </div>
      </section>

      {/* Feature cards */}
      <section className="mb-28 grid grid-cols-1 gap-6 md:grid-cols-3">
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="glass glow-hover group flex h-full flex-col rounded-[10px] border border-white/5 p-8 shadow-xl transition-all"
          >
            <div
              className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg"
              style={{ background: `color-mix(in srgb, var(--${m.accent}) 14%, transparent)` }}
            >
              <Icon name={m.icon} className="text-[22px]" style={{ color: `var(--${m.accent})` }} />
            </div>
            <h3 className="mb-3 flex items-center justify-between text-lg font-semibold text-on-surface">
              {m.title}
              <span className="text-on-surface-variant transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </h3>
            <p className="mb-6 flex-grow text-sm leading-relaxed text-on-surface-variant">{m.desc}</p>
            <div className="flex flex-wrap gap-2">
              {m.algos.map((a) => (
                <span
                  key={a}
                  className="rounded px-2 py-0.5 text-[11px] font-semibold"
                  style={{
                    background: `color-mix(in srgb, var(--${m.accent}) 14%, transparent)`,
                    color: `var(--${m.accent})`,
                  }}
                >
                  {a}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </section>

      {/* About project */}
      <section id="sobre" className="glass relative scroll-mt-28 overflow-hidden rounded-[10px] border border-white/5 p-10 md:p-12">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative z-10 flex flex-col items-center gap-10 md:flex-row">
          <div className="flex-1">
            <h2 className="mb-5 text-2xl font-semibold text-on-surface">Sobre o projeto</h2>
            <p className="mb-7 text-base leading-relaxed text-on-surface-variant">
              Aplicação educacional para aplicar algoritmos clássicos de busca (BFS, DFS, UCS,
              Gulosa, A*, Minimax e Alfa-Beta) na resolução de três problemas computacionais.
              Cada módulo expõe os parâmetros do problema e do algoritmo, executa a busca com
              estatísticas reais (nós expandidos, custo, tempo) e permite comparar algoritmos na
              mesma instância.
            </p>
            <div className="flex gap-8">
              <div className="flex flex-col">
                <span className="text-[11px] uppercase tracking-wide text-outline">Versão</span>
                <span className="font-mono text-sm text-primary">v0.1.0</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] uppercase tracking-wide text-outline">Execução</span>
                <span className="flex items-center gap-2 font-mono text-sm text-tertiary">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-tertiary" />
                  100% local, sem servidor
                </span>
              </div>
            </div>
          </div>
          <div className="flex h-48 w-full flex-shrink-0 flex-col items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container md:w-80">
            <div className="mb-2 font-mono text-2xl text-primary">3.674.160</div>
            <div className="text-center text-[11px] uppercase tracking-wider text-on-surface-variant">
              estados do cubo 2x2
              <br />
              verificados por BFS exaustiva
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto mt-8 flex max-w-7xl flex-col items-center gap-6 rounded-xl border border-outline-variant/10 bg-surface-container-low/60 p-8 md:flex-row md:justify-between">
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
    </main>
  );
}
