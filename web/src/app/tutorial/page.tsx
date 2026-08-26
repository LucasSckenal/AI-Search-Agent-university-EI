import Link from "next/link";
import { FrontierShader } from "@/components/home/FrontierShader";
import { MazePreview, CubePreview, TttPreview, GoosePreview, TspPreview, QueensPreview, RLPreview } from "@/components/home/ModulePreviews";
import { TutorialScroller, Reveal } from "@/components/tutorial/TutorialScroller";
import {
  WaveGrid,
  PathGrid,
  MinimaxTree,
  TutorialMazeHero,
  GenerationBars,
  QueensPruneGrid,
  TutorialRLHero,
} from "@/components/tutorial/TutorialVisuals";

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

      {/* 2. The seven modules */}
      <>
        <Reveal className="tut-kicker">Sete problemas</Reveal>
        <Reveal delay={1}>
          <h1 className="tut-h1">Três famílias de algoritmos, sete desafios.</h1>
        </Reveal>
        <Reveal delay={2} className="tut-sub">
          Busca clássica, evolução genética e aprendizado por reforço — cada família pensa de um
          jeito diferente diante do mesmo tipo de problema.
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
          <div className="tut-trio-item">
            <GoosePreview />
            <span className="tut-trio-name" style={{ color: "#7ee0a8" }}>Goose</span>
          </div>
          <div className="tut-trio-item">
            <TspPreview />
            <span className="tut-trio-name" style={{ color: "#6fd8c9" }}>Caixeiro Viajante</span>
          </div>
          <div className="tut-trio-item">
            <QueensPreview />
            <span className="tut-trio-name" style={{ color: "#d9a441" }}>N-Rainhas</span>
          </div>
          <div className="tut-trio-item">
            <RLPreview />
            <span className="tut-trio-name" style={{ color: "#7ea8f5" }}>Aprendizado por Reforço</span>
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

      {/* 7. Genetic optimization */}
      <>
        <Reveal className="tut-kicker">Otimização por evolução</Reveal>
        <Reveal delay={1}>
          <h1 className="tut-h1">Sem regra alguma, só sobrevivência do mais apto.</h1>
        </Reveal>
        <Reveal delay={2} className="tut-sub">
          Um Algoritmo Genético evolui uma população de soluções por seleção, cruzamento e mutação —
          o mesmo motor reaproveitado no Labirinto, no Goose, no Caixeiro Viajante e nas N-Rainhas.
        </Reveal>
        <Reveal delay={3} className="tut-dual-grids">
          <div className="tut-grid-demo">
            <div className="tut-glabel" style={{ color: "#7ee0a8" }}>
              Geração 0
            </div>
            <GenerationBars variant="start" />
          </div>
          <div className="tut-grid-demo">
            <div className="tut-glabel" style={{ color: "#7ee0a8" }}>
              Geração 40
            </div>
            <GenerationBars variant="converged" />
          </div>
        </Reveal>
      </>

      {/* 8. Constraint satisfaction */}
      <>
        <Reveal className="tut-kicker">Restrições e poda</Reveal>
        <Reveal delay={1}>
          <h1 className="tut-h1">Prever um conflito é mais barato do que descobri-lo depois.</h1>
        </Reveal>
        <Reveal delay={2} className="tut-sub">
          Nas N-Rainhas, Forward Checking elimina candidatos inválidos assim que uma rainha é
          colocada, em vez de só descobrir o conflito ao tentar cada um.
        </Reveal>
        <Reveal delay={3} className="tut-dual-grids">
          <div className="tut-grid-demo acc-secondary">
            <div className="tut-glabel">Backtracking</div>
            <QueensPruneGrid variant="backtracking" />
            <div className="tut-gcount">20 células exploradas</div>
          </div>
          <div className="tut-grid-demo acc-primary">
            <div className="tut-glabel">Forward Checking</div>
            <QueensPruneGrid variant="forwardchecking" />
            <div className="tut-gcount">5 exploradas, 9 podadas sem visitar</div>
          </div>
        </Reveal>
      </>

      {/* 9. Reinforcement learning */}
      <>
        <Reveal className="tut-kicker">Tentativa e erro</Reveal>
        <Reveal delay={1}>
          <h1 className="tut-h1">Ninguém entrega o mapa — o agente aprende andando.</h1>
        </Reveal>
        <Reveal delay={2} className="tut-sub">
          Q-learning não conhece as recompensas nem as transições de antemão: aprende só observando
          o que aconteceu depois de cada tentativa, até o caminho até o objetivo ficar claro.
        </Reveal>
        <Reveal delay={3}>
          <TutorialRLHero />
        </Reveal>
      </>

      {/* 10. Compare */}
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

      {/* 11. CTA */}
      <>
        <Reveal className="tut-kicker">Pronto</Reveal>
        <Reveal delay={1}>
          <h1 className="tut-h1">Agora é sua vez.</h1>
        </Reveal>
        <Reveal delay={2} className="tut-sub">
          Sete problemas, três famílias de algoritmos — escolha um e veja o agente pensar, do jeito
          que você quiser.
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
