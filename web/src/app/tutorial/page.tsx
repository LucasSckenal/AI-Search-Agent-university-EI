import Link from "next/link";
import { FrontierShader } from "@/components/home/FrontierShader";
import { MazePreview, CubePreview, TttPreview } from "@/components/home/ModulePreviews";
import { TutorialScroller, Reveal } from "@/components/tutorial/TutorialScroller";
import { WaveGrid, PathGrid, MinimaxTree, TutorialMazeHero } from "@/components/tutorial/TutorialVisuals";

export const metadata = {
  title: "Tutorial — Agentes de Busca",
};

export default function TutorialPage() {
  return (
    <TutorialScroller>
      {/* 1. Cover */}
      <>
        <div className="tut-hero-backdrop">
          <FrontierShader />
        </div>
        <div className="tut-hero-fade" />
        <div className="tut-hero-content">
          <Reveal className="tut-kicker">Agentes de Busca</Reveal>
          <Reveal delay={1}>
            <h1 className="tut-h1">Cada algoritmo pensa diferente.</h1>
          </Reveal>
          <Reveal delay={2} className="tut-sub">
            Veja como a escolha do algoritmo muda o jeito que o agente busca a resposta — antes de
            você explorar por conta própria.
          </Reveal>
        </div>
        <Reveal delay={3} className="tut-scrolldown">
          Rolar
          <span className="chevron" />
        </Reveal>
      </>

      {/* 2. The three modules */}
      <>
        <Reveal className="tut-kicker">Três problemas</Reveal>
        <Reveal delay={1}>
          <h1 className="tut-h1">O mesmo agente, três desafios.</h1>
        </Reveal>
        <Reveal delay={2} className="tut-sub">
          Labirinto, Cubo Mágico e Jogo da Velha testam formas diferentes de busca.
        </Reveal>
        <Reveal delay={3} className="tut-trio">
          <div className="tut-trio-item">
            <MazePreview />
            <span className="tut-trio-name text-primary">Labirinto</span>
          </div>
          <div className="tut-trio-item">
            <CubePreview />
            <span className="tut-trio-name text-tertiary">Cubo Mágico</span>
          </div>
          <div className="tut-trio-item">
            <TttPreview />
            <span className="tut-trio-name text-secondary">Jogo da Velha</span>
          </div>
        </Reveal>
      </>

      {/* 3. Blind search: BFS vs DFS */}
      <>
        <Reveal className="tut-kicker">Busca cega</Reveal>
        <Reveal delay={1}>
          <h1 className="tut-h1">Sem saber onde é o objetivo, o agente explora tudo.</h1>
        </Reveal>
        <Reveal delay={2} className="tut-sub">
          BFS avança em ondas iguais em todas as direções. DFS mergulha fundo por um caminho antes
          de voltar.
        </Reveal>
        <Reveal delay={3} className="tut-dual-grids">
          <div className="tut-grid-demo acc-primary">
            <div className="tut-glabel">BFS</div>
            <WaveGrid variant="bfs" stepMs={260} />
          </div>
          <div className="tut-grid-demo acc-secondary">
            <div className="tut-glabel">DFS</div>
            <WaveGrid variant="dfs" stepMs={110} />
          </div>
        </Reveal>
      </>

      {/* 4. Informed search */}
      <>
        <Reveal className="tut-kicker">Busca informada</Reveal>
        <Reveal delay={1}>
          <h1 className="tut-h1">Uma heurística aponta o caminho.</h1>
        </Reveal>
        <Reveal delay={2} className="tut-sub">
          Gulosa e A* usam uma estimativa de distância até o objetivo para gastar muito menos
          esforço.
        </Reveal>
        <Reveal delay={3} className="tut-dual-grids">
          <div className="tut-grid-demo acc-primary">
            <div className="tut-glabel">A*</div>
            <PathGrid />
            <div className="tut-gcount">7 de 24 células exploradas</div>
          </div>
        </Reveal>
      </>

      {/* 5. Live: A* on the maze */}
      <>
        <Reveal className="tut-kicker">Em tempo real</Reveal>
        <Reveal delay={1}>
          <h1 className="tut-h1">A* garante o caminho ótimo, gastando o mínimo possível.</h1>
        </Reveal>
        <Reveal delay={2} className="tut-sub">
          Cada busca explora, descarta becos sem saída e converge no caminho ótimo — e você vê
          tudo acontecer.
        </Reveal>
        <Reveal delay={3}>
          <TutorialMazeHero />
        </Reveal>
      </>

      {/* 6. Adversarial search */}
      <>
        <Reveal className="tut-kicker">Contra um oponente</Reveal>
        <Reveal delay={1}>
          <h1 className="tut-h1">O agente também pensa nas suas jogadas.</h1>
        </Reveal>
        <Reveal delay={2} className="tut-sub">
          Minimax simula o futuro; a poda Alfa-Beta ignora ramos que não podem mudar o resultado.
        </Reveal>
        <Reveal delay={3}>
          <MinimaxTree />
        </Reveal>
      </>

      {/* 7. Compare */}
      <>
        <Reveal className="tut-kicker">Compare</Reveal>
        <Reveal delay={1}>
          <h1 className="tut-h1">Compare algoritmos, não só respostas.</h1>
        </Reveal>
        <Reveal delay={2} className="tut-sub">
          Nós expandidos, custo e tempo — números reais para cada execução.
        </Reveal>
        <Reveal delay={3} className="tut-metrics">
          <div className="tut-metric acc-primary">
            <div className="tut-metric-num">84</div>
            <div className="tut-metric-lbl">nós expandidos</div>
          </div>
          <div className="tut-metric acc-secondary">
            <div className="tut-metric-num">12.4</div>
            <div className="tut-metric-lbl">custo do caminho</div>
          </div>
          <div className="tut-metric acc-tertiary">
            <div className="tut-metric-num">3ms</div>
            <div className="tut-metric-lbl">tempo de execução</div>
          </div>
        </Reveal>
      </>

      {/* 8. CTA */}
      <>
        <Reveal className="tut-kicker">Pronto</Reveal>
        <Reveal delay={1}>
          <h1 className="tut-h1">Agora é sua vez.</h1>
        </Reveal>
        <Reveal delay={2} className="tut-sub">
          Escolha um problema e veja o agente pensar, do jeito que você quiser.
        </Reveal>
        <Reveal delay={3}>
          <Link href="/labirinto" className="btn btn-primary btn-hero-glow !mt-10 !rounded-xl !px-7 !py-4 !text-[15px]">
            Começar exploração →
          </Link>
        </Reveal>
      </>
    </TutorialScroller>
  );
}
