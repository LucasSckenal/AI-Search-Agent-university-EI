"use client";

import { useMemo } from "react";
import { RlPreset, configFor, worldForPreset } from "@/lib/tutorial/rl-presets";
import { runRlComparison } from "@/lib/tutorial/rl-run";
import { compareRlInsight } from "@/lib/tutorial/rl-explain";

const FULL_EPISODES = 600; // /aprendizado's own default budget - the "give it enough experience" baseline

/** Runs Q-learning twice for the same preset - once at the tutorial's short budget, once at the
 *  full /aprendizado-default budget - against the same Value Iteration reference, and shows the
 *  real reward gap closing (or not) as a bar chart. The RL analog of AmComparisonPanel/CspComparisonPanel. */
export function RlComparisonPanel({ preset, shortEpisodes }: { preset: RlPreset; shortEpisodes: number }) {
  const shortRun = useMemo(() => runRlComparison(worldForPreset(preset), configFor(preset, shortEpisodes)), [preset, shortEpisodes]);
  const fullRun = useMemo(() => runRlComparison(worldForPreset(preset), configFor(preset, FULL_EPISODES)), [preset]);

  const insight = compareRlInsight(shortRun.qRollout, fullRun.qRollout, shortRun.viRollout, shortEpisodes, FULL_EPISODES);

  const bars: { label: string; value: number; color: string }[] = [
    { label: `Q-learning (${shortEpisodes} episódios)`, value: shortRun.qRollout.reward, color: "#ff9b9b" },
    { label: `Q-learning (${FULL_EPISODES} episódios)`, value: fullRun.qRollout.reward, color: "#ffb77b" },
    { label: "Iteração de Valor (ótimo)", value: shortRun.viRollout.reward, color: "#7ee0a8" },
  ];
  const maxAbs = Math.max(...bars.map((b) => Math.abs(b.value)), 0.01);

  return (
    <div className="flex flex-col gap-5">
      <div className="lab-bars">
        {bars.map((b) => (
          <div key={b.label} className="lab-bars-col">
            <span className="lab-bars-value">{b.value.toFixed(2)}</span>
            <div className="lab-bars-fill" style={{ height: `${Math.max(4, (Math.max(b.value, 0) / maxAbs) * 100)}%`, background: b.color }} />
            <span className="lab-bars-label">{b.label}</span>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-4 text-[13px] leading-relaxed text-on-surface">
        <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 align-middle text-[11px] text-primary">★</span>
        {insight}
      </div>
    </div>
  );
}
