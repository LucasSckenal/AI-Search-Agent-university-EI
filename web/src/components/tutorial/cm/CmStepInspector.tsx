"use client";

import { useState } from "react";
import { StepControls } from "@/components/tutorial/StepControls";
import { StepNarration } from "@/components/tutorial/StepNarration";
import { MinesweeperStep } from "@/lib/campo-minado/model";
import { explainStep } from "@/lib/tutorial/cm-explain";

/** Scrubs through the exact same real trace RealSimulationStage just executed (passed down via the
 *  page's onResult), narrating each step from its own `reason` field - already a fully grounded,
 *  human-readable explanation, never re-derived. */
export function CmStepInspector({ steps }: { steps: MinesweeperStep[] | null }) {
  const [index, setIndex] = useState(0);

  if (!steps || steps.length === 0) {
    return <p className="text-xs text-on-surface-variant">Execute a simulação no passo anterior para inspecionar cada passo.</p>;
  }

  const clamped = Math.min(index, steps.length - 1);
  const step = steps[clamped];
  const explanation = explainStep(step);

  return (
    <div className="flex flex-col gap-4">
      <StepControls index={clamped} total={steps.length - 1} onChange={setIndex} />
      <StepNarration step={clamped + 1} total={steps.length} title={explanation.title} reason={explanation.reason} />
    </div>
  );
}
