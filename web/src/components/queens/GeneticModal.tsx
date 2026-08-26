import { Modal } from "@/components/shared/Modal";
import { Field, Icon } from "@/components/shared/Panel";
import { StatGrid } from "@/components/shared/StatGrid";
import { GaConvergenceChart } from "@/components/shared/GaConvergenceChart";
import { GaGenerationSummary, GaRunResult } from "@/lib/core/genetic";
import { QueensGenome } from "@/lib/queens/genetic";
import { conflicts } from "@/lib/queens/model";
import { randomSeed } from "@/lib/core/rng";

export interface QueensGaFormConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteCount: number;
  tournamentSize: number;
  seed: number;
}

export function GeneticModal({
  open,
  onClose,
  config,
  onConfigChange,
  running,
  progressGeneration,
  liveGenerations,
  onRun,
  runResult,
  elapsedMs,
}: {
  open: boolean;
  onClose: () => void;
  config: QueensGaFormConfig;
  onConfigChange: (patch: Partial<QueensGaFormConfig>) => void;
  running: boolean;
  progressGeneration: number;
  /** Generation summaries accumulated so far - updates every chunk while running, so the
   *  convergence chart animates live instead of only appearing once the whole run finishes. */
  liveGenerations: GaGenerationSummary[];
  onRun: () => void;
  runResult: GaRunResult<QueensGenome> | null;
  elapsedMs: number | null;
}) {
  const patch = (p: Partial<QueensGaFormConfig>) => onConfigChange(p);

  const bestConflicts = runResult ? conflicts(runResult.bestEverGenome).length : null;
  const firstBestGen = runResult
    ? runResult.bestPerGeneration.findIndex((genome) => conflicts(genome).length <= (bestConflicts ?? Infinity))
    : -1;

  return (
    <Modal open={open} onClose={onClose} title="Algoritmo Genético" subtitle="Evolui uma população de tabuleiros até zerar os conflitos" wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`População: ${config.populationSize}`}>
          <input
            type="range"
            min={20}
            max={300}
            step={10}
            value={config.populationSize}
            onChange={(e) => patch({ populationSize: Number(e.target.value) })}
          />
        </Field>
        <Field label={`Gerações: ${config.generations}`}>
          <input
            type="range"
            min={20}
            max={500}
            step={10}
            value={config.generations}
            onChange={(e) => patch({ generations: Number(e.target.value) })}
          />
        </Field>
        <Field label={`Taxa de mutação: ${(config.mutationRate * 100).toFixed(0)}%`}>
          <input
            type="range"
            min={0.01}
            max={0.5}
            step={0.01}
            value={config.mutationRate}
            onChange={(e) => patch({ mutationRate: Number(e.target.value) })}
          />
        </Field>
        <Field label={`Taxa de cruzamento: ${(config.crossoverRate * 100).toFixed(0)}%`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={config.crossoverRate}
            onChange={(e) => patch({ crossoverRate: Number(e.target.value) })}
          />
        </Field>
        <Field label={`Elite: ${config.eliteCount} indivíduos`}>
          <input type="range" min={0} max={20} value={config.eliteCount} onChange={(e) => patch({ eliteCount: Number(e.target.value) })} />
        </Field>
        <Field label={`Torneio: ${config.tournamentSize} candidatos`}>
          <input
            type="range"
            min={2}
            max={10}
            value={config.tournamentSize}
            onChange={(e) => patch({ tournamentSize: Number(e.target.value) })}
          />
        </Field>
      </div>

      <div className="border-t border-outline-variant pt-4">
        <Field label="Seed">
          <div className="flex items-center gap-2">
            <input type="number" value={config.seed} onChange={(e) => patch({ seed: Number(e.target.value) || 0 })} className="w-full" />
            <button className="btn btn-secondary !px-2.5" onClick={() => patch({ seed: randomSeed() })} title="Novo seed aleatório">
              <Icon name="casino" className="text-[16px]" />
            </button>
          </div>
        </Field>
      </div>

      <button className="btn btn-primary" onClick={onRun} disabled={running}>
        <Icon name="play_arrow" className="text-[16px]" />
        {running ? `Evoluindo… geração ${progressGeneration}/${config.generations}` : "Rodar evolução"}
      </button>

      {liveGenerations.length > 0 && <GaConvergenceChart generations={liveGenerations} />}

      {runResult && !running && (
        <StatGrid
          cols={3}
          items={[
            ["Conflitos restantes", bestConflicts !== null ? String(bestConflicts) : "—"],
            ["1ª geração com esse resultado", firstBestGen >= 0 ? firstBestGen : "—"],
            ["Tempo", elapsedMs !== null ? `${elapsedMs.toFixed(0)}ms` : "—"],
          ]}
        />
      )}
    </Modal>
  );
}
