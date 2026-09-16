"use client";

import { useState } from "react";
import { Icon } from "@/components/shared/Panel";
import { StepNarration } from "@/components/tutorial/StepNarration";
import { MiniBoard } from "@/components/tutorial/am/MiniBoard";
import { MinimaxTrace, extractPrincipalVariation } from "@/lib/tutorial/am-trace-run";
import { explainNode } from "@/lib/tutorial/am-explain";

/** Clickable strip over the real principal variation (the actual optimal continuation from root to
 *  a terminal position, reconstructed from the trace's own resolved scores) - each stop narrated via
 *  explainNode(). Mirrors DecisionTimeline (search) / GenerationTimeline (GA) for this family. */
export function PlyTimeline({ trace }: { trace: MinimaxTrace | null }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!trace) {
    return <p className="text-xs text-on-surface-variant">Execute a simulação no passo anterior para gerar a linha do tempo da decisão.</p>;
  }

  const pv = extractPrincipalVariation(trace.nodes);
  const active = pv[Math.min(activeIndex, pv.length - 1)];
  const explanation = explainNode(active);

  return (
    <div className="flex flex-col gap-4">
      <div className="lab-timeline-strip">
        {pv.map((n, i) => (
          <div key={n.id} className="flex items-center">
            {i > 0 && <span className="lab-timeline-connector" />}
            <button
              type="button"
              className={`lab-timeline-node ${i === activeIndex ? "active" : ""} ${n.terminal ? "goal" : ""}`}
              onClick={() => setActiveIndex(i)}
              title={i === 0 ? "Posição inicial" : `Jogada ${i}`}
            >
              {n.terminal ? <Icon name="flag" className="text-[14px]" /> : i}
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-start gap-3 sm:flex-row">
        <MiniBoard board={active.board} cellPx={30} />
        <div className="flex-1">
          <StepNarration step={activeIndex + 1} total={pv.length} title={explanation.title} reason={explanation.reason} />
        </div>
      </div>
    </div>
  );
}
