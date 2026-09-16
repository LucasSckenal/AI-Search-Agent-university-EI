"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/shared/Panel";
import { Toggle } from "@/components/shared/Toggle";
import { LessonStepper, TopStage } from "@/components/tutorial/LessonStepper";
import { PositionPicker } from "@/components/tutorial/am/PositionPicker";
import { MinimaxBreakdown } from "@/components/tutorial/am/MinimaxBreakdown";
import { AmPredictionPanel } from "@/components/tutorial/am/AmPredictionPanel";
import { RealSimulationStage } from "@/components/tutorial/am/RealSimulationStage";
import { PlyTimeline } from "@/components/tutorial/am/PlyTimeline";
import { AmComparisonPanel } from "@/components/tutorial/am/AmComparisonPanel";
import { AmChallengeStage } from "@/components/tutorial/am/AmChallengeStage";
import { AmDatasheet } from "@/components/tutorial/am/AmDatasheet";
import { AmConclusionPanel } from "@/components/tutorial/am/AmConclusionPanel";
import { minimax } from "@/lib/game/model";
import { AM_GAME_CONFIG, AM_PRESETS } from "@/lib/tutorial/am-presets";
import { MinimaxTrace } from "@/lib/tutorial/am-trace-run";

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

export default function AdversarialTutorialPage() {
  const [presetId, setPresetId] = useState<string | null>(null);
  const [topStage, setTopStage] = useState<TopStage>("conceito");
  const [subBeat, setSubBeat] = useState(0);
  const [visited, setVisited] = useState<Set<TopStage>>(new Set(["conceito"]));

  const [useAlphaBeta, setUseAlphaBeta] = useState(true);
  const [predictionSelected, setPredictionSelected] = useState<number | null>(null);
  const [predictionRevealed, setPredictionRevealed] = useState(false);
  const [simTrace, setSimTrace] = useState<MinimaxTrace | null>(null);

  const chosen = AM_PRESETS.find((p) => p.id === presetId) ?? null;

  // Real best move/score for the prediction step - a single cheap minimax() call (aggregate result
  // only, no per-node trace needed here).
  const predictionResult = useMemo(() => (chosen ? minimax(chosen.board, chosen.player, AM_GAME_CONFIG, true) : null), [chosen]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new position needs a fresh prediction and simulation, not a sync with external state
    setPredictionSelected(null);
    setPredictionRevealed(false);
    setSimTrace(null);
  }, [presetId]);

  const goTo = (top: TopStage, beat = 0) => {
    setTopStage(top);
    setSubBeat(beat);
    setVisited((v) => new Set(v).add(top));
  };

  const currentSubIndex = SUBSTEPS.findIndex((s) => s.top === topStage && s.beat === subBeat);
  const current = SUBSTEPS[currentSubIndex];
  const beatsInStage = SUBSTEPS.filter((s) => s.top === topStage);

  const canAdvance = current.num === "01" ? chosen !== null : current.num === "04" ? predictionRevealed : true;

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

  const revealPrediction = () => setPredictionRevealed(true);

  const onChooseAnother = (id: string) => {
    setPresetId(id);
    goTo("conceito", 1);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Tutorial</span>
            <span>/</span>
            <span className="accent">Busca Adversarial</span>
          </div>
          <h1 className="content-title">Laboratório: Minimax e Poda Alfa-Beta</h1>
          <p className="content-sub">
            Preveja a jogada, execute a busca real na árvore do jogo, e entenda por que MAX e MIN decidiram o que decidiram - tudo com números de
            uma execução de verdade, nunca inventados.
          </p>
        </div>
        <div className="content-actions">
          <Link href="/tutorial" className="btn-pill">
            <Icon name="arrow_back" className="text-[15px]" /> Famílias
          </Link>
        </div>
      </div>

      <div className="workspace-card">
        <div className="workspace-head">
          <LessonStepper current={topStage} visited={visited} onSelect={(s) => goTo(s)} />
        </div>

        {beatsInStage.length > 1 && (
          <div className="flex gap-2 border-b border-outline-variant px-5 py-2.5">
            {beatsInStage.map((s) => (
              <button key={s.num} className={`workspace-link ${s.beat === subBeat ? "!bg-primary/15 !text-primary" : ""}`} onClick={() => goTo(s.top, s.beat)}>
                {s.num} {s.title}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5 sm:p-6">
          <div>
            <span className="font-mono text-[10.5px] uppercase tracking-wide text-on-surface-variant/70">Passo {current.num} / 09</span>
            <h2 className="mt-1 text-lg font-bold text-on-surface">{current.title}</h2>
          </div>

          {/* 01 Introdução */}
          {current.num === "01" && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Aqui o problema não é achar um caminho nem otimizar uma população - é decidir contra um adversário que também está pensando. No jogo
                da velha, a cada nó da árvore, o jogador MAX (X) escolhe o filho de maior valor e o jogador MIN (O) escolhe o de menor valor. Os
                valores só existem nas folhas - vitória, derrota ou empate - e sobem pela árvore, um nível de cada vez, até a raiz decidir a melhor
                jogada.
              </p>
              <div>
                <p className="mb-2 text-[12px] font-medium text-on-surface-variant">Escolha uma posição de jogo da velha para explorar:</p>
                <PositionPicker presets={AM_PRESETS} value={presetId} onChange={setPresetId} />
              </div>
            </div>
          )}

          {/* 02 Conceito */}
          {current.num === "02" && chosen && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Antes de rodar, conheça a ficha técnica do Minimax: o que ele garante, o que ele não garante, e quanto custa em tempo e memória.
              </p>
              <AmDatasheet />
            </div>
          )}

          {/* 03 Como funciona */}
          {current.num === "03" && chosen && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Isto é o que decide, nó a nó, qual jogada vence - e como a poda Alfa-Beta evita visitar ramos que já não podem mudar o resultado:
              </p>
              <Toggle checked={useAlphaBeta} onChange={setUseAlphaBeta} label="Poda Alfa-Beta" />
              <MinimaxBreakdown useAlphaBeta={useAlphaBeta} />
            </div>
          )}

          {/* 04 Previsão */}
          {current.num === "04" && chosen && predictionResult && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Esta é a posição real da configuração &ldquo;{chosen.label}&rdquo;. Antes de ver o resultado, em qual casa você acha que o minimax
                vai jogar?
              </p>
              <AmPredictionPanel
                board={chosen.board}
                player={chosen.player}
                best={predictionResult}
                selectedMove={predictionSelected}
                onSelect={setPredictionSelected}
                revealed={predictionRevealed}
              />
              {!predictionRevealed && (
                <button className="btn-pill btn-pill-primary w-fit" onClick={revealPrediction} disabled={predictionSelected === null}>
                  Revelar previsão
                </button>
              )}
            </div>
          )}

          {/* 05 Simulação real */}
          {current.num === "05" && chosen && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-on-surface-variant">Veja a árvore real crescer nó a nó, até a raiz decidir a melhor jogada.</p>
                <Toggle checked={useAlphaBeta} onChange={setUseAlphaBeta} label="Poda Alfa-Beta" />
              </div>
              <RealSimulationStage preset={chosen} useAlphaBeta={useAlphaBeta} onResult={setSimTrace} />
              {simTrace && (
                <p className="text-[11.5px] text-on-surface-variant">
                  Execução real: jogada {simTrace.result.move} (valor {simTrace.result.score}), {simTrace.result.nodesExplored} nós explorados
                  {simTrace.result.prunedCount > 0 ? `, ${simTrace.result.prunedCount} podados` : ""}.
                </p>
              )}
            </div>
          )}

          {/* 06 Explicação da decisão */}
          {current.num === "06" && <PlyTimeline trace={simTrace} />}

          {/* 07 Comparação */}
          {current.num === "07" && chosen && <AmComparisonPanel preset={chosen} />}

          {/* 08 Desafio */}
          {current.num === "08" && <AmChallengeStage />}

          {/* 09 Conclusão */}
          {current.num === "09" && chosen && <AmConclusionPanel chosenId={chosen.id} onChooseAnother={onChooseAnother} />}
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
