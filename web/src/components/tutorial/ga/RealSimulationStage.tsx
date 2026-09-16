"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/shared/Panel";
import { StageHint } from "@/components/shared/Stage";
import { WebGLGate } from "@/components/shared/WebGLGate";
import { GaConvergenceChart } from "@/components/shared/GaConvergenceChart";
import { StepControls } from "@/components/tutorial/StepControls";
import { GaConfig, GaRunResult } from "@/lib/core/genetic";
import { simulatePath, finalDistance, Genome } from "@/lib/algoritmo-genetico/model";
import { runGaFull } from "@/lib/tutorial/ga-run";

const PopulationArena3D = dynamic(
  () => import("@/components/algoritmo-genetico/PopulationArena3D").then((m) => m.PopulationArena3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">
        Carregando arena 3D…
      </div>
    ),
  }
);

/**
 * The lab's real-execution stage for the GA family - gated behind an [EXECUTAR] button, then plays
 * the real evolve() run generation by generation on the 3D population arena (the same component
 * /algoritmo-genetico uses), with a live convergence chart of the real best/mean fitness so far.
 * `topK = populationSize` so every genome of every generation is available to the arena, exactly
 * like the canonical explainer page.
 */
export function RealSimulationStage({ config, onResult }: { config: GaConfig; onResult?: (result: GaRunResult<Genome>) => void }) {
  const [executed, setExecuted] = useState(false);
  const [genIndex, setGenIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const run = useMemo(() => runGaFull(config, config.populationSize), [config]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new config needs a fresh, un-executed run
    setExecuted(false);
    setGenIndex(0);
    setPlaying(false);
  }, [config]);

  useEffect(() => {
    if (!playing) return;
    if (genIndex >= run.generations.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setGenIndex((g) => Math.min(g + 1, run.generations.length - 1)), 500);
    return () => clearTimeout(t);
  }, [playing, genIndex, run]);

  const start = () => {
    setExecuted(true);
    setGenIndex(0);
    setPlaying(run.generations.length > 1);
    onResult?.(run);
  };

  // Mounted unconditionally (even pre-execution, with empty arrays) - like RealSimulationStage's
  // MazeCanvas for the search family, swapping this for a placeholder div before execution collapses
  // the whole flex chain to zero height, since a plain div has no intrinsic content to size around.
  const generationView = useMemo(() => {
    const currentGenomes = executed ? run.topPerGeneration[Math.min(genIndex, run.topPerGeneration.length - 1)] : [];
    return { paths: currentGenomes.map((g) => simulatePath(g)), fitnesses: currentGenomes.map((g) => -finalDistance(g)) };
  }, [executed, genIndex, run]);

  const summary = executed ? run.generations[Math.min(genIndex, run.generations.length - 1)] : undefined;

  return (
    <div className="canvas-body">
      <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(126,224,168,0.06),transparent_60%)]">
        <StageHint>
          GERAÇÃO <b className="readout-glow font-semibold text-primary">{executed ? genIndex : 0}</b>
          {" / "}
          {Math.max(run.generations.length - 1, 0)}
          {summary && (
            <>
              {" · MELHOR FITNESS "}
              <b className="readout-glow font-semibold text-primary">{summary.bestFitness.toFixed(2)}</b>
            </>
          )}
        </StageHint>

        <WebGLGate>
          <PopulationArena3D paths={generationView.paths} fitnesses={generationView.fitnesses} bestIndex={executed ? 0 : null} />
        </WebGLGate>

        {!executed && (
          <div className="absolute inset-0 z-[2] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <button className="btn-pill btn-pill-primary" onClick={start}>
              <Icon name="play_arrow" className="text-[15px]" /> Executar
            </button>
          </div>
        )}
      </div>

      {executed && (
        <div className="border-t border-outline-variant bg-background px-4 py-3 sm:px-5">
          <GaConvergenceChart generations={run.generations.slice(0, genIndex + 1)} />
        </div>
      )}

      <StepControls
        index={executed ? genIndex : 0}
        total={Math.max(run.generations.length - 1, 0)}
        onChange={(i) => {
          if (!executed) return;
          setPlaying(false);
          setGenIndex(i);
        }}
        playing={playing}
        onTogglePlay={() => setPlaying((p) => !p)}
        disabled={!executed}
      />
    </div>
  );
}
