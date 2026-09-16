"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/shared/Panel";
import { StageHint } from "@/components/shared/Stage";
import { WebGLGate } from "@/components/shared/WebGLGate";
import { StepControls } from "@/components/tutorial/StepControls";
import { MiniBoard } from "@/components/tutorial/am/MiniBoard";
import { AM_GAME_CONFIG, AmPreset } from "@/lib/tutorial/am-presets";
import { runMinimaxTrace, MinimaxTrace } from "@/lib/tutorial/am-trace-run";
import { playerLabel } from "@/lib/tutorial/am-explain";

const MinimaxTree3D = dynamic(() => import("@/components/minimax/MinimaxTree3D").then((m) => m.MinimaxTree3D), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">
      Carregando árvore 3D…
    </div>
  ),
});

/**
 * The lab's real-execution stage for the adversarial-search family - gated behind an [EXECUTAR]
 * button, then reveals the real traceMinimax() run node by node on the 3D tree (the same component
 * /minimax uses), with a StageHint readout of node count/depth/value/pruned. `preset` is a stable
 * object reference from AM_PRESETS (looked up by id, never rebuilt per render), so unlike an
 * inline-constructed config object it never spuriously changes identity between renders.
 */
export function RealSimulationStage({
  preset,
  useAlphaBeta,
  onResult,
}: {
  preset: AmPreset;
  useAlphaBeta: boolean;
  onResult?: (trace: MinimaxTrace) => void;
}) {
  const [executed, setExecuted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const trace = useMemo(() => runMinimaxTrace(preset.board, preset.player, AM_GAME_CONFIG, useAlphaBeta), [preset, useAlphaBeta]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new position/pruning combo needs a fresh, un-executed run
    setExecuted(false);
    setStepIndex(0);
    setPlaying(false);
  }, [trace]);

  useEffect(() => {
    if (!playing) return;
    if (stepIndex >= trace.nodes.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStepIndex((i) => Math.min(i + 1, trace.nodes.length - 1)), 120);
    return () => clearTimeout(t);
  }, [playing, stepIndex, trace]);

  const start = () => {
    setExecuted(true);
    setStepIndex(0);
    setPlaying(trace.nodes.length > 1);
    onResult?.(trace);
  };

  // Mounted unconditionally (even pre-execution, with revealCount 0) - like the GA lab's population
  // arena, swapping this for a placeholder div before execution collapses the whole flex chain to
  // zero height, since a plain div has no intrinsic content to size around.
  const revealCount = executed ? stepIndex + 1 : 0;
  const current = executed ? trace.nodes[Math.min(stepIndex, trace.nodes.length - 1)] : undefined;
  const done = executed && stepIndex >= trace.nodes.length - 1;

  return (
    <div className="canvas-body">
      <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(126,168,245,0.06),transparent_60%)]">
        <StageHint>
          NÓ <b className="readout-glow font-semibold text-primary">{revealCount}</b>
          {" / "}
          {trace.nodes.length}
          {current && !current.pruned && (
            <>
              {" · PROFUNDIDADE "}
              <b className="readout-glow font-semibold text-primary">{current.depth}</b>
              {current.score !== null && (
                <>
                  {" · VALOR "}
                  <b className="readout-glow font-semibold text-primary">{current.score}</b>
                </>
              )}
            </>
          )}
          {current?.pruned && (
            <>
              {" · "}
              <b className="readout-glow font-semibold text-primary">RAMO PODADO</b>
            </>
          )}
          {done && (
            <>
              {" · "}
              <b className="readout-glow font-semibold text-primary">
                {trace.result.nodesExplored} NÓS · {trace.result.prunedCount} PODADOS
              </b>
            </>
          )}
        </StageHint>

        {executed && current && (
          // Top-right, not top-left - StageHint already owns the top-left corner (left-4/top-4),
          // and its readout text can run long enough (node/pruned counts once done) to overlap a
          // board placed there too.
          <div className="pointer-events-none absolute right-3 top-3 z-[1] flex flex-col items-end gap-1.5">
            <MiniBoard board={current.board} cellPx={20} />
            {!current.terminal && !current.pruned && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-on-surface-variant">
                vez de {playerLabel(current.toMove)}
              </span>
            )}
          </div>
        )}

        <WebGLGate>
          <MinimaxTree3D nodes={trace.nodes} revealCount={revealCount} bestMove={done ? trace.result.move : null} />
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
        total={Math.max(trace.nodes.length - 1, 0)}
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
