"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/shared/Panel";
import { StageHint } from "@/components/shared/Stage";
import { Timeline } from "@/components/shared/Timeline";
import { GrayscaleGrid } from "@/components/shared/GrayscaleGrid";
import { ClassBars } from "@/components/shared/ClassBars";
import { DrawCanvas } from "@/components/digitos/DrawCanvas";
import { TrainParamsModal, DigitosFormConfig } from "@/components/digitos/TrainParamsModal";
import { GRID, CLASSES, DigitSample, EpochSnapshot, TrainResult, forward, generateDataset, trainGradientDescent } from "@/lib/digitos/model";

const ACCENT = "#fb7185";
const SAMPLES_PER_DIGIT = 15;
const DATASET_NOISE = 0.25;
const HIDDEN_SIZE = 16;
const LABELS = Array.from({ length: CLASSES }, (_, i) => String(i));

export default function DigitosPage() {
  const [paramsOpen, setParamsOpen] = useState(false);
  // Fixed initial seed (not randomSeed()) - this grid renders before any user interaction, so the
  // server-rendered and first client-rendered example must match exactly or hydration fails (the
  // same lesson learned building the Hopfield page).
  const [config, setConfig] = useState<DigitosFormConfig>({ learningRate: 0.5, epochs: 120, seed: 1 });

  const [running, setRunning] = useState(false);
  const [progressEpoch, setProgressEpoch] = useState(0);
  const [liveSnapshots, setLiveSnapshots] = useState<EpochSnapshot[]>([]);
  const [runResult, setRunResult] = useState<TrainResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  const [selectedEpoch, setSelectedEpoch] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);

  const [drawnPixels, setDrawnPixels] = useState<number[]>(() => new Array(GRID * GRID).fill(0));

  const dataset = useMemo(() => generateDataset(SAMPLES_PER_DIGIT, DATASET_NOISE, config.seed), [config.seed]);
  const sampleToWatch: DigitSample = dataset[0];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new dataset invalidates any previous run
    setRunResult(null);
    setLiveSnapshots([]);
    setSelectedEpoch(0);
    setPlaying(false);
  }, [dataset]);

  const runTraining = () => {
    setRunning(true);
    setRunResult(null);
    setLiveSnapshots([]);
    setProgressEpoch(0);
    setSelectedEpoch(0);
    setPlaying(false);

    const iterator = trainGradientDescent({
      dataset,
      hiddenSize: HIDDEN_SIZE,
      learningRate: config.learningRate,
      epochs: config.epochs,
      seed: config.seed,
    });
    const startTime = performance.now();
    const CHUNK_SIZE = 4;
    const collected: EpochSnapshot[] = [];

    const step = () => {
      for (let i = 0; i < CHUNK_SIZE; i++) {
        const next = iterator.next();
        if (next.done) {
          const finalResult = next.value;
          setRunResult(finalResult);
          setLiveSnapshots(finalResult.snapshots);
          setElapsedMs(performance.now() - startTime);
          setProgressEpoch(finalResult.snapshots.length - 1);
          setRunning(false);
          setSelectedEpoch(0);
          return;
        }
        collected.push(next.value);
      }
      setLiveSnapshots([...collected]);
      setProgressEpoch(collected.length - 1);
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
  };

  useEffect(() => {
    if (!playing || !runResult) return;
    if (selectedEpoch >= runResult.snapshots.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setSelectedEpoch((e) => Math.min(e + Math.max(1, speed), runResult.snapshots.length - 1)), 1000 / 20);
    return () => clearTimeout(t);
  }, [playing, selectedEpoch, speed, runResult]);

  const currentSnapshot = runResult?.snapshots[Math.min(selectedEpoch, runResult.snapshots.length - 1)] ?? null;
  const watchPrediction = currentSnapshot ? forward(currentSnapshot.network, sampleToWatch.pixels).probs : null;

  const drawPrediction = runResult ? forward(runResult.finalNetwork, drawnPixels).probs : null;

  const status = running ? "TREINANDO" : runResult ? "OBSERVANDO ÉPOCA" : "PRONTO";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Dígitos Manuscritos</span>
            <span>/</span>
            <span className="accent">Redes Neurais</span>
          </div>
          <h1 className="content-title">Dígitos Manuscritos</h1>
          <p className="content-sub">
            O mesmo gradiente descendente do Classificador Linear, dando o salto de duas classes
            num plano 2D pra dez classes numa imagem 8×8 - softmax e entropia cruzada no lugar de
            sigmoid e entropia binária. Sem baixar nenhum dataset: cada amostra de treino é um dos
            dez algarismos desenhados à mão no código mais um pouco de ruído aleatório. Depois de
            treinar, desenhe seu próprio dígito e veja a rede reconhecer ao vivo, traço a traço.
          </p>
        </div>
        <div className="content-actions">
          <button className="btn-pill" onClick={() => setParamsOpen(true)}>
            <Icon name="tune" className="text-[15px]" /> Parâmetros
          </button>
          <button className="btn-pill btn-pill-primary" onClick={runTraining} disabled={running}>
            <Icon name="play_arrow" className="text-[15px]" /> {running ? "Treinando…" : "Treinar"}
          </button>
        </div>
      </div>

      <div className="workspace-card">
        <div className="canvas-body">
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(251,113,133,0.06),transparent_60%)]">
            <StageHint>
              ÉPOCA{" "}
              <b className="readout-glow font-semibold text-primary">
                {runResult ? selectedEpoch : "—"}
                {runResult ? ` / ${runResult.snapshots.length - 1}` : ""}
              </b>
              {currentSnapshot && (
                <>
                  {" · PERDA "}
                  <b className="readout-glow font-semibold text-primary">{currentSnapshot.loss.toFixed(3)}</b>
                  {" · ACURÁCIA "}
                  <b className="readout-glow font-semibold text-primary">{(currentSnapshot.accuracy * 100).toFixed(0)}%</b>
                </>
              )}
            </StageHint>

            <div className="flex h-full w-full flex-col lg:flex-row">
              <div className="flex min-h-0 flex-1 flex-col gap-3 border-b border-white/10 p-4 lg:w-1/2 lg:border-b-0 lg:border-r">
                <div className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">
                  Exemplo de treino (dígito {sampleToWatch.label})
                </div>
                <div className="flex min-h-0 flex-1 items-center gap-4">
                  <div className="aspect-square h-full max-h-[180px] shrink-0">
                    <GrayscaleGrid values={sampleToWatch.pixels} size={GRID} accentColor={ACCENT} />
                  </div>
                  <div className="min-w-0 flex-1">
                    {watchPrediction ? (
                      <ClassBars labels={LABELS} probabilities={watchPrediction} accentColor={ACCENT} />
                    ) : (
                      <p className="text-[12px] text-on-surface-variant">Treine a rede pra ver a confiança em cada classe.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 lg:w-1/2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">Desenhe você mesmo</div>
                {runResult ? (
                  <div className="flex min-h-0 flex-1 items-center gap-4">
                    <DrawCanvas gridSize={GRID} onChange={setDrawnPixels} accentColor={ACCENT} />
                    <div className="min-w-0 flex-1">
                      <ClassBars labels={LABELS} probabilities={drawPrediction!} accentColor={ACCENT} />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center px-4 text-center text-[12px] text-on-surface-variant">
                    Treine a rede primeiro pra poder testar seu próprio desenho.
                  </div>
                )}
              </div>
            </div>
          </div>

          <Timeline
            status={status}
            pulsing={playing}
            playing={playing}
            onTogglePlay={() => setPlaying((p) => !p)}
            onSkipEnd={() => {
              if (!runResult) return;
              setSelectedEpoch(runResult.snapshots.length - 1);
              setPlaying(false);
            }}
            current={selectedEpoch}
            total={runResult ? runResult.snapshots.length - 1 : 0}
            unitLabel="épocas"
            disabled={!runResult}
            speed={speed}
            onSpeedChange={setSpeed}
            speedLabel="Velocidade"
            speedMax={8}
          />
        </div>
      </div>

      <TrainParamsModal
        open={paramsOpen}
        onClose={() => setParamsOpen(false)}
        config={config}
        onConfigChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
        running={running}
        progressEpoch={progressEpoch}
        liveSnapshots={liveSnapshots}
        onRun={runTraining}
        runResult={runResult}
        elapsedMs={elapsedMs}
      />
    </div>
  );
}
