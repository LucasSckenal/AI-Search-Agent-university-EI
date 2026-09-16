"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/shared/Panel";
import { Select } from "@/components/shared/Select";
import { Toggle } from "@/components/shared/Toggle";
import { StageHint } from "@/components/shared/Stage";
import { Timeline } from "@/components/shared/Timeline";
import { DecisionBoundary } from "@/components/perceptron/DecisionBoundary";
import { PerceptronNetworkViz } from "@/components/perceptron/PerceptronNetworkViz";
import { ParamsModal, PerceptronFormConfig } from "@/components/perceptron/ParamsModal";
import { DatasetKind, EpochSnapshot, TrainResult, generateDataset, trainGradientDescent } from "@/lib/perceptron/model";
import { randomSeed } from "@/lib/core/rng";

const POINT_COUNT = 130;
const HIDDEN_SIZE = 6;

const DATASET_LABELS: Record<DatasetKind, string> = {
  linear: "Linearmente separável",
  circle: "Círculo",
  xor: "XOR",
};

export default function PerceptronPage() {
  const [datasetKind, setDatasetKind] = useState<DatasetKind>("linear");
  const [useHidden, setUseHidden] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [config, setConfig] = useState<PerceptronFormConfig>({
    learningRate: 0.8,
    epochs: 150,
    seed: randomSeed(),
  });

  const [running, setRunning] = useState(false);
  const [progressEpoch, setProgressEpoch] = useState(0);
  const [liveSnapshots, setLiveSnapshots] = useState<EpochSnapshot[]>([]);
  const [runResult, setRunResult] = useState<TrainResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  const [selectedEpoch, setSelectedEpoch] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);

  const dataset = useMemo(() => generateDataset(datasetKind, POINT_COUNT, config.seed), [datasetKind, config.seed]);

  // A previous run's snapshots were trained on the old dataset/architecture - showing them against
  // a newly-changed dataset or a toggled hidden layer would overlay a mismatched decision region, so
  // any change here invalidates the run instead of just going stale.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dataset/architecture changed, so the previous run no longer describes what's on screen
    setRunResult(null);
    setLiveSnapshots([]);
    setSelectedEpoch(0);
    setPlaying(false);
  }, [dataset, useHidden]);

  const runTraining = () => {
    setRunning(true);
    setRunResult(null);
    setLiveSnapshots([]);
    setProgressEpoch(0);
    setSelectedEpoch(0);
    setPlaying(false);

    const iterator = trainGradientDescent({
      dataset,
      useHidden,
      hiddenSize: HIDDEN_SIZE,
      learningRate: config.learningRate,
      epochs: config.epochs,
      seed: config.seed,
    });
    const startTime = performance.now();
    const CHUNK_SIZE = 8;
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
          // Lands on epoch 0 (not the final one) so Timeline's play button can scrub the whole
          // training run from the start - skip-to-end is right there for jumping straight to the result.
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
    const t = setTimeout(
      () => setSelectedEpoch((e) => Math.min(e + Math.max(1, speed), runResult.snapshots.length - 1)),
      1000 / 30
    );
    return () => clearTimeout(t);
  }, [playing, selectedEpoch, speed, runResult]);

  const currentSnapshot = runResult?.snapshots[Math.min(selectedEpoch, runResult.snapshots.length - 1)] ?? null;
  const status = running ? "TREINANDO" : runResult ? "OBSERVANDO ÉPOCA" : "PRONTO";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Classificador Linear</span>
            <span>/</span>
            <span className="accent">Redes Neurais</span>
          </div>
          <h1 className="content-title">Classificador Linear</h1>
          <p className="content-sub">
            Uma rede pequena aprende a separar pontos de duas classes por gradiente descendente
            (backpropagation) - sem nenhum algoritmo genético envolvido, os pesos se ajustam a cada
            época na direção que mais reduz o erro. Desligada, a camada oculta deixa só um
            perceptron de camada única (Rosenblatt, 1958): ele resolve dados linearmente separáveis,
            mas é matematicamente incapaz de aprender XOR ou um círculo - a limitação que Minsky e
            Papert usaram em 1969 contra os perceptrons. Ligue a camada oculta pra ver a fronteira
            curvar e resolver os dois.
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
        <div className="workspace-head">
          <Select
            value={datasetKind}
            onChange={(v) => setDatasetKind(v as DatasetKind)}
            className="!w-auto shrink-0"
            options={(Object.keys(DATASET_LABELS) as DatasetKind[]).map((k) => ({ value: k, label: DATASET_LABELS[k] }))}
          />
          <div className="workspace-links">
            <Toggle checked={useHidden} onChange={setUseHidden} label={`Camada oculta (${HIDDEN_SIZE} neurônios)`} />
          </div>
        </div>

        <div className="canvas-body">
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(34,211,238,0.06),transparent_60%)]">
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

            {currentSnapshot ? (
              <div className="flex h-full w-full flex-col lg:flex-row">
                <div className="min-h-0 flex-1 lg:w-1/2">
                  <DecisionBoundary network={currentSnapshot.network} dataset={dataset} onHover={setHoverPoint} />
                </div>
                <div className="h-[180px] shrink-0 border-t border-white/10 lg:h-auto lg:w-1/2 lg:border-l lg:border-t-0">
                  <PerceptronNetworkViz network={currentSnapshot.network} point={hoverPoint ?? { x: 0, y: 0 }} accentColor="#22d3ee" />
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-[12px] text-on-surface-variant">
                <p className="max-w-xs">Treine a rede pra ver a fronteira de decisão se formar, época a época.</p>
                <button className="btn-pill btn-pill-primary" style={{ flex: "none" }} onClick={runTraining} disabled={running}>
                  <Icon name="play_arrow" className="text-[15px]" /> {running ? "Treinando…" : "Treinar"}
                </button>
              </div>
            )}
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

      <ParamsModal
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
