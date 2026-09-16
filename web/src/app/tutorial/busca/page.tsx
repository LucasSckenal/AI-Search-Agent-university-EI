"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/shared/Panel";
import { LessonStepper, TopStage } from "@/components/tutorial/LessonStepper";
import { AlgorithmPicker } from "@/components/tutorial/AlgorithmPicker";
import { MiniGrid2D } from "@/components/tutorial/MiniGrid2D";
import { FormulaBreakdown } from "@/components/tutorial/FormulaBreakdown";
import { PredictionPanel, PredictionCandidate } from "@/components/tutorial/PredictionPanel";
import { RealSimulationStage } from "@/components/tutorial/RealSimulationStage";
import { DecisionTimeline } from "@/components/tutorial/DecisionTimeline";
import { ComparisonPanel } from "@/components/tutorial/ComparisonPanel";
import { ChallengeStage } from "@/components/tutorial/ChallengeStage";
import { TechDatasheet } from "@/components/tutorial/TechDatasheet";
import { ConclusionPanel } from "@/components/tutorial/ConclusionPanel";
import { MazeState, HeuristicId, Direction, buildMazeProblem, createEmptyMaze, generateRandomMaze } from "@/lib/maze/model";
import { search, AlgorithmId, ALGORITHM_LABELS, SearchResult } from "@/lib/core/search";
import { seededRng, randomSeed } from "@/lib/core/rng";
import { explainPathChoice } from "@/lib/tutorial/explain";

const ROWS = 11;
const COLS = 15;

interface SubStep {
  top: TopStage;
  beat: number;
  num: string;
  title: string;
}

const SUBSTEPS: SubStep[] = [
  { top: "conceito", beat: 0, num: "01", title: "Introdução" },
  { top: "conceito", beat: 1, num: "02", title: "Conceito" },
  { top: "funcionamento", beat: 0, num: "03", title: "Como funciona" },
  { top: "experimento", beat: 0, num: "04", title: "Previsão" },
  { top: "experimento", beat: 1, num: "05", title: "Simulação real" },
  { top: "analise", beat: 0, num: "06", title: "Explicação da decisão" },
  { top: "analise", beat: 1, num: "07", title: "Comparação" },
  { top: "desafio", beat: 0, num: "08", title: "Desafio" },
  { top: "desafio", beat: 1, num: "09", title: "Conclusão" },
];

// A "perfect" maze (spanning tree) has exactly one route between any two cells, which would make
// the prediction step (04) trivial - every algorithm would have to agree, since there's nothing to
// choose between. Random obstacles leave real cycles/alternate routes, so BFS/UCS/A* can genuinely
// disagree on which one to take.
function generateMaze(): MazeState {
  return generateRandomMaze(ROWS, COLS, 0.22, seededRng(randomSeed()));
}

export default function BuscaTutorialPage() {
  const [algorithm, setAlgorithm] = useState<AlgorithmId | null>(null);
  const [topStage, setTopStage] = useState<TopStage>("conceito");
  const [subBeat, setSubBeat] = useState(0);
  const [visited, setVisited] = useState<Set<TopStage>>(new Set(["conceito"]));

  // Deterministic placeholder for SSR (avoids a hydration mismatch): the mount effect below
  // immediately replaces it with a real randomly generated maze on the client, same pattern as
  // labirinto/page.tsx.
  const [maze, setMaze] = useState<MazeState>(() => createEmptyMaze(ROWS, COLS));
  const [heuristic] = useState<HeuristicId>("manhattan");
  const [allowDiagonal] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- replacing the deterministic SSR placeholder with a real maze, client-only
    setMaze(generateMaze());
  }, []);

  const [predictionSelected, setPredictionSelected] = useState<string | null>(null);
  const [predictionRevealed, setPredictionRevealed] = useState(false);
  const [simResult, setSimResult] = useState<SearchResult<number, Direction> | null>(null);

  const problem = useMemo(() => buildMazeProblem(maze, { allowDiagonal, heuristic }), [maze, allowDiagonal, heuristic]);

  const officialResult = useMemo(() => {
    if (!algorithm) return null;
    return search(problem, algorithm, { maxNodes: 300_000 });
  }, [problem, algorithm]);

  // Real candidate paths for the prediction step - a small probe set of distinct real algorithms
  // (deduped by identical path), never hand-drawn routes. See PredictionPanel's own header comment.
  const predictionCandidates = useMemo((): PredictionCandidate[] => {
    if (!algorithm) return [];
    const probes: AlgorithmId[] = Array.from(new Set<AlgorithmId>([algorithm, "bfs", "ucs", "astar"]));
    const labels = ["A", "B", "C", "D"];
    const byPath = new Map<string, PredictionCandidate>();
    let li = 0;
    for (const a of probes) {
      const r = search(problem, a, { maxNodes: 300_000 });
      if (!r.found) continue;
      const key = JSON.stringify(r.path);
      if (byPath.has(key)) continue;
      byPath.set(key, { id: key, label: `Caminho ${labels[li++]}`, path: r.path, cost: r.cost });
    }
    return Array.from(byPath.values());
  }, [problem, algorithm]);

  const correctCandidateId = officialResult?.found ? JSON.stringify(officialResult.path) : null;

  // Reset the per-run state (prediction, simulation, comparison inputs) whenever the maze or the
  // chosen algorithm changes, so nothing from a previous run leaks into the new one.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new maze/algorithm needs a fresh prediction and simulation, not a sync with external state
    setPredictionSelected(null);
    setPredictionRevealed(false);
    setSimResult(null);
  }, [maze, algorithm]);

  const goTo = (top: TopStage, beat = 0) => {
    setTopStage(top);
    setSubBeat(beat);
    setVisited((v) => new Set(v).add(top));
  };

  const currentSubIndex = SUBSTEPS.findIndex((s) => s.top === topStage && s.beat === subBeat);
  const current = SUBSTEPS[currentSubIndex];
  const beatsInStage = SUBSTEPS.filter((s) => s.top === topStage);

  const canAdvance = current.num === "01" ? algorithm !== null : current.num === "04" ? predictionRevealed : true;

  const goNext = () => {
    if (currentSubIndex < SUBSTEPS.length - 1 && canAdvance) {
      const next = SUBSTEPS[currentSubIndex + 1];
      goTo(next.top, next.beat);
    }
  };
  const goPrev = () => {
    if (currentSubIndex > 0) {
      const prev = SUBSTEPS[currentSubIndex - 1];
      goTo(prev.top, prev.beat);
    }
  };

  const regenerate = () => setMaze(generateMaze());

  const revealPrediction = () => setPredictionRevealed(true);
  const predictionFeedback =
    predictionRevealed && predictionSelected && officialResult?.found
      ? explainPathChoice(
          predictionCandidates.find((c) => c.id === predictionSelected)?.path ?? [],
          predictionCandidates.find((c) => c.id === predictionSelected)?.cost ?? 0,
          officialResult.path,
          officialResult.cost,
          algorithm!
        )
      : null;

  const onChooseAnother = (a: AlgorithmId) => {
    setAlgorithm(a);
    goTo("conceito", 1);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Tutorial</span>
            <span>/</span>
            <span className="accent">Busca em Grafo</span>
          </div>
          <h1 className="content-title">Laboratório: Busca em Grafo</h1>
          <p className="content-sub">
            Preveja, execute o algoritmo real, e entenda por que ele decidiu o que decidiu - tudo com números de uma
            execução de verdade, nunca inventados.
          </p>
        </div>
        <div className="content-actions">
          <Link href="/tutorial" className="btn-pill">
            <Icon name="arrow_back" className="text-[15px]" /> Famílias
          </Link>
          <button className="btn-pill" onClick={regenerate}>
            <Icon name="refresh" className="text-[15px]" /> Novo labirinto
          </button>
        </div>
      </div>

      <div className="workspace-card">
        <div className="workspace-head">
          <LessonStepper current={topStage} visited={visited} onSelect={(s) => goTo(s)} />
        </div>

        {beatsInStage.length > 1 && (
          <div className="flex gap-2 border-b border-outline-variant px-5 py-2.5">
            {beatsInStage.map((s) => (
              <button
                key={s.num}
                className={`workspace-link ${s.beat === subBeat ? "!bg-primary/15 !text-primary" : ""}`}
                onClick={() => goTo(s.top, s.beat)}
              >
                {s.num} {s.title}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5 sm:p-6">
          <div>
            <span className="font-mono text-[10.5px] uppercase tracking-wide text-on-surface-variant/70">
              Passo {current.num} / 09
            </span>
            <h2 className="mt-1 text-lg font-bold text-on-surface">{current.title}</h2>
          </div>

          {/* 01 Introdução */}
          {current.num === "01" && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Busca em Grafo resolve um problema simples de enunciar: começando num estado inicial, encontrar uma
                sequência de ações até um estado objetivo. Aqui, o problema é um labirinto - início (lavanda), objetivo
                (laranja), paredes intransponíveis e lama que custa 5× mais para atravessar do que uma célula vazia.
                Cinco algoritmos diferentes resolvem exatamente o mesmo labirinto, mas cada um decide qual célula
                expandir a seguir de um jeito diferente - e isso muda tanto o caminho encontrado quanto o esforço gasto.
              </p>
              <MiniGrid2D maze={maze} cellPx={Math.max(10, Math.min(22, 620 / maze.cols))} />
              <div>
                <p className="mb-2 text-[12px] font-medium text-on-surface-variant">Escolha um algoritmo para explorar:</p>
                <AlgorithmPicker value={algorithm} onChange={setAlgorithm} />
              </div>
            </div>
          )}

          {/* 02 Conceito */}
          {current.num === "02" && algorithm && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Antes de rodar, conheça a ficha técnica do {ALGORITHM_LABELS[algorithm]}: o que ele garante, o que ele
                não garante, e quanto custa em tempo e memória.
              </p>
              <TechDatasheet algorithm={algorithm} />
            </div>
          )}

          {/* 03 Como funciona */}
          {current.num === "03" && algorithm && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Isto é o que realmente decide qual célula o {ALGORITHM_LABELS[algorithm]} expande a seguir, a cada
                passo da busca:
              </p>
              <FormulaBreakdown algorithm={algorithm} />
            </div>
          )}

          {/* 04 Previsão */}
          {current.num === "04" && algorithm && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Estes caminhos são reais - cada um é o resultado de rodar um algoritmo de verdade neste labirinto. Antes
                de executar o {ALGORITHM_LABELS[algorithm]} de fato, qual você acha que ele vai escolher?
              </p>
              <PredictionPanel
                maze={maze}
                candidates={predictionCandidates}
                selectedId={predictionSelected}
                onSelect={setPredictionSelected}
                revealed={predictionRevealed}
                correctId={correctCandidateId}
              />
              {!predictionRevealed ? (
                <button className="btn-pill btn-pill-primary w-fit" onClick={revealPrediction} disabled={!predictionSelected}>
                  Revelar previsão
                </button>
              ) : (
                predictionFeedback && (
                  <div className="glass rounded-2xl p-4 text-[13px] leading-relaxed text-on-surface">{predictionFeedback.message}</div>
                )
              )}
            </div>
          )}

          {/* 05 Simulação real */}
          {current.num === "05" && algorithm && (
            <div className="flex flex-col gap-3">
              <RealSimulationStage maze={maze} algorithm={algorithm} heuristic={heuristic} allowDiagonal={allowDiagonal} onResult={setSimResult} />
              {simResult && (
                <p className="text-[11.5px] text-on-surface-variant">
                  Execução real: {simResult.found ? `caminho de custo ${simResult.cost.toFixed(2)}` : "sem solução"}, {simResult.nodesExpanded} nós
                  expandidos, {simResult.timeMs.toFixed(2)}ms.
                </p>
              )}
            </div>
          )}

          {/* 06 Explicação da decisão */}
          {current.num === "06" && algorithm && (
            <DecisionTimeline maze={maze} algorithm={algorithm} heuristic={heuristic} allowDiagonal={allowDiagonal} />
          )}

          {/* 07 Comparação */}
          {current.num === "07" && algorithm && (
            <ComparisonPanel maze={maze} heuristic={heuristic} allowDiagonal={allowDiagonal} chosen={algorithm} />
          )}

          {/* 08 Desafio */}
          {current.num === "08" && <ChallengeStage />}

          {/* 09 Conclusão */}
          {current.num === "09" && algorithm && <ConclusionPanel algorithm={algorithm} onChooseAnother={onChooseAnother} />}
        </div>

        <div className="flex items-center justify-between border-t border-outline-variant px-5 py-3.5 sm:px-6">
          <button className="btn-pill" onClick={goPrev} disabled={currentSubIndex === 0}>
            <Icon name="arrow_back" className="text-[14px]" /> Anterior
          </button>
          <button className="btn-pill btn-pill-primary" onClick={goNext} disabled={currentSubIndex === SUBSTEPS.length - 1 || !canAdvance}>
            Próximo <Icon name="arrow_forward" className="text-[14px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
