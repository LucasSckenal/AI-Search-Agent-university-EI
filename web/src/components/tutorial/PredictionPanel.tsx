"use client";

import { Icon } from "@/components/shared/Panel";
import { MiniGrid2D } from "@/components/tutorial/MiniGrid2D";
import { MazeState } from "@/lib/maze/model";

export interface PredictionCandidate {
  id: string;
  label: string;
  path: number[];
  cost: number;
}

/**
 * Candidate paths are always real - the caller runs actual algorithms on the actual maze and
 * passes their real `path`/`cost` here (see busca/page.tsx's candidate-building logic), never
 * hand-drawn routes. Cost stays hidden until `revealed` so picking isn't just "read the smallest
 * number" for UCS/A*; step count is visible throughout since it's plain to see from the drawn path
 * anyway (and is exactly what a BFS prediction should reason about).
 */
export function PredictionPanel({
  maze,
  candidates,
  selectedId,
  onSelect,
  revealed,
  correctId,
}: {
  maze: MazeState;
  candidates: PredictionCandidate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  revealed: boolean;
  correctId: string | null;
}) {
  return (
    <div className="lab-prediction-grid">
      {candidates.map((c) => {
        const isSelected = selectedId === c.id;
        const isCorrect = revealed && c.id === correctId;
        const isWrongSelection = revealed && isSelected && c.id !== correctId;
        const classes = ["lab-prediction-card"];
        if (isCorrect) classes.push("correct");
        else if (isWrongSelection) classes.push("wrong");
        else if (isSelected) classes.push("selected");
        return (
          <button key={c.id} type="button" disabled={revealed} className={classes.join(" ")} onClick={() => onSelect(c.id)}>
            <MiniGrid2D maze={maze} path={c.path} cellPx={Math.max(4, Math.min(10, 220 / maze.cols))} />
            <span className="lab-prediction-label">
              {c.label}
              {revealed && c.id === correctId && <Icon name="check_circle" className="ml-1.5 align-middle text-[14px] text-primary" />}
            </span>
            <span className="lab-prediction-meta">
              <span>{c.path.length - 1} passos</span>
              <span>custo {revealed ? c.cost.toFixed(1) : "?"}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
