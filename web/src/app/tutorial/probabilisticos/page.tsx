"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/shared/Panel";
import { Toggle } from "@/components/shared/Toggle";
import { LessonStepper, TopStage } from "@/components/tutorial/LessonStepper";
import { CmPresetPicker } from "@/components/tutorial/cm/CmPresetPicker";
import { CmDatasheet } from "@/components/tutorial/cm/CmDatasheet";
import { CmBreakdown } from "@/components/tutorial/cm/CmBreakdown";
import { CmPredictionPanel } from "@/components/tutorial/cm/CmPredictionPanel";
import { RealSimulationStage } from "@/components/tutorial/cm/RealSimulationStage";
import { CmStepInspector } from "@/components/tutorial/cm/CmStepInspector";
import { CmComparisonPanel } from "@/components/tutorial/cm/CmComparisonPanel";
import { CmChallengeStage } from "@/components/tutorial/cm/CmChallengeStage";
import { CmConclusionPanel } from "@/components/tutorial/cm/CmConclusionPanel";
import { MinesweeperStep } from "@/lib/campo-minado/model";
import { CM_PRESETS, openingFor } from "@/lib/tutorial/cm-presets";
import { runCmComparison } from "@/lib/tutorial/cm-run";
import { CmOutcomeGuess, actionLabel } from "@/lib/tutorial/cm-explain";

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

export default function ProbabilisticosTutorialPage() {
  const [presetId, setPresetId] = useState<string | null>(null);
  const [topStage, setTopStage] = useState<TopStage>("conceito");
  const [subBeat, setSubBeat] = useState(0);
  const [visited, setVisited] = useState<Set<TopStage>>(new Set(["conceito"]));

  const [useProbability, setUseProbability] = useState(true);
  const [predictionSelected, setPredictionSelected] = useState<CmOutcomeGuess | null>(null);
  const [predictionRevealed, setPredictionRevealed] = useState(false);
  const [simSteps, setSimSteps] = useState<MinesweeperStep[] | null>(null);

  const chosen = CM_PRESETS.find((p) => p.id === presetId) ?? null;

  // The real logica/probabilidade runs for the prediction step - same opening step 05 will run,
  // computed once here so the prediction reveal has real numbers before the user presses Executar.
  const predictionRun = useMemo(() => {
    if (!chosen) return null;
    const opening = openingFor(chosen);
    return runCmComparison(opening.instance, opening.revealed, opening.flagged);
  }, [chosen]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new board needs a fresh prediction and simulation, not a sync with external state
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

  const simFinal = simSteps ? simSteps[simSteps.length - 1] : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Tutorial</span>
            <span>/</span>
            <span className="accent">Probabilísticos</span>
          </div>
          <h1 className="content-title">Laboratório: Inferência Probabilística</h1>
          <p className="content-sub">
            Preveja o que acontece quando a dedução lógica trava, execute a inferência probabilística real no Campo Minado, e entenda por que cada
            célula recebeu a probabilidade que recebeu - tudo com números de uma execução de verdade, nunca inventados.
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
                Aqui o problema não tem uma resposta garantida: no Campo Minado, a dedução lógica só age quando tem certeza absoluta - e às vezes
                trava, sem nenhuma célula provadamente segura ou minada. É nesse ponto que a inferência probabilística entra: em vez de travar, ela
                calcula a chance EXATA de cada célula oculta ser uma mina, e revela a de menor risco. Às vezes essa chance é efetivamente zero - a
                lógica local só não conseguia ver isso. Às vezes é um risco real, calculado com exatidão, que pode ou não compensar.
              </p>
              <div>
                <p className="mb-2 text-[12px] font-medium text-on-surface-variant">Escolha um tabuleiro para explorar:</p>
                <CmPresetPicker presets={CM_PRESETS} value={presetId} onChange={setPresetId} />
              </div>
            </div>
          )}

          {/* 02 Conceito */}
          {current.num === "02" && chosen && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Antes de rodar, conheça a ficha técnica da inferência probabilística: o que ela garante, o que ela não garante, e quanto custa em
                tempo e memória.
              </p>
              <CmDatasheet />
            </div>
          )}

          {/* 03 Como funciona */}
          {current.num === "03" && chosen && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Isto é o que decide cada célula com certeza - e o que entra em ação quando essa certeza acaba:
              </p>
              <Toggle checked={useProbability} onChange={setUseProbability} label="Inferência probabilística" />
              <CmBreakdown useProbability={useProbability} />
            </div>
          )}

          {/* 04 Previsão */}
          {current.num === "04" && chosen && predictionRun && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Em &ldquo;{chosen.label}&rdquo;, a dedução lógica vai travar em algum ponto. Quando isso acontecer, o que você acha que vai
                acontecer com o melhor palpite calculado pela inferência probabilística?
              </p>
              <CmPredictionPanel
                probSteps={predictionRun.probabilidade}
                logicaSteps={predictionRun.logica}
                selectedId={predictionSelected}
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
                <p className="text-[12px] text-on-surface-variant">Veja o tabuleiro real sendo deduzido passo a passo.</p>
                <Toggle checked={useProbability} onChange={setUseProbability} label="Inferência probabilística" />
              </div>
              <RealSimulationStage preset={chosen} useProbability={useProbability} onResult={setSimSteps} />
              {simFinal && (
                <p className="text-[11.5px] text-on-surface-variant">
                  Execução real: {simFinal.cellsRevealed} células reveladas - {actionLabel(simFinal.action).toLowerCase()}.
                </p>
              )}
            </div>
          )}

          {/* 06 Explicação da decisão */}
          {current.num === "06" && <CmStepInspector steps={simSteps} />}

          {/* 07 Comparação */}
          {current.num === "07" && chosen && <CmComparisonPanel preset={chosen} />}

          {/* 08 Desafio */}
          {current.num === "08" && <CmChallengeStage />}

          {/* 09 Conclusão */}
          {current.num === "09" && chosen && <CmConclusionPanel chosenId={chosen.id} onChooseAnother={onChooseAnother} />}
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
