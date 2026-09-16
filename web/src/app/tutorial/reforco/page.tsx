"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/shared/Panel";
import { LessonStepper, TopStage } from "@/components/tutorial/LessonStepper";
import { RlPresetPicker } from "@/components/tutorial/rl/RlPresetPicker";
import { RlDatasheet } from "@/components/tutorial/rl/RlDatasheet";
import { RlBreakdown } from "@/components/tutorial/rl/RlBreakdown";
import { RlPredictionPanel } from "@/components/tutorial/rl/RlPredictionPanel";
import { RealSimulationStage } from "@/components/tutorial/rl/RealSimulationStage";
import { RlStepInspector } from "@/components/tutorial/rl/RlStepInspector";
import { RlComparisonPanel } from "@/components/tutorial/rl/RlComparisonPanel";
import { RlChallengeStage } from "@/components/tutorial/rl/RlChallengeStage";
import { RlConclusionPanel } from "@/components/tutorial/rl/RlConclusionPanel";
import { RL_PRESETS, RL_TUTORIAL_EPISODES, configFor, worldForPreset } from "@/lib/tutorial/rl-presets";
import { RlRun, runRlComparison } from "@/lib/tutorial/rl-run";
import { RlOutcomeGuess, outcomeLabel } from "@/lib/tutorial/rl-explain";

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

export default function ReforcoTutorialPage() {
  const [presetId, setPresetId] = useState<string | null>(null);
  const [topStage, setTopStage] = useState<TopStage>("conceito");
  const [subBeat, setSubBeat] = useState(0);
  const [visited, setVisited] = useState<Set<TopStage>>(new Set(["conceito"]));

  const [predictionSelected, setPredictionSelected] = useState<RlOutcomeGuess | null>(null);
  const [predictionRevealed, setPredictionRevealed] = useState(false);
  const [simRun, setSimRun] = useState<RlRun | null>(null);

  const chosen = RL_PRESETS.find((p) => p.id === presetId) ?? null;

  // The real comparison run for the prediction step - same preset/episode budget step 05 will run,
  // computed once here so the prediction reveal has real numbers before the user even presses
  // Executar. Deterministic (fixed seed per preset), so it always matches what step 05 shows.
  const predictionRun = useMemo(() => (chosen ? runRlComparison(worldForPreset(chosen), configFor(chosen, RL_TUTORIAL_EPISODES)) : null), [chosen]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new grid needs a fresh prediction and simulation, not a sync with external state
    setPredictionSelected(null);
    setPredictionRevealed(false);
    setSimRun(null);
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
            <span className="accent">Aprendizado por Reforço</span>
          </div>
          <h1 className="content-title">Laboratório: Q-Learning</h1>
          <p className="content-sub">
            Preveja se o agente vai aprender a tempo, execute o treino real, e entenda por que ele aprendeu o que aprendeu - tudo com números de uma
            execução de verdade, nunca inventados.
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
                Aqui o agente não recebe o mapa: diferente de busca, CSP ou busca adversarial, ele não sabe de antemão onde estão as paredes, os
                buracos fatais ou os espinhos. Ele só descobre agindo - tentando uma direção, observando a recompensa e a nova posição, e ajustando o
                que aprendeu (Q-learning). Para comparar, a Iteração de Valor recebe o mapa inteiro de antemão e calcula a política ótima de uma vez,
                sem precisar explorar nada.
              </p>
              <div>
                <p className="mb-2 text-[12px] font-medium text-on-surface-variant">Escolha um mapa para explorar:</p>
                <RlPresetPicker presets={RL_PRESETS} value={presetId} onChange={setPresetId} />
              </div>
            </div>
          )}

          {/* 02 Conceito */}
          {current.num === "02" && chosen && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Antes de rodar, conheça a ficha técnica do Q-learning: o que ele garante, o que ele não garante, e quanto custa em tempo e memória.
              </p>
              <RlDatasheet />
            </div>
          )}

          {/* 03 Como funciona */}
          {current.num === "03" && chosen && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Isto é o que realmente acontece a cada passo do agente, e como isso difere de já conhecer o mapa de antemão:
              </p>
              <RlBreakdown />
            </div>
          )}

          {/* 04 Previsão */}
          {current.num === "04" && chosen && predictionRun && (
            <div className="flex flex-col gap-4">
              <p className="max-w-[65ch] text-[13px] leading-relaxed text-on-surface-variant">
                Em &ldquo;{chosen.label}&rdquo;, treinando com apenas {RL_TUTORIAL_EPISODES} episódios - bem menos que os 600 do módulo livre - o que
                você acha que vai acontecer quando o agente tentar chegar ao objetivo seguindo o que aprendeu?
              </p>
              <RlPredictionPanel
                qRollout={predictionRun.qRollout}
                viRollout={predictionRun.viRollout}
                episodes={RL_TUTORIAL_EPISODES}
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
              <p className="text-[12px] text-on-surface-variant">
                Veja o Q-table sendo treinado de verdade, episódio a episódio, com o orçamento curto de {RL_TUTORIAL_EPISODES} episódios.
              </p>
              <RealSimulationStage preset={chosen} episodes={RL_TUTORIAL_EPISODES} onResult={setSimRun} />
              {simRun && (
                <p className="text-[11.5px] text-on-surface-variant">
                  Execução real: recompensa final {simRun.qRollout.reward.toFixed(2)}, {outcomeLabel(simRun.qRollout.outcome).toLowerCase()} - contra
                  {" "}
                  {simRun.viRollout.reward.toFixed(2)} da Iteração de Valor (ótimo).
                </p>
              )}
            </div>
          )}

          {/* 06 Explicação da decisão */}
          {current.num === "06" && <RlStepInspector run={simRun} />}

          {/* 07 Comparação */}
          {current.num === "07" && chosen && <RlComparisonPanel preset={chosen} shortEpisodes={RL_TUTORIAL_EPISODES} />}

          {/* 08 Desafio */}
          {current.num === "08" && <RlChallengeStage />}

          {/* 09 Conclusão */}
          {current.num === "09" && chosen && <RlConclusionPanel chosenId={chosen.id} onChooseAnother={onChooseAnother} />}
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
