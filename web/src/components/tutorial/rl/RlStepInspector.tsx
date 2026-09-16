"use client";

import { useState } from "react";
import { StepControls } from "@/components/tutorial/StepControls";
import { StepNarration } from "@/components/tutorial/StepNarration";
import { RlRun } from "@/lib/tutorial/rl-run";
import { explainSnapshot } from "@/lib/tutorial/rl-explain";

/** Scrubs through the exact same qTableSnapshots RealSimulationStage just executed (passed down via
 *  the page's onResult), narrating what the greedy policy learned by that point would actually do -
 *  computed live via a real rollout each time, never invented. */
export function RlStepInspector({ run }: { run: RlRun | null }) {
  const [index, setIndex] = useState(0);

  if (!run) {
    return <p className="text-xs text-on-surface-variant">Execute a simulação no passo anterior para inspecionar cada episódio.</p>;
  }

  const snapshots = run.q.qTableSnapshots;
  const clamped = Math.min(index, snapshots.length - 1);
  const snapshot = snapshots[clamped];
  const explanation = explainSnapshot(run.world, snapshot, run.q.episodes, run.config.maxStepsPerEpisode);

  return (
    <div className="flex flex-col gap-4">
      <StepControls index={clamped} total={snapshots.length - 1} onChange={setIndex} />
      <StepNarration step={clamped + 1} total={snapshots.length} title={explanation.title} reason={explanation.reason} />
    </div>
  );
}
