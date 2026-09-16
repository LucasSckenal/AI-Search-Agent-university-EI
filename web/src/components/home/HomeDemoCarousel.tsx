"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Icon } from "@/components/shared/Panel";
import {
  MazePreview,
  MinimaxPreview,
  AlgoritmoGeneticoPreview,
  RLPreview,
  PenduloPreview,
  GatosCachorrosPreview,
} from "@/components/home/ModulePreviews";

/**
 * Six modules picked for spread across the site's families (busca clássica, busca adversária,
 * Algoritmo Genético, aprendizado por reforço, controle contínuo, redes neurais/convolução), each
 * reusing its existing card-preview animation - no new simulation logic, just the same always-looping
 * SVG shown much bigger with a title/description/link wrapped around it.
 */
const SLIDES = [
  {
    href: "/labirinto",
    title: "Labirinto",
    accent: "maze",
    desc: "A* expande a fronteira nó a nó, num grid com paredes e terreno com custo, até encontrar o caminho ótimo.",
    Preview: MazePreview,
  },
  {
    href: "/minimax",
    title: "Minimax",
    accent: "minimax",
    desc: "A árvore de um fim de jogo cresce nó a nó, valores subindo das folhas até a raiz, com poda Alfa-Beta cortando ramos inteiros.",
    Preview: MinimaxPreview,
  },
  {
    href: "/algoritmo-genetico",
    title: "Algoritmo Genético",
    accent: "algoritmo-genetico",
    desc: "Uma população inteira de soluções - não só a melhor - converge para o alvo por seleção, cruzamento e mutação.",
    Preview: AlgoritmoGeneticoPreview,
  },
  {
    href: "/aprendizado",
    title: "Aprendizado por Reforço",
    accent: "aprendizado",
    desc: "Um agente aprende por tentativa e erro a chegar ao objetivo num mundo com buracos, sem nunca conhecer o mapa.",
    Preview: RLPreview,
  },
  {
    href: "/pendulo",
    title: "Pêndulo Invertido",
    accent: "pendulo",
    desc: "Uma rede neural cujos pesos evoluíram por Algoritmo Genético equilibra o pêndulo sobre o carrinho em tempo real.",
    Preview: PenduloPreview,
  },
  {
    href: "/gatos-cachorros",
    title: "Gatos vs Cachorros",
    accent: "gatos-cachorros",
    desc: "Filtros convolucionais 3×3 aprendidos do zero, forward e backward escritos à mão, treinados com fotos reais.",
    Preview: GatosCachorrosPreview,
  },
] as const;

const INTERVAL_MS = 5000;

// Mirrors the .card.<accent> hex values in globals.css. Needed because every slide's preview stays
// mounted (see the render below) under one shared card, so each one must carry its own --accent
// rather than inheriting whichever accent the currently-active slide's modifier class sets - without
// this, an outgoing preview would flash into the incoming slide's color for the crossfade's duration.
const ACCENT_COLORS: Record<(typeof SLIDES)[number]["accent"], string> = {
  maze: "var(--primary)",
  minimax: "#ffb77b",
  "algoritmo-genetico": "#c4d94a",
  aprendizado: "#7ea8f5",
  pendulo: "#ff6bd6",
  "gatos-cachorros": "#fbbf24",
};

export function HomeDemoCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Read after mount, not from a lazy useState initializer: the server has no `window` to read
    // this from, so matching its render (false) here and correcting client-side avoids a hydration
    // mismatch on the conditionally-rendered progress bar below.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const t = setInterval(() => setActive((a) => (a + 1) % SLIDES.length), INTERVAL_MS);
    return () => clearInterval(t);
  }, [paused, reducedMotion, active]);

  const slide = SLIDES[active];

  return (
    <section className="px-6">
      <div
        className={`card ${slide.accent} demo-carousel relative mx-auto grid max-w-7xl grid-cols-1 overflow-hidden md:grid-cols-[1.4fr_1fr]`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <span className="demo-carousel-badge">
          <span className="dot" />
          AO VIVO
        </span>

        {/* Every preview mounts once and keeps looping continuously, even while hidden - only
            opacity toggles on slide change. Remounting a fresh preview per slide (e.g. a `key` tied
            to the active index) would restart its own entrance animation from an empty first frame
            each time, which for some previews (Minimax staggers node/edge reveals up to 1.75s) meant
            a visibly blank box right after every transition. */}
        <div className="demo-carousel-stage">
          {SLIDES.map((s, i) => (
            <div
              key={s.href}
              className="demo-carousel-slide"
              style={{ opacity: i === active ? 1 : 0, "--accent": ACCENT_COLORS[s.accent] } as CSSProperties}
            >
              <s.Preview />
            </div>
          ))}
        </div>

        <Link href={slide.href} className="demo-carousel-info">
          <h3>{slide.title}</h3>
          <p>{slide.desc}</p>
          <span className="btn-pill w-fit">
            Ver módulo <Icon name="arrow_forward" className="text-[15px]" />
          </span>
        </Link>

        <div className="demo-carousel-dots">
          {SLIDES.map((s, i) => (
            <button
              key={s.href}
              className={`demo-dot ${i === active ? "active" : ""}`}
              onClick={() => setActive(i)}
              aria-label={`Mostrar ${s.title}`}
              type="button"
            >
              {i === active && !paused && !reducedMotion && (
                <span key={active} className="demo-dot-progress" style={{ animationDuration: `${INTERVAL_MS}ms` }} />
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
