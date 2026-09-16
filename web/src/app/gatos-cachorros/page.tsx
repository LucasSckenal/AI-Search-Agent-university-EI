"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/shared/Panel";
import { StageHint } from "@/components/shared/Stage";
import { Timeline } from "@/components/shared/Timeline";
import { GrayscaleGrid } from "@/components/shared/GrayscaleGrid";
import { ClassBars } from "@/components/shared/ClassBars";
import { CnnNetworkFlow } from "@/components/gatos-cachorros/CnnNetworkFlow";
import { TrainParamsModal, GatosCachorrosFormConfig } from "@/components/gatos-cachorros/TrainParamsModal";
import { SIZE, CreatureSample, EpochSnapshot, TrainResult, forward, randomTestSample, trainGradientDescent, trainingSet } from "@/lib/gatos-cachorros/model";

const ACCENT = "#fbbf24";
const CLASS_LABELS = ["gato", "cachorro"];

export default function GatosCachorrosPage() {
  const [paramsOpen, setParamsOpen] = useState(false);
  const [config, setConfig] = useState<GatosCachorrosFormConfig>({ learningRate: 0.4, epochs: 300, seed: 4 });

  const [running, setRunning] = useState(false);
  const [progressEpoch, setProgressEpoch] = useState(0);
  const [liveSnapshots, setLiveSnapshots] = useState<EpochSnapshot[]>([]);
  const [runResult, setRunResult] = useState<TrainResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  const [selectedEpoch, setSelectedEpoch] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);

  const [testSample, setTestSample] = useState<CreatureSample | null>(null);

  // Fixed set of 156 real photos (see public/gatos-cachorros/ATTRIBUTIONS.md), not regenerated from
  // any seed - computed once.
  const dataset = useMemo(() => trainingSet(), []);

  const newTestImage = () => setTestSample(randomTestSample());

  const runTraining = () => {
    setRunning(true);
    setRunResult(null);
    setLiveSnapshots([]);
    setProgressEpoch(0);
    setSelectedEpoch(0);
    setPlaying(false);

    const iterator = trainGradientDescent({
      dataset,
      learningRate: config.learningRate,
      epochs: config.epochs,
      seed: config.seed,
    });
    const startTime = performance.now();
    const CHUNK_SIZE = 2;
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
          setTestSample(randomTestSample());
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
  const testForward = runResult && testSample ? forward(runResult.finalNetwork, testSample.pixels) : null;

  const status = running ? "TREINANDO" : runResult ? "OBSERVANDO ÉPOCA" : "PRONTO";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Gatos vs Cachorros</span>
            <span>/</span>
            <span className="accent">Redes Neurais</span>
          </div>
          <h1 className="content-title">Gatos vs Cachorros</h1>
          <p className="content-sub">
            O primeiro módulo com convolução de verdade: filtros 3×3, ReLU, max-pool e duas camadas
            densas decidem gato ou cachorro, tudo implementado à mão. As fotos são reais, do
            Wikimedia Commons (veja ATTRIBUTIONS.md) - por isso a acurácia em fotos nunca vistas é
            bem menor que no treino, a lição honesta de aprender com poucos dados reais.
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
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(251,191,36,0.06),transparent_60%)]">
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
                  {" · ACURÁCIA (TREINO) "}
                  <b className="readout-glow font-semibold text-primary">{(currentSnapshot.accuracy * 100).toFixed(0)}%</b>
                </>
              )}
            </StageHint>

            <div className="flex h-full w-full flex-col gap-3 overflow-y-auto px-4 pb-4 pt-14">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">Teste (foto nunca vista no treino)</div>
                {runResult && (
                  <button className="btn-pill" onClick={newTestImage}>
                    <Icon name="refresh" className="text-[15px]" /> Nova imagem
                  </button>
                )}
              </div>
              {runResult && testSample && testForward ? (
                <>
                  <div className="flex shrink-0 items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a small local static photo, not worth Next/Image's remote-optimization machinery */}
                    <img src={testSample.photoUrl} alt="" className="h-[100px] w-[100px] shrink-0 rounded-lg object-cover" />
                    <div className="h-[100px] w-[100px] shrink-0">
                      <GrayscaleGrid values={testSample.pixels} size={SIZE} accentColor={ACCENT} />
                    </div>
                    <div className="min-w-0 max-w-sm flex-1">
                      <ClassBars labels={CLASS_LABELS} probabilities={[1 - testForward.output, testForward.output]} accentColor={ACCENT} />
                    </div>
                  </div>
                  <div key={testSample.photoUrl} className="aspect-[480/280] max-w-2xl">
                    <CnnNetworkFlow
                      network={runResult.finalNetwork}
                      pooled={testForward.pooled}
                      hidden={testForward.hidden}
                      output={testForward.output}
                      labels={CLASS_LABELS}
                      accentColor={ACCENT}
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center px-4 text-center text-[12px] text-on-surface-variant">
                  Treine a rede primeiro pra testar em fotos que ela nunca viu.
                </div>
              )}
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
