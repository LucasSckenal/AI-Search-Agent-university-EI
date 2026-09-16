import { Modal } from "@/components/shared/Modal";
import { Field, Icon } from "@/components/shared/Panel";
import { StatGrid } from "@/components/shared/StatGrid";
import { LossChart } from "@/components/perceptron/LossChart";
import { EpochSnapshot, TrainResult } from "@/lib/digitos/model";
import { randomSeed } from "@/lib/core/rng";

export interface DigitosFormConfig {
  learningRate: number;
  epochs: number;
  seed: number;
}

export function TrainParamsModal({
  open,
  onClose,
  config,
  onConfigChange,
  running,
  progressEpoch,
  liveSnapshots,
  onRun,
  runResult,
  elapsedMs,
}: {
  open: boolean;
  onClose: () => void;
  config: DigitosFormConfig;
  onConfigChange: (patch: Partial<DigitosFormConfig>) => void;
  running: boolean;
  progressEpoch: number;
  liveSnapshots: EpochSnapshot[];
  onRun: () => void;
  runResult: TrainResult | null;
  elapsedMs: number | null;
}) {
  const patch = (p: Partial<DigitosFormConfig>) => onConfigChange(p);

  return (
    <Modal open={open} onClose={onClose} title="Treino por Gradiente Descendente" subtitle="10 classes, softmax e entropia cruzada - mesma família do Classificador Linear" wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Taxa de aprendizado: ${config.learningRate.toFixed(2)}`}>
          <input type="range" min={0.05} max={1.5} step={0.05} value={config.learningRate} onChange={(e) => patch({ learningRate: Number(e.target.value) })} />
        </Field>
        <Field label={`Épocas: ${config.epochs}`}>
          <input type="range" min={20} max={300} step={10} value={config.epochs} onChange={(e) => patch({ epochs: Number(e.target.value) })} />
        </Field>
      </div>

      <div className="border-t border-outline-variant pt-4">
        <Field label="Seed (dataset e pesos iniciais)">
          <div className="flex items-center gap-2">
            <input type="number" value={config.seed} onChange={(e) => patch({ seed: Number(e.target.value) || 0 })} className="w-full" />
            <button className="btn btn-secondary !px-2.5" onClick={() => patch({ seed: randomSeed() })} title="Novo seed">
              <Icon name="casino" className="text-[16px]" />
            </button>
          </div>
        </Field>
      </div>

      <button className="btn btn-primary" onClick={onRun} disabled={running}>
        <Icon name="play_arrow" className="text-[16px]" />
        {running ? `Treinando… época ${progressEpoch}/${config.epochs}` : "Treinar"}
      </button>

      {liveSnapshots.length > 1 && <LossChart snapshots={liveSnapshots} />}

      {runResult && !running && (
        <StatGrid
          cols={3}
          items={[
            ["Perda final", runResult.snapshots[runResult.snapshots.length - 1].loss.toFixed(3)],
            ["Acurácia final", `${(runResult.snapshots[runResult.snapshots.length - 1].accuracy * 100).toFixed(0)}%`],
            ["Tempo de treino", elapsedMs !== null ? `${elapsedMs.toFixed(0)}ms` : "—"],
          ]}
        />
      )}
    </Modal>
  );
}
