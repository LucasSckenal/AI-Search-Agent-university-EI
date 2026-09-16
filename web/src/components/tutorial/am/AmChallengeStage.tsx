"use client";

import { useState } from "react";
import { PositionPicker } from "@/components/tutorial/am/PositionPicker";
import { AmComparisonPanel } from "@/components/tutorial/am/AmComparisonPanel";
import { AM_CHALLENGE_PRESETS } from "@/lib/tutorial/am-presets";

/** Desafio: choose among positions with fewer and fewer filled cells - bigger and bigger trees -
 *  and watch how much more Alfa-Beta pruning saves as the tree grows. Reuses AmComparisonPanel,
 *  whose two minimax() calls stay cheap regardless of position size since they only return
 *  aggregate counts, never a per-node trace to animate. */
export function AmChallengeStage() {
  const [presetId, setPresetId] = useState(AM_CHALLENGE_PRESETS[AM_CHALLENGE_PRESETS.length - 1].id);
  const preset = AM_CHALLENGE_PRESETS.find((p) => p.id === presetId) ?? AM_CHALLENGE_PRESETS[0];

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[65ch] text-[12.5px] leading-relaxed text-on-surface-variant">
        Escolha posições com cada vez menos casas preenchidas - árvores cada vez maiores - e veja como a economia da poda Alfa-Beta cresce junto.
      </p>
      <PositionPicker presets={AM_CHALLENGE_PRESETS} value={presetId} onChange={setPresetId} />
      <AmComparisonPanel preset={preset} />
    </div>
  );
}
