"use client";

import { useState } from "react";
import { CspPresetPicker } from "@/components/tutorial/csp/CspPresetPicker";
import { CspComparisonPanel } from "@/components/tutorial/csp/CspComparisonPanel";
import { CSP_CHALLENGE_PRESETS } from "@/lib/tutorial/csp-presets";

/** Desafio: choose bigger and bigger boards and watch how much more Forward Checking's pruning
 *  saves as N grows. Reuses CspComparisonPanel, whose two solver calls stay cheap regardless of N
 *  for this range (a few hundred steps at N=12) since QueensCanvas never needs to render them all
 *  at once. */
export function CspChallengeStage() {
  const [presetId, setPresetId] = useState(CSP_CHALLENGE_PRESETS[CSP_CHALLENGE_PRESETS.length - 1].id);
  const preset = CSP_CHALLENGE_PRESETS.find((p) => p.id === presetId) ?? CSP_CHALLENGE_PRESETS[0];

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[65ch] text-[12.5px] leading-relaxed text-on-surface-variant">
        Escolha tabuleiros cada vez maiores e veja como a economia do Forward Checking cresce junto com N.
      </p>
      <CspPresetPicker presets={CSP_CHALLENGE_PRESETS} value={presetId} onChange={setPresetId} />
      <CspComparisonPanel n={preset.n} />
    </div>
  );
}
