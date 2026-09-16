"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/shared/Panel";
import { AlgoritmoGeneticoPreview } from "@/components/home/ModulePreviews";
import { LessonStepper, TopStage } from "@/components/tutorial/LessonStepper";
import { OperatorBreakdown } from "@/components/tutorial/ga/OperatorBreakdown";
import { ConfigPresetPicker } from "@/components/tutorial/ga/ConfigPresetPicker";
import { GaPredictionPanel, GaPredictionCandidate } from "@/components/tutorial/ga/GaPredictionPanel";
import { RealSimulationStage } from "@/components/tutorial/ga/RealSimulationStage";
import { GenerationTimeline } from "@/components/tutorial/ga/GenerationTimeline";
import { GaComparisonPanel } from "@/components/tutorial/ga/GaComparisonPanel";
import { GaChallengeStage } from "@/components/tutorial/ga/GaChallengeStage";
import { GaDatasheet } from "@/components/tutorial/ga/GaDatasheet";
import { GaConclusionPanel } from "@/components/tutorial/ga/GaConclusionPanel";
import { GaConfig, GaRunResult } from "@/lib/core/genetic";
import { Genome } from "@/lib/algoritmo-genetico/model";
import { GA_PRESETS, GaPreset, presetToConfig } from "@/lib/tutorial/ga-presets";
import { runGaFull } from "@/lib/tutorial/ga-run";
import { explainPredictionChoice, generationSolved, pickBestPreset } from "@/lib/tutorial/ga-explain";

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

export default function GeneticoTutorialPage() {
  const [presetId, setPresetId] = useState<string | null>(null);
  const [topStage, setTopStage] = useState<TopStage>("conceito");
  const [subBeat, setSubBeat] = useState(0);
  const [visited, setVisited] = useState<Set<TopStage>>(new Set(["conceito"]));

  const [predictionSelected, setPredictionSelected] = useState<string | null>(null);
  const [predictionRevealed, setPredictionRevealed] = useState(false);
  const [simResult, setSimResult] = useState<GaRunResult<Genome> | null>(null);

  const chosen = GA_PRESETS.find((p) => p.id === presetId) ?? null;

  // Real candidate outcomes for the prediction step - all 4 presets, actually executed. Cheap
  // enough (population <= 40, 30 generations) to compute synchronously on every render of step 04.
  const predictionCandidates = useMemo((): GaPredictionCandidate[] => GA_PRESETS.map((preset) => ({ preset, result: runGaFull(presetToConfig(preset)) })), []);
  const bestPreset = useMemo(() => pickBestPreset(predictionCandidates), [predictionCandidates]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new configuration needs a fresh prediction and simulation, not a sync with external state
    setPredictionSelected(null);
    setPredictionRevealed(false);
    setSimResult(null);
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
  const predictionFeedback =
    predictionRevealed && predictionSelected
      ? explainPredictionChoice(
          GA_PRESETS.find((p) => p.id === predictionSelected) as GaPreset,
          generationSolved(predictionCandidates.find((c) => c.preset.id === predictionSelected)!.result),
          bestPreset,
          generationSolved(predictionCandidates.find((c) => c.preset.id === bestPreset.id)!.result)
        )
      : null;

  const onChooseAnother = (id: string) => {
    setPresetId(id);
    goTo("conceito", 1);
  };

  // Memoized so RealSimulationStage (which resets its own "executed" state whenever `config`'s
  // reference changes) doesn't see a "new" config on every parent re-render - e.g. right after
  // onResult itself triggers a re-render by calling setSimResult.
  const simConfig: GaConfig | null = useMemo(() => (chosen ? presetToConfig(chosen) : null), [chosen]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Tutorial</span>
            <span>/</span>
            <span className="accent">Otimização (Algoritmo Genético)</span>
          </div>
          <h1 className="content-title">Laboratório: Algoritmo Genético</h1>
          <p className="content-sub">
            Preveja, execute a evolução real, e entenda por que a população convergiu do jeito que convergiu - tudo com números de uma execução de
            verdade, nunca inventados.
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
                Aqui o problema não é achar um caminho num grafo - é otimizar: uma população inteira de sequências de 16 movimentos parte de (0,0) tentando
                chegar perto de (6,6). Nenhum indivíduo sabe navegar; o que evolui é a população inteira, geração após geração, por seleção (os mais aptos
                reproduzem mais), cruzamento (dois percursos combinam num terceiro) e mutação (um passo aleatório muda de direção).
              </p>
              <div className="max-w-xs">
                <AlgoritmoGeneticoPreview />
              </div>
              <div>
                <p className="mb-2 text-[12px] font-medium text-on-surface-variant">Escolha uma configuração de parâmetros para explorar:</p>
                <ConfigPresetPicker presets={GA_PRESETS} value={presetId} onChange={setPresetId} />
              </div>
            </div>
          )}

          {/* 02 Conceito */}
          {current.num === "02" && chosen && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Antes de rodar, conheça a ficha técnica do Algoritmo Genético: o que ele garante, o que ele não garante, e quanto custa em tempo e memória.
              </p>
              <GaDatasheet />
            </div>
          )}

          {/* 03 Como funciona */}
          {current.num === "03" && chosen && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Isto é o que realmente transforma uma geração na próxima, com os parâmetros da configuração &ldquo;{chosen.label}&rdquo;:
              </p>
              <OperatorBreakdown
                eliteCount={chosen.eliteCount}
                populationSize={chosen.populationSize}
                mutationRate={chosen.mutationRate}
                tournamentSize={chosen.tournamentSize}
              />
            </div>
          )}

          {/* 04 Previsão */}
          {current.num === "04" && chosen && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Estas 4 configurações já rodaram de verdade neste mesmo problema, com a mesma seed. Antes de ver o resultado, qual você acha que chegou
                perto do alvo primeiro?
              </p>
              <GaPredictionPanel
                candidates={predictionCandidates}
                selectedId={predictionSelected}
                onSelect={setPredictionSelected}
                revealed={predictionRevealed}
                correctId={bestPreset.id}
              />
              {!predictionRevealed ? (
                <button className="btn-pill btn-pill-primary w-fit" onClick={revealPrediction} disabled={!predictionSelected}>
                  Revelar previsão
                </button>
              ) : (
                predictionFeedback && <div className="glass rounded-2xl p-4 text-[13px] leading-relaxed text-on-surface">{predictionFeedback.message}</div>
              )}
            </div>
          )}

          {/* 05 Simulação real */}
          {current.num === "05" && simConfig && (
            <div className="flex flex-col gap-3">
              <RealSimulationStage config={simConfig} onResult={setSimResult} />
              {simResult && (
                <p className="text-[11.5px] text-on-surface-variant">
                  Execução real: fitness final {simResult.bestEverFitness.toFixed(2)},{" "}
                  {generationSolved(simResult) !== null ? `convergiu na geração ${generationSolved(simResult)}` : "não convergiu"}.
                </p>
              )}
            </div>
          )}

          {/* 06 Explicação da decisão */}
          {current.num === "06" && <GenerationTimeline result={simResult} />}

          {/* 07 Comparação */}
          {current.num === "07" && chosen && <GaComparisonPanel chosen={chosen.id} />}

          {/* 08 Desafio */}
          {current.num === "08" && <GaChallengeStage />}

          {/* 09 Conclusão */}
          {current.num === "09" && chosen && <GaConclusionPanel chosenId={chosen.id} onChooseAnother={onChooseAnother} />}
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
