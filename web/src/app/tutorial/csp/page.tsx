"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/shared/Panel";
import { Toggle } from "@/components/shared/Toggle";
import { LessonStepper, TopStage } from "@/components/tutorial/LessonStepper";
import { CspPresetPicker } from "@/components/tutorial/csp/CspPresetPicker";
import { CspBreakdown } from "@/components/tutorial/csp/CspBreakdown";
import { CspPredictionPanel, CspTechniqueId } from "@/components/tutorial/csp/CspPredictionPanel";
import { RealSimulationStage } from "@/components/tutorial/csp/RealSimulationStage";
import { CspStepInspector } from "@/components/tutorial/csp/CspStepInspector";
import { CspComparisonPanel } from "@/components/tutorial/csp/CspComparisonPanel";
import { CspChallengeStage } from "@/components/tutorial/csp/CspChallengeStage";
import { CspDatasheet } from "@/components/tutorial/csp/CspDatasheet";
import { CspConclusionPanel } from "@/components/tutorial/csp/CspConclusionPanel";
import { QueensStep } from "@/lib/queens/model";
import { CSP_PRESETS } from "@/lib/tutorial/csp-presets";
import { finalStats } from "@/lib/tutorial/csp-explain";

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

export default function CspTutorialPage() {
  const [presetId, setPresetId] = useState<string | null>(null);
  const [topStage, setTopStage] = useState<TopStage>("conceito");
  const [subBeat, setSubBeat] = useState(0);
  const [visited, setVisited] = useState<Set<TopStage>>(new Set(["conceito"]));

  const [useForwardChecking, setUseForwardChecking] = useState(true);
  const [predictionSelected, setPredictionSelected] = useState<CspTechniqueId | null>(null);
  const [predictionRevealed, setPredictionRevealed] = useState(false);
  const [simSteps, setSimSteps] = useState<QueensStep[] | null>(null);

  const chosen = CSP_PRESETS.find((p) => p.id === presetId) ?? null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new board size needs a fresh prediction and simulation, not a sync with external state
    setPredictionSelected(null);
    setPredictionRevealed(false);
    setSimSteps(null);
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

  const simResult = simSteps ? finalStats(simSteps) : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Tutorial</span>
            <span>/</span>
            <span className="accent">Restrições (CSP)</span>
          </div>
          <h1 className="content-title">Laboratório: Backtracking e Forward Checking</h1>
          <p className="content-sub">
            Preveja quantos retrocessos serão precisos, execute a busca real no N-rainhas, e entenda por que cada coluna recebeu a rainha que recebeu
            - tudo com números de uma execução de verdade, nunca inventados.
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
                Aqui o problema não é achar um caminho, otimizar uma população nem prever a jogada de um adversário - é satisfazer restrições: uma
                rainha por coluna, sem que duas compartilhem linha ou diagonal. O algoritmo tenta uma linha por vez para cada coluna, e retrocede
                (desfaz a última rainha e tenta outra linha) sempre que não sobra nenhuma opção segura.
              </p>
              <div>
                <p className="mb-2 text-[12px] font-medium text-on-surface-variant">Escolha um tamanho de tabuleiro para explorar:</p>
                <CspPresetPicker presets={CSP_PRESETS} value={presetId} onChange={setPresetId} />
              </div>
            </div>
          )}

          {/* 02 Conceito */}
          {current.num === "02" && chosen && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Antes de rodar, conheça a ficha técnica do Backtracking com Forward Checking: o que ele garante, o que ele não garante, e quanto
                custa em tempo e memória.
              </p>
              <CspDatasheet />
            </div>
          )}

          {/* 03 Como funciona */}
          {current.num === "03" && chosen && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Isto é o que decide, coluna a coluna, qual linha recebe a rainha - e como o Forward Checking evita tentar linhas que já não têm
                chance de funcionar:
              </p>
              <Toggle checked={useForwardChecking} onChange={setUseForwardChecking} label="Forward Checking" />
              <CspBreakdown useForwardChecking={useForwardChecking} />
            </div>
          )}

          {/* 04 Previsão */}
          {current.num === "04" && chosen && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Para um tabuleiro de &ldquo;{chosen.label}&rdquo;, qual técnica você acha que vai precisar de menos retrocessos para encontrar uma
                solução?
              </p>
              <CspPredictionPanel n={chosen.n} selectedId={predictionSelected} onSelect={setPredictionSelected} revealed={predictionRevealed} />
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
                <p className="text-[12px] text-on-surface-variant">Veja o tabuleiro real ser preenchido coluna a coluna, com retrocessos incluídos.</p>
                <Toggle checked={useForwardChecking} onChange={setUseForwardChecking} label="Forward Checking" />
              </div>
              <RealSimulationStage n={chosen.n} useForwardChecking={useForwardChecking} onResult={setSimSteps} />
              {simResult && (
                <p className="text-[11.5px] text-on-surface-variant">
                  Execução real: {simResult.nodesExpanded} nós explorados, {simResult.backtracks} retrocessos
                  {simResult.solved ? ", solução encontrada." : "."}
                </p>
              )}
            </div>
          )}

          {/* 06 Explicação da decisão */}
          {current.num === "06" && chosen && <CspStepInspector steps={simSteps} n={chosen.n} />}

          {/* 07 Comparação */}
          {current.num === "07" && chosen && <CspComparisonPanel n={chosen.n} />}

          {/* 08 Desafio */}
          {current.num === "08" && <CspChallengeStage />}

          {/* 09 Conclusão */}
          {current.num === "09" && chosen && <CspConclusionPanel chosenId={chosen.id} onChooseAnother={onChooseAnother} />}
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
