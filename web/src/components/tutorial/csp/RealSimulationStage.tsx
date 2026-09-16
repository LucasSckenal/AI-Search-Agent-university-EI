"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/shared/Panel";
import { StageHint } from "@/components/shared/Stage";
import { WebGLGate } from "@/components/shared/WebGLGate";
import { StepControls } from "@/components/tutorial/StepControls";
import { backtrackingSteps, forwardCheckingSteps, QueensStep } from "@/lib/queens/model";

const QueensCanvas = dynamic(() => import("@/components/queens/QueensCanvas").then((m) => m.QueensCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">
      Carregando tabuleiro 3D…
    </div>
  ),
});

/**
 * The lab's real-execution stage for the CSP family - gated behind an [EXECUTAR] button, then
 * reveals the real backtrackingSteps()/forwardCheckingSteps() run step by step on the 3D board (the
 * same component /rainhas uses), scrubbed with StepControls. Unlike the adversarial-search lab's
 * game tree, QueensCanvas only ever renders the CURRENT board - no cumulative growth, so a run with
 * hundreds of steps is just a wider scrub range, never a rendering-cost concern.
 */
export function RealSimulationStage({
  n,
  useForwardChecking,
  onResult,
}: {
  n: number;
  useForwardChecking: boolean;
  onResult?: (steps: QueensStep[]) => void;
}) {
  const [executed, setExecuted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const steps = useMemo(() => (useForwardChecking ? forwardCheckingSteps(n) : backtrackingSteps(n)), [n, useForwardChecking]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new size/technique needs a fresh, un-executed run
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
    const t = setTimeout(() => setStepIndex((i) => Math.min(i + 1, steps.length - 1)), 60);
    return () => clearTimeout(t);
  }, [playing, stepIndex, steps]);

  const start = () => {
    setExecuted(true);
    setStepIndex(0);
    setPlaying(steps.length > 1);
    onResult?.(steps);
  };

  // Mounted unconditionally (even pre-execution, with an all-empty board) - like the other labs'
  // stages, swapping this for a placeholder div before execution collapses the whole flex chain to
  // zero height, since a plain div has no intrinsic content to size around.
  const current = executed ? steps[Math.min(stepIndex, steps.length - 1)] : undefined;
  const emptyBoard = useMemo(() => new Array(n).fill(-1), [n]);
  const done = executed && stepIndex >= steps.length - 1;

  return (
    <div className="canvas-body">
      <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(126,224,168,0.06),transparent_60%)]">
        <StageHint>
          PASSO <b className="readout-glow font-semibold text-primary">{executed ? stepIndex + 1 : 0}</b>
          {" / "}
          {steps.length}
          {current && (
            <>
              {" · COLUNA "}
              <b className="readout-glow font-semibold text-primary">{current.col}</b>
              {" · "}
              <b className="readout-glow font-semibold text-primary">
                {current.action === "place" ? "COLOCAR" : current.action === "backtrack" ? "RETROCEDER" : "RESOLVIDO"}
              </b>
              {" · "}
              <b className="readout-glow font-semibold text-primary">{current.nodesExpanded} NÓS</b>
              {" · "}
              <b className="readout-glow font-semibold text-primary">{current.backtracks} RETROCESSOS</b>
            </>
          )}
        </StageHint>

        <WebGLGate>
          <QueensCanvas
            n={n}
            board={current ? current.board : emptyBoard}
            domains={current?.domains}
            frontierCol={current?.col}
            solved={done && current?.action === "solved"}
          />
        </WebGLGate>

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
