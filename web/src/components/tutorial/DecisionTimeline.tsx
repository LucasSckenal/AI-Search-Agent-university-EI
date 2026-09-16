"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/shared/Panel";
import { StepNarration } from "@/components/tutorial/StepNarration";
import { MazeState, HeuristicId, buildMazeProblem, rc } from "@/lib/maze/model";
import { AlgorithmId, search } from "@/lib/core/search";
import { traceSearch, TraceStep } from "@/lib/core/search-trace";
import { explainSelection } from "@/lib/tutorial/explain";

/**
 * Clickable strip over the winning path (start -> ... -> goal): each node was a real expansion
 * step in `traceSearch()`, filtered down to just the ones lying on the final path and re-ordered
 * to match it - so every explanation comes from a real g/h/f/basis snapshot, never a guess.
 */
export function DecisionTimeline({
  maze,
  algorithm,
  heuristic,
  allowDiagonal,
}: {
  maze: MazeState;
  algorithm: AlgorithmId;
  heuristic: HeuristicId;
  allowDiagonal: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const { path, pathSteps } = useMemo(() => {
    const problem = buildMazeProblem(maze, { allowDiagonal, heuristic });
    const result = search(problem, algorithm, { maxNodes: 300_000 });
    if (!result.found) return { path: [] as number[], pathSteps: [] as TraceStep<number>[] };

    const gen = traceSearch(problem, algorithm);
    const byState = new Map<number, TraceStep<number>>();
    let next = gen.next();
    while (!next.done) {
      byState.set(next.value.current, next.value); // last write wins - keeps the isGoal terminal frame for the final node
      next = gen.next();
    }
    const steps = result.path.map((s) => byState.get(s)).filter((s): s is TraceStep<number> => Boolean(s));
    return { path: result.path, pathSteps: steps };
  }, [maze, algorithm, heuristic, allowDiagonal]);

  if (pathSteps.length === 0) {
    return <p className="text-xs text-on-surface-variant">Execute a simulação no passo anterior para gerar a linha do tempo de decisões.</p>;
  }

  const active = pathSteps[Math.min(activeIndex, pathSteps.length - 1)];
  const explanation = explainSelection(active, algorithm, maze);

  return (
    <div className="flex flex-col gap-4">
      <div className="lab-timeline-strip">
        {pathSteps.map((step, i) => {
          const [r, c] = rc(maze, step.current);
          return (
            <div key={`${step.current}-${i}`} className="flex items-center">
              {i > 0 && <span className="lab-timeline-connector" />}
              <button
                type="button"
                className={`lab-timeline-node ${i === activeIndex ? "active" : ""} ${step.isGoal ? "goal" : ""}`}
                onClick={() => setActiveIndex(i)}
                title={`(${r},${c})`}
              >
                {step.isGoal ? <Icon name="flag" className="text-[14px]" /> : i === 0 ? <Icon name="my_location" className="text-[14px]" /> : i}
              </button>
            </div>
          );
        })}
      </div>
      <StepNarration step={activeIndex + 1} total={pathSteps.length} title={explanation.title} reason={explanation.reason} />
      <p className="text-[11px] text-on-surface-variant">
        Caminho final: {path.length - 1} passos · {pathSteps.length} nós na linha do tempo.
      </p>
    </div>
  );
}
