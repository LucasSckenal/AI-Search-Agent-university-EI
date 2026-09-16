import { Modal } from "@/components/shared/Modal";
import { Field, Icon } from "@/components/shared/Panel";
import { StatGrid } from "@/components/shared/StatGrid";
import { GaConvergenceChart } from "@/components/shared/GaConvergenceChart";
import { GaGenerationSummary, GaRunResult } from "@/lib/core/genetic";
import { simulateHeadless } from "@/lib/pendulo/genetic";
import { PENDULO_DT } from "@/lib/pendulo/model";
import { randomSeed } from "@/lib/core/rng";

export interface PenduloGaFormConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteCount: number;
  tournamentSize: number;
  maxSteps: number;
  seed: number;
  runSeed: number;
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
  config: PenduloGaFormConfig;
  onConfigChange: (patch: Partial<PenduloGaFormConfig>) => void;
  running: boolean;
  progressGeneration: number;
  liveGenerations: GaGenerationSummary[];
  onRun: () => void;
  runResult: GaRunResult<Float64Array> | null;
  elapsedMs: number | null;
}) {
  const patch = (p: Partial<PenduloGaFormConfig>) => onConfigChange(p);

  const bestRun = runResult
    ? simulateHeadless(runResult.bestEverGenome, { runSeed: config.runSeed, maxSteps: config.maxSteps, dt: PENDULO_DT })
    : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Algoritmo Genético"
      subtitle="Evolui os pesos de uma rede neural até ela equilibrar o pêndulo pelo máximo de tempo"
      wide
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={`População: ${config.populationSize}`}>
          <input
            type="range"
            min={20}
            max={200}
            step={10}
            value={config.populationSize}
            onChange={(e) => patch({ populationSize: Number(e.target.value) })}
          />
        </Field>
        <Field label={`Gerações: ${config.generations}`}>
          <input
            type="range"
            min={10}
            max={150}
            step={5}
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
            max={15}
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
        <Field label={`Passos máximos: ${config.maxSteps} (${(config.maxSteps * PENDULO_DT).toFixed(0)}s simulados)`}>
          <input
            type="range"
            min={200}
            max={2000}
            step={100}
            value={config.maxSteps}
            onChange={(e) => patch({ maxSteps: Number(e.target.value) })}
          />
        </Field>
      </div>

      <div className="border-t border-outline-variant pt-4">
        <div className="grid grid-cols-2 gap-3">
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
          <Field label="Seed (inclinação inicial)">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={config.runSeed}
                onChange={(e) => patch({ runSeed: Number(e.target.value) || 0 })}
                className="w-full"
              />
              <button className="btn btn-secondary !px-2.5" onClick={() => patch({ runSeed: randomSeed() })} title="Novo seed">
                <Icon name="casino" className="text-[16px]" />
              </button>
            </div>
          </Field>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-on-surface-variant">
          Todos os indivíduos de uma geração partem exatamente da mesma inclinação inicial (mesmo
          seed) — assim a diferença de desempenho vem do agente, não do acaso.
        </p>
      </div>

      <button className="btn btn-primary" onClick={onRun} disabled={running}>
        <Icon name="play_arrow" className="text-[16px]" />
        {running ? `Evoluindo… geração ${progressGeneration}/${config.generations}` : "Rodar evolução"}
      </button>

      {liveGenerations.length > 0 && <GaConvergenceChart generations={liveGenerations} />}

      {runResult && !running && bestRun && (
        <StatGrid
          cols={3}
          items={[
            ["Melhor fitness", runResult.bestEverFitness.toFixed(1)],
            ["Passos sobrevividos", bestRun.steps],
            ["Sobreviveu até o fim", bestRun.alive ? "Sim" : "Não"],
            ["Tempo simulado", `${bestRun.elapsed.toFixed(1)}s`],
            ["Posição final", `${bestRun.x.toFixed(2)}m`],
            ["Tempo de evolução", elapsedMs !== null ? `${elapsedMs.toFixed(0)}ms` : "—"],
          ]}
        />
      )}
    </Modal>
  );
}
