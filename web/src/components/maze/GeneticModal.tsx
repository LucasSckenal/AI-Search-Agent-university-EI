import { Modal } from "@/components/shared/Modal";
import { Field, Icon } from "@/components/shared/Panel";
import { Toggle } from "@/components/shared/Toggle";
import { StatGrid } from "@/components/shared/StatGrid";
import { GaConvergenceChart } from "@/components/shared/GaConvergenceChart";
import { GaGenerationSummary, GaRunResult } from "@/lib/core/genetic";
import { MazeGenome, walkChromosome } from "@/lib/maze/genetic";
import { MazeState } from "@/lib/maze/model";
import { randomSeed } from "@/lib/core/rng";

export interface MazeGaFormConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteCount: number;
  tournamentSize: number;
  lengthMultiplier: number;
  allowDiagonal: boolean;
  seed: number;
}

export function GeneticModal({
  open,
  onClose,
  maze,
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
  maze: MazeState;
  config: MazeGaFormConfig;
  onConfigChange: (patch: Partial<MazeGaFormConfig>) => void;
  running: boolean;
  progressGeneration: number;
  /** Generation summaries accumulated so far - updates every chunk while running, so the
   *  convergence chart animates live instead of only appearing once the whole run finishes. */
  liveGenerations: GaGenerationSummary[];
  onRun: () => void;
  runResult: GaRunResult<MazeGenome> | null;
  elapsedMs: number | null;
}) {
  const patch = (p: Partial<MazeGaFormConfig>) => onConfigChange(p);

  const bestWalk = runResult ? walkChromosome(maze, runResult.bestEverGenome) : null;
  const firstReachedGoalGen = runResult
    ? runResult.bestPerGeneration.findIndex((genome) => walkChromosome(maze, genome).reachedGoal)
    : -1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Algoritmo Genético"
      subtitle="Evolui uma população de rotas até encontrar o caminho até o objetivo"
      wide
    >
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
          <input
            type="range"
            min={0}
            max={20}
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
        <Field label={`Tamanho do cromossomo: ${config.lengthMultiplier.toFixed(1)}× distância`}>
          <input
            type="range"
            min={1.5}
            max={6}
            step={0.5}
            value={config.lengthMultiplier}
            onChange={(e) => patch({ lengthMultiplier: Number(e.target.value) })}
          />
        </Field>
        <Field label="Movimento diagonal">
          <div className="pt-1.5">
            <Toggle checked={config.allowDiagonal} onChange={(v) => patch({ allowDiagonal: v })} />
          </div>
        </Field>
      </div>

      <div className="border-t border-outline-variant pt-4">
        <Field label="Seed">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={config.seed}
              onChange={(e) => patch({ seed: Number(e.target.value) || 0 })}
              className="w-full"
            />
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
            ["Objetivo alcançado", bestWalk?.reachedGoal ? "Sim" : "Não"],
            ["1ª geração no objetivo", firstReachedGoalGen >= 0 ? firstReachedGoalGen : "—"],
            ["Melhor fitness", runResult.bestEverFitness.toFixed(2)],
            ["Custo do melhor caminho", bestWalk ? bestWalk.cost.toFixed(2) : "—"],
            ["Passos usados", bestWalk ? bestWalk.stepsUsed : "—"],
            ["Tempo", elapsedMs !== null ? `${elapsedMs.toFixed(0)}ms` : "—"],
          ]}
        />
      )}
    </Modal>
  );
}
