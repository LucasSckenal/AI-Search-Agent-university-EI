"use client";

import { Icon } from "@/components/shared/Panel";

export type TopStage = "conceito" | "funcionamento" | "experimento" | "analise" | "desafio";

export const TOP_STAGES: { id: TopStage; num: string; label: string }[] = [
  { id: "conceito", num: "01", label: "Conceito" },
  { id: "funcionamento", num: "02", label: "Funcionamento" },
  { id: "experimento", num: "03", label: "Experimento" },
  { id: "analise", num: "04", label: "Análise" },
  { id: "desafio", num: "05", label: "Desafio" },
];

/** Top progress bar - navigation is always free (every stage is clickable), `visited` just marks
 *  which ones the user has already reached so revisiting reads differently from a fresh stage. */
export function LessonStepper({
  current,
  visited,
  onSelect,
}: {
  current: TopStage;
  visited: Set<TopStage>;
  onSelect: (stage: TopStage) => void;
}) {
  return (
    <nav className="lab-stepper" aria-label="Progresso da aula">
      {TOP_STAGES.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1">
          {i > 0 && <Icon name="chevron_right" className="lab-stepper-arrow" />}
          <button
            type="button"
            className={`lab-stepper-item ${current === s.id ? "active" : ""} ${visited.has(s.id) ? "done" : ""}`}
            onClick={() => onSelect(s.id)}
          >
            <span className="lab-stepper-num">{visited.has(s.id) && current !== s.id ? <Icon name="check" className="text-[11px]" /> : s.num}</span>
            {s.label}
          </button>
        </div>
      ))}
    </nav>
  );
}
