import { Modal } from "@/components/shared/Modal";
import { Field, Icon } from "@/components/shared/Panel";
import { StatGrid } from "@/components/shared/StatGrid";
import { GaConvergenceChart } from "@/components/shared/GaConvergenceChart";
import { GaGenerationSummary, GaRunResult } from "@/lib/core/genetic";
import { Genome, finalDistance } from "@/lib/algoritmo-genetico/model";
import { randomSeed } from "@/lib/core/rng";

export interface ExplorerGaFormConfig {
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
  config: ExplorerGaFormConfig;
  onConfigChange: (patch: Partial<ExplorerGaFormConfig>) => void;
  running: boolean;
  progressGeneration: number;
  liveGenerations: GaGenerationSummary[];
  onRun: () => void;
  runResult: GaRunResult<Genome> | null;
  elapsedMs: number | null;
}) {
  const patch = (p: Partial<ExplorerGaFormConfig>) => onConfigChange(p);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Algoritmo Genético"
      subtitle="Evolui uma população de sequências de movimento até chegar perto do alvo"
      wide
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={`População: ${config.populationSize}`}>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={config.populationSize}
            onChange={(e) => patch({ populationSize: Number(e.target.value) })}
          />
        </Field>
        <Field label={`Gerações: ${config.generations}`}>
          <input
            type="range"
            min={5}
            max={60}
            step={1}
            value={config.generations}
            onChange={(e) => patch({ generations: Number(e.target.value) })}
          />
        </Field>
        <Field label={`Taxa de mutação: ${(config.mutationRate * 100).toFixed(0)}%`}>
          <input
            type="range"
            min={0.02}
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
          <input
            type="range"
            min={0}
            max={10}
            value={config.eliteCount}
            onChange={(e) => patch({ eliteCount: Number(e.target.value) })}
          />
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
        <Field label="Seed (evolução)">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={config.seed}
              onChange={(e) => patch({ seed: Number(e.target.value) || 0 })}
              className="w-full"
            />
            <button className="btn btn-secondary !px-2.5" onClick={() => patch({ seed: randomSeed() })} title="Novo seed">
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
            ["Melhor fitness", runResult.bestEverFitness.toFixed(2)],
            ["Distância final (melhor)", finalDistance(runResult.bestEverGenome).toFixed(2)],
            ["Tempo de evolução", elapsedMs !== null ? `${elapsedMs.toFixed(0)}ms` : "—"],
          ]}
        />
      )}
    </Modal>
  );
}
