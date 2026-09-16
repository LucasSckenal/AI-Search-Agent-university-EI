"use client";

import { useMemo } from "react";
import { GaConvergenceChart } from "@/components/shared/GaConvergenceChart";
import { GA_PRESETS, presetToConfig } from "@/lib/tutorial/ga-presets";
import { runGaFull } from "@/lib/tutorial/ga-run";
import { compareConfigInsight, generationSolved } from "@/lib/tutorial/ga-explain";

const PRESET_COLOR: Record<string, string> = {
  "baixa-mutacao": "#afc6ff",
  padrao: "#7ee0a8",
  "alta-mutacao": "#ff9b9b",
  "populacao-pequena": "#ffb77b",
};

/** Runs all 4 real presets on the same problem/seed and renders a convergence-generation bar chart
 *  + a grid of real per-preset convergence charts + a computed (never invented) insight sentence -
 *  the GA analog of ComparisonPanel for search. */
export function GaComparisonPanel({ chosen }: { chosen: string }) {
  const entries = useMemo(() => GA_PRESETS.map((preset) => ({ preset, result: runGaFull(presetToConfig(preset)) })), []);

  const solvedAtByPreset = entries.map((e) => ({ preset: e.preset, solvedAt: generationSolved(e.result) }));
  const maxGen = Math.max(1, ...entries.map((e) => e.result.generations.length));
  const insight = compareConfigInsight(entries, chosen);

  return (
    <div className="flex flex-col gap-5">
      <div className="lab-bars">
        {solvedAtByPreset.map(({ preset, solvedAt }) => (
          <div key={preset.id} className="lab-bars-col">
            <span className="lab-bars-value">{solvedAt !== null ? `gen. ${solvedAt}` : "não convergiu"}</span>
            <div
              className="lab-bars-fill"
              style={{
                height: `${Math.max(4, ((solvedAt ?? maxGen) / maxGen) * 100)}%`,
                background: PRESET_COLOR[preset.id],
                opacity: solvedAt === null ? 0.4 : 1,
                outline: preset.id === chosen ? `2px solid ${PRESET_COLOR[preset.id]}` : undefined,
                outlineOffset: 2,
              }}
            />
            <span className="lab-bars-label">{preset.label}</span>
          </div>
        ))}
      </div>

      {insight && (
        <div className="glass rounded-2xl p-4 text-[13px] leading-relaxed text-on-surface">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 align-middle text-[11px] text-primary">★</span>
          {insight}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {entries.map(({ preset, result }) => (
          <div key={preset.id} className="workspace-card !rounded-2xl p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">{preset.label}</p>
            <GaConvergenceChart generations={result.generations} />
          </div>
        ))}
      </div>
    </div>
  );
}
