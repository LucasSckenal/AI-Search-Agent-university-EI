"use client";

import { MiniBoard } from "@/components/tutorial/am/MiniBoard";
import { AmPreset } from "@/lib/tutorial/am-presets";

/** Reuses the `.lab-prediction-card`/`.lab-prediction-grid` visual language - "a selectable card in
 *  a grid" is exactly the shape a position picker needs too - with a small board preview instead of
 *  the usual text-only meta line. */
export function PositionPicker({ presets, value, onChange }: { presets: AmPreset[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <div className="lab-prediction-grid">
      {presets.map((p) => (
        <button key={p.id} type="button" className={`lab-prediction-card ${value === p.id ? "selected" : ""}`} onClick={() => onChange(p.id)}>
          <span className="lab-prediction-label">{p.label}</span>
          <div className="mt-2 flex justify-center">
            <MiniBoard board={p.board} cellPx={22} />
          </div>
        </button>
      ))}
    </div>
  );
}
