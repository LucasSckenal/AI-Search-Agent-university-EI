"use client";

import { useState } from "react";
import { CmPresetPicker } from "@/components/tutorial/cm/CmPresetPicker";
import { CmComparisonPanel } from "@/components/tutorial/cm/CmComparisonPanel";
import { CM_PRESETS } from "@/lib/tutorial/cm-presets";

/** Desafio: choose bigger and bigger boards and see whether the same "logic stalls, probability
 *  takes over" story holds - and how much riskier the calculated guesses get. Reuses
 *  CmComparisonPanel, whose two solver calls stay cheap for this range (a few hundred steps at
 *  most even on Avançado). */
export function CmChallengeStage() {
  const [presetId, setPresetId] = useState(CM_PRESETS[CM_PRESETS.length - 1].id);
  const preset = CM_PRESETS.find((p) => p.id === presetId) ?? CM_PRESETS[0];

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[65ch] text-[12.5px] leading-relaxed text-on-surface-variant">
        Escolha tabuleiros cada vez maiores e veja se a lógica trava mais cedo, e o quão arriscado o palpite calculado da inferência probabilística
        fica.
      </p>
      <CmPresetPicker presets={CM_PRESETS} value={presetId} onChange={setPresetId} />
      <CmComparisonPanel preset={preset} />
    </div>
  );
}
