"use client";

import { useState } from "react";
import { Icon } from "@/components/shared/Panel";
import { StepNarration } from "@/components/tutorial/StepNarration";
import { GaRunResult } from "@/lib/core/genetic";
import { Genome } from "@/lib/algoritmo-genetico/model";
import { explainGeneration, generationSolved } from "@/lib/tutorial/ga-explain";

/** Clickable strip over every generation of a real run (see RealSimulationStage's onResult) - each
 *  explanation comes from real best/mean/worst/std fitness deltas between consecutive generations,
 *  never a guess. Mirrors DecisionTimeline's shape for the search family. */
export function GenerationTimeline({ result }: { result: GaRunResult<Genome> | null }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!result) {
    return <p className="text-xs text-on-surface-variant">Execute a simulação no passo anterior para gerar a linha do tempo de gerações.</p>;
  }

  const solvedAt = generationSolved(result);
  const active = result.generations[Math.min(activeIndex, result.generations.length - 1)];
  const prev = activeIndex > 0 ? result.generations[activeIndex - 1] : null;
  const explanation = explainGeneration(active, prev);

  return (
    <div className="flex flex-col gap-4">
      <div className="lab-timeline-strip">
        {result.generations.map((g, i) => (
          <div key={g.generation} className="flex items-center">
            {i > 0 && <span className="lab-timeline-connector" />}
            <button
              type="button"
              className={`lab-timeline-node ${i === activeIndex ? "active" : ""} ${solvedAt === i ? "goal" : ""}`}
              onClick={() => setActiveIndex(i)}
              title={`Geração ${g.generation}`}
            >
              {solvedAt === i ? <Icon name="flag" className="text-[14px]" /> : i}
            </button>
          </div>
        ))}
      </div>
      <StepNarration step={activeIndex + 1} total={result.generations.length} title={explanation.title} reason={explanation.reason} />
      <p className="text-[11px] text-on-surface-variant">
        {solvedAt !== null ? `Chegou perto do alvo na geração ${solvedAt}.` : "Não chegou perto do alvo dentro do orçamento de gerações."} Fitness final:{" "}
        {result.bestEverFitness.toFixed(2)}.
      </p>
    </div>
  );
}
