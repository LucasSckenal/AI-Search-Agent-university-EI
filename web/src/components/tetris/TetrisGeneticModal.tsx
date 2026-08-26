import { Modal } from "@/components/shared/Modal";
import { Field, Icon } from "@/components/shared/Panel";
import { StatGrid } from "@/components/shared/StatGrid";
import { GaConvergenceChart } from "@/components/shared/GaConvergenceChart";
import { GaGenerationSummary, GaRunResult } from "@/lib/core/genetic";
import { HeuristicWeights } from "@/lib/tetris/model";
import { randomSeed } from "@/lib/core/rng";

export interface TetrisGaFormConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteCount: number;
  tournamentSize: number;
  evalMaxPieces: number;
  seed: number;
}

export function TetrisGeneticModal({
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
  config: TetrisGaFormConfig;
  onConfigChange: (patch: Partial<TetrisGaFormConfig>) => void;
  running: boolean;
  progressGeneration: number;
  liveGenerations: GaGenerationSummary[];
  onRun: () => void;
  runResult: GaRunResult<HeuristicWeights> | null;
  elapsedMs: number | null;
}) {
  const patch = (p: Partial<TetrisGaFormConfig>) => onConfigChange(p);
  const w = runResult?.bestEverGenome;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Algoritmo Genético"
      subtitle="Evolui os pesos da heurística - a mesma escolha de posição de queda sem antecipação da Heurística Gulosa, mas com pesos aprendidos em vez de fixos"
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
            min={10}
            max={100}
            step={5}
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
          <input type="range" min={0} max={10} value={config.eliteCount} onChange={(e) => patch({ eliteCount: Number(e.target.value) })} />
        </Field>
        <Field label={`Torneio: ${config.tournamentSize} candidatos`}>
          <input
            type="range"
            min={2}
            max={8}
            value={config.tournamentSize}
            onChange={(e) => patch({ tournamentSize: Number(e.target.value) })}
          />
        </Field>
      </div>

      <div className="border-t border-outline-variant pt-4">
        <Field label={`Peças por avaliação: ${config.evalMaxPieces}`}>
          <input
            type="range"
            min={50}
            max={400}
            step={25}
            value={config.evalMaxPieces}
            onChange={(e) => patch({ evalMaxPieces: Number(e.target.value) })}
          />
        </Field>
        <p className="mt-1.5 text-[11px] leading-relaxed text-on-surface-variant">
          Cada indivíduo joga uma partida completa (cortada nesse limite de peças) para ganhar sua
          pontuação de aptidão - população × gerações partidas ao todo, por isso o limite é bem
          menor que o de uma execução normal.
        </p>
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

      {runResult && !running && w && (
        <StatGrid
          cols={2}
          items={[
            ["Melhor pontuação (avaliação)", runResult.bestEverFitness.toLocaleString("pt-BR")],
            ["Tempo", elapsedMs !== null ? `${elapsedMs.toFixed(0)}ms` : "—"],
            [
              "Pesos evoluídos",
              `linhas ${w.lines.toFixed(2)} · altura ${w.height.toFixed(2)} · buracos ${w.holes.toFixed(2)} · irregularidade ${w.bumpiness.toFixed(2)}`,
            ],
          ]}
        />
      )}
    </Modal>
  );
}
