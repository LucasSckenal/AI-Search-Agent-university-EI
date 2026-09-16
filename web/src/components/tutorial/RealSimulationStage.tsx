"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/shared/Panel";
import { StageHint } from "@/components/shared/Stage";
import { WebGLGate } from "@/components/shared/WebGLGate";
import { StepControls } from "@/components/tutorial/StepControls";
import { MazeState, HeuristicId, Direction, buildMazeProblem } from "@/lib/maze/model";
import { search, AlgorithmId, SearchResult } from "@/lib/core/search";
import { traceSearch, TraceStep } from "@/lib/core/search-trace";

const MazeCanvas = dynamic(() => import("@/components/maze/Maze3D").then((m) => m.MazeCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">
      Carregando labirinto 3D…
    </div>
  ),
});

const TICK_MS = 260;

/**
 * The lab's real-execution stage: gated behind an [EXECUTAR] button (nothing runs until the user
 * has made a prediction and asks for it), then plays `search()`'s real result on the actual 3D
 * maze while `traceSearch()` drives a per-step readout - both real executions, never staged
 * numbers. Reused for the final challenge (step 08) with a different maze.
 */
export function RealSimulationStage({
  maze,
  algorithm,
  heuristic,
  allowDiagonal,
  onResult,
  onStep,
}: {
  maze: MazeState;
  algorithm: AlgorithmId;
  heuristic: HeuristicId;
  allowDiagonal: boolean;
  onResult?: (result: SearchResult<number, Direction>) => void;
  onStep?: (step: TraceStep<number> | undefined) => void;
}) {
  const [executed, setExecuted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const problem = useMemo(() => buildMazeProblem(maze, { allowDiagonal, heuristic }), [maze, allowDiagonal, heuristic]);
  const officialResult = useMemo(() => search(problem, algorithm, { maxNodes: 300_000 }), [problem, algorithm]);
  const trace = useMemo(() => {
    const gen = traceSearch(problem, algorithm);
    const steps: TraceStep<number>[] = [];
    let next = gen.next();
    while (!next.done) {
      steps.push(next.value);
      next = gen.next();
    }
    return steps;
  }, [problem, algorithm]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new maze/algorithm combo needs a fresh, un-executed run, not a sync with external state
    setExecuted(false);
    setStepIndex(0);
    setPlaying(false);
  }, [problem, algorithm]);

  useEffect(() => {
    if (!playing) return;
    if (stepIndex >= trace.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStepIndex((i) => Math.min(i + 1, trace.length - 1)), TICK_MS);
    return () => clearTimeout(t);
  }, [playing, stepIndex, trace]);

  const current = trace[Math.min(stepIndex, trace.length - 1)] as TraceStep<number> | undefined;

  useEffect(() => {
    onStep?.(executed ? current : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executed, current]);

  const run = () => {
    setExecuted(true);
    setStepIndex(0);
    setPlaying(trace.length > 1);
    onResult?.(officialResult);
  };

  const pathRevealed = executed && stepIndex >= trace.length - 1;
  const visited = useMemo(
    () => (executed ? new Set(trace.slice(0, stepIndex + 1).map((s) => s.current)) : new Set<number>()),
    [executed, trace, stepIndex]
  );
  const frontier = useMemo(() => new Set(executed && current ? current.frontier.map((f) => f.state) : []), [executed, current]);
  const path = pathRevealed && officialResult.found ? officialResult.path : [];

  return (
    <div className="canvas-body">
      <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(175,198,255,0.06),transparent_60%)]">
        <StageHint>
          PASSO <b className="readout-glow font-semibold text-primary">{executed ? stepIndex : 0}</b>
          {" / "}
          {Math.max(trace.length - 1, 0)}
          {executed && current && (
            <>
              {" · g="}
              <b className="readout-glow font-semibold text-primary">{current.g.toFixed(1)}</b>
              {" h="}
              <b className="readout-glow font-semibold text-primary">{current.h.toFixed(1)}</b>
              {" f="}
              <b className="readout-glow font-semibold text-primary">{current.f.toFixed(1)}</b>
            </>
          )}
          {pathRevealed && (
            <>
              {" · "}
              <b className="readout-glow font-semibold text-primary">
                {officialResult.found
                  ? `CUSTO ${officialResult.cost.toFixed(1)} · ${officialResult.nodesExpanded} NÓS EXPANDIDOS`
                  : "SEM CAMINHO"}
              </b>
            </>
          )}
        </StageHint>

        <WebGLGate>
          <MazeCanvas maze={maze} visited={visited} path={path} pathRevealed={pathRevealed} frontier={frontier} />
        </WebGLGate>

        {!executed && (
          <div className="absolute inset-0 z-[2] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <button className="btn-pill btn-pill-primary" onClick={run}>
              <Icon name="play_arrow" className="text-[15px]" /> Executar
            </button>
          </div>
        )}
      </div>

      <StepControls
        index={executed ? stepIndex : 0}
        total={Math.max(trace.length - 1, 0)}
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
