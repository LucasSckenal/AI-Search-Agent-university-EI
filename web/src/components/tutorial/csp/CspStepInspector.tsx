"use client";

import { useState } from "react";
import { StepControls } from "@/components/tutorial/StepControls";
import { StepNarration } from "@/components/tutorial/StepNarration";
import { QueensStep } from "@/lib/queens/model";
import { explainStep } from "@/lib/tutorial/csp-explain";

/** Scrubs through the exact same real trace RealSimulationStage just executed (passed down via the
 *  page's onResult), narrating each step from its own action/col/domains fields. A dot-strip like
 *  the other labs' decision timelines doesn't fit here - a run can be anywhere from a dozen to a few
 *  hundred steps depending on N, so this reuses StepControls' scrubber instead of a fixed-length
 *  strip, the same widget the real-execution stage itself uses. */
export function CspStepInspector({ steps, n }: { steps: QueensStep[] | null; n: number }) {
  const [index, setIndex] = useState(0);

  if (!steps || steps.length === 0) {
    return <p className="text-xs text-on-surface-variant">Execute a simulação no passo anterior para inspecionar cada passo.</p>;
  }

  const clamped = Math.min(index, steps.length - 1);
  const step = steps[clamped];
  const prev = clamped > 0 ? steps[clamped - 1] : null;
  const explanation = explainStep(step, prev, n);

  return (
    <div className="flex flex-col gap-4">
      <StepControls index={clamped} total={steps.length - 1} onChange={setIndex} />
      <StepNarration step={clamped + 1} total={steps.length} title={explanation.title} reason={explanation.reason} />
    </div>
  );
}
