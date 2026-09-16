"use client";

import { useMemo } from "react";
import { minimax } from "@/lib/game/model";
import { AM_GAME_CONFIG, AmPreset } from "@/lib/tutorial/am-presets";
import { compareMinimaxAlphaBeta } from "@/lib/tutorial/am-explain";

/** Runs the real (non-traced) minimax() twice on the same position - once plain, once with Alfa-Beta
 *  pruning - and renders a nodes-explored bar chart + a computed (never invented) insight sentence.
 *  The adversarial-search analog of ComparisonPanel (search) / GaComparisonPanel (GA). */
export function AmComparisonPanel({ preset }: { preset: AmPreset }) {
  const plain = useMemo(() => minimax(preset.board, preset.player, AM_GAME_CONFIG, false), [preset]);
  const ab = useMemo(() => minimax(preset.board, preset.player, AM_GAME_CONFIG, true), [preset]);
  const insight = compareMinimaxAlphaBeta(plain, ab);
  const maxNodes = Math.max(plain.nodesExplored, ab.nodesExplored, 1);

  const bars: { label: string; value: number; color: string }[] = [
    { label: "Minimax puro", value: plain.nodesExplored, color: "#ff9b9b" },
    { label: "Poda Alfa-Beta", value: ab.nodesExplored, color: "#7ee0a8" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="lab-bars">
        {bars.map((b) => (
          <div key={b.label} className="lab-bars-col">
            <span className="lab-bars-value">{b.value.toLocaleString("pt-BR")} nós</span>
            <div className="lab-bars-fill" style={{ height: `${Math.max(4, (b.value / maxNodes) * 100)}%`, background: b.color }} />
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
