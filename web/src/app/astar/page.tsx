"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/shared/Panel";
import { Select } from "@/components/shared/Select";
import { Toggle } from "@/components/shared/Toggle";
import { StageHint } from "@/components/shared/Stage";
import { Timeline } from "@/components/shared/Timeline";
import { WebGLGate } from "@/components/shared/WebGLGate";
import { HeuristicId, MazeState, generatePerfectMaze, buildMazeProblem, rc } from "@/lib/maze/model";
import { traceAstar, AstarStep, AstarTraceResult } from "@/lib/astar/trace";
import { seededRng, randomSeed } from "@/lib/core/rng";

const MazeCanvas = dynamic(() => import("@/components/maze/Maze3D").then((m) => m.MazeCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">
      Carregando labirinto 3D…
    </div>
  ),
});

const ROWS = 11;
const COLS = 15;
// Trailing "..." keeps a per-step readout from jumping wildly in width as f-values change digits.
const FRONTIER_SHOWN = 6;

function generateMaze(): MazeState {
  return generatePerfectMaze(ROWS, COLS, seededRng(randomSeed()));
}

export default function AstarPage() {
  const [maze, setMaze] = useState<MazeState>(() => generateMaze());
  const [heuristic, setHeuristic] = useState<HeuristicId>("manhattan");
  const [allowDiagonal, setAllowDiagonal] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const trace = useMemo(() => {
    const problem = buildMazeProblem(maze, { allowDiagonal, heuristic });
    const gen = traceAstar(problem);
    const steps: AstarStep<number>[] = [];
    let next = gen.next();
    while (!next.done) {
      steps.push(next.value);
      next = gen.next();
    }
    return { steps, result: next.value as AstarTraceResult<number, unknown> };
  }, [maze, allowDiagonal, heuristic]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new maze/heuristic/diagonal combo needs a fresh trace from step 0, not a sync with external state
    setStepIndex(0);
    setPlaying(false);
  }, [trace]);

  useEffect(() => {
    if (!playing) return;
    if (stepIndex >= trace.steps.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStepIndex((i) => Math.min(i + Math.max(1, speed), trace.steps.length - 1)), 16);
    return () => clearTimeout(t);
  }, [playing, stepIndex, speed, trace]);

  const regenerate = () => setMaze(generateMaze());

  const current = trace.steps[Math.min(stepIndex, trace.steps.length - 1)] as AstarStep<number> | undefined;
  const pathRevealed = stepIndex >= trace.steps.length - 1;

  const visited = useMemo(
    () => new Set(trace.steps.slice(0, stepIndex + 1).map((s) => s.current)),
    [trace, stepIndex]
  );
  const frontier = useMemo(() => new Set(current?.frontier.map((f) => f.state) ?? []), [current]);
  const path = pathRevealed && trace.result.found ? (trace.result.path as number[]) : [];

  const status = playing ? "EXPLORANDO" : pathRevealed ? "CONCLUÍDO" : "PRONTO";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>A*</span>
            <span>/</span>
            <span className="accent">Busca Informada</span>
          </div>
          <h1 className="content-title">Busca A*</h1>
          <p className="content-sub">
            A* expande, a cada passo, o nó de menor f = g + h da fronteira - g é o custo real já
            percorrido, h é uma estimativa (heurística) do custo restante até o objetivo. Com uma
            heurística admissível (nunca superestima), A* garante o caminho de menor custo
            expandindo bem menos nós do que uma busca cega. Veja a fronteira (fila de prioridade)
            ao vivo, nó a nó, decidindo qual expandir a seguir.
          </p>
        </div>
        <div className="content-actions">
          <button className="btn-pill btn-pill-primary" onClick={regenerate}>
            <Icon name="refresh" className="text-[15px]" /> Novo labirinto
          </button>
        </div>
      </div>

      <div className="workspace-card">
        <div className="workspace-head">
          <Select
            value={heuristic}
            onChange={(v) => setHeuristic(v as HeuristicId)}
            className="!w-auto shrink-0"
            options={[
              ...(allowDiagonal ? [] : [{ value: "manhattan", label: "Heurística: Manhattan" }]),
              { value: "euclidean", label: "Heurística: Euclidiana" },
              { value: "chebyshev", label: "Heurística: Chebyshev" },
              { value: "octile", label: "Heurística: Octile" },
            ]}
          />
          <div className="workspace-links">
            <Toggle checked={allowDiagonal} onChange={setAllowDiagonal} label="Diagonais" />
          </div>
        </div>

        <div className="canvas-body">
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(126,168,245,0.06),transparent_60%)]">
            <StageHint>
              PASSO <b className="readout-glow font-semibold text-primary">{stepIndex}</b>
              {" / "}
              {Math.max(trace.steps.length - 1, 0)}
              {current && (
                <>
                  {" · NÓ ATUAL g="}
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
                    {trace.result.found ? `CAMINHO ÓTIMO · CUSTO ${trace.result.cost.toFixed(1)}` : "SEM CAMINHO"}
                  </b>
                </>
              )}
            </StageHint>

            <WebGLGate>
              <MazeCanvas maze={maze} visited={visited} path={path} pathRevealed={pathRevealed} frontier={frontier} />
            </WebGLGate>
          </div>

          <div className="flex shrink-0 items-center gap-2 overflow-x-auto bg-background px-4 py-2.5 sm:px-5">
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-on-surface-variant/70">
              Fronteira
            </span>
            {current && current.frontier.length > 0 ? (
              current.frontier.slice(0, FRONTIER_SHOWN).map((entry, i) => {
                const [r, c] = rc(maze, entry.state);
                return (
                  <span
                    key={entry.state}
                    className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10.5px] ${
                      i === 0 ? "border-primary/50 bg-primary/15 text-primary" : "border-white/10 bg-white/5 text-on-surface-variant"
                    }`}
                  >
                    ({r},{c}) f={entry.f.toFixed(1)}
                  </span>
                );
              })
            ) : (
              <span className="font-mono text-[10.5px] text-on-surface-variant/60">
                {pathRevealed ? "busca encerrada" : "—"}
              </span>
            )}
            {current && current.frontier.length > FRONTIER_SHOWN && (
              <span className="shrink-0 font-mono text-[10.5px] text-on-surface-variant/60">
                +{current.frontier.length - FRONTIER_SHOWN}
              </span>
            )}
          </div>

          <Timeline
            status={status}
            pulsing={playing}
            playing={playing}
            onTogglePlay={() => setPlaying((p) => !p)}
            onSkipEnd={() => {
              setStepIndex(trace.steps.length - 1);
              setPlaying(false);
            }}
            current={stepIndex}
            total={Math.max(trace.steps.length - 1, 0)}
            unitLabel="passos"
            disabled={trace.steps.length === 0}
            speed={speed}
            onSpeedChange={setSpeed}
            speedLabel="Velocidade"
            speedMax={8}
          />
        </div>
      </div>
    </div>
  );
}
