"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/shared/Panel";
import { StageHint } from "@/components/shared/Stage";
import { StepControls } from "@/components/tutorial/StepControls";
import { MinesweeperGrid } from "@/components/campo-minado/MinesweeperGrid";
import { MinesweeperStep } from "@/lib/campo-minado/model";
import { CmPreset, openingFor } from "@/lib/tutorial/cm-presets";
import { mapFromSparse, runCmComparison } from "@/lib/tutorial/cm-run";
import { actionLabel } from "@/lib/tutorial/cm-explain";

/**
 * The lab's real-execution stage for the Probabilísticos family - gated behind an [EXECUTAR]
 * button, then reveals the real logicaSteps()/probabilidadeSteps() run step by step on the same
 * MinesweeperGrid /campo-minado uses (plain CSS grid, no WebGL needed here), scrubbed with
 * StepControls. `useProbability` picks which of the two real solvers' trace is shown - same shape
 * as CSP's `useForwardChecking`.
 */
export function RealSimulationStage({
  preset,
  useProbability,
  onResult,
}: {
  preset: CmPreset;
  useProbability: boolean;
  onResult?: (steps: MinesweeperStep[]) => void;
}) {
  const [executed, setExecuted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const opening = useMemo(() => openingFor(preset), [preset]);
  const run = useMemo(() => runCmComparison(opening.instance, opening.revealed, opening.flagged), [opening]);
  const steps = useProbability ? run.probabilidade : run.logica;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new preset/technique needs a fresh, un-executed run
    setExecuted(false);
    setStepIndex(0);
    setPlaying(false);
  }, [steps]);

  useEffect(() => {
    if (!playing) return;
    if (stepIndex >= steps.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStepIndex((i) => Math.min(i + 1, steps.length - 1)), 90);
    return () => clearTimeout(t);
  }, [playing, stepIndex, steps]);

  const start = () => {
    setExecuted(true);
    setStepIndex(0);
    setPlaying(steps.length > 1);
    onResult?.(steps);
  };

  const current = executed ? steps[Math.min(stepIndex, steps.length - 1)] : undefined;
  const done = executed && stepIndex >= steps.length - 1;
  const emptyRevealed = useMemo(() => new Array(opening.board.width * opening.board.height).fill(false), [opening]);
  const showAllMines = done && (current?.action === "solved" || current?.action === "exploded");
  const explodedAt = done && current?.action === "exploded" ? (current.indices[0] ?? null) : null;
  const probabilities = useProbability && current?.probabilities ? mapFromSparse(current.probabilities) : null;

  const overlay = done && current
    ? current.action === "solved"
      ? { title: "RESOLVIDO", subtitle: "Todas as células seguras foram reveladas" }
      : current.action === "exploded"
        ? { title: "BOOM!", subtitle: "O palpite acertou uma mina" }
        : current.action === "stuck"
          ? { title: "TRAVOU", subtitle: "Nenhuma dedução lógica disponível" }
          : null
    : null;

  return (
    <div className="canvas-body">
      <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(224,85,95,0.06),transparent_60%)]">
        <StageHint>
          PASSO <b className="readout-glow font-semibold text-primary">{executed ? stepIndex + 1 : 0}</b>
          {" / "}
          {steps.length}
          {current && (
            <>
              {" · "}
              <b className="readout-glow font-semibold text-primary">{actionLabel(current.action).toUpperCase()}</b>
              {" · "}
              <b className="readout-glow font-semibold text-primary">{current.cellsRevealed} REVELADAS</b>
            </>
          )}
        </StageHint>

        <div className="flex h-full w-full items-center justify-center">
          <MinesweeperGrid
            board={opening.board}
            revealed={current ? current.revealed : emptyRevealed}
            flagged={current ? current.flagged : opening.flagged}
            adjacent={opening.instance.adjacent}
            mines={showAllMines ? opening.instance.mines : undefined}
            exploded={explodedAt}
            probabilities={probabilities}
            overlay={overlay}
          />
        </div>

        {!executed && (
          <div className="absolute inset-0 z-[2] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <button className="btn-pill btn-pill-primary" onClick={start}>
              <Icon name="play_arrow" className="text-[15px]" /> Executar
            </button>
          </div>
        )}
      </div>

      <StepControls
        index={executed ? stepIndex : 0}
        total={Math.max(steps.length - 1, 0)}
        onChange={(i) => {
          if (!executed) return;
          setPlaying(false);
          setStepIndex(i);
        }}
        playing={playing}
        onTogglePlay={() => setPlaying((p) => !p)}
        disabled={!executed}
      />
    </div>
  );
}
