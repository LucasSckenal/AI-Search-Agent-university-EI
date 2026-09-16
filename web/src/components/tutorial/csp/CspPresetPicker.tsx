"use client";

import { CSSProperties } from "react";
import { CspPreset } from "@/lib/tutorial/csp-presets";

const SIZE_COLOR: Record<number, string> = {
  4: "#afc6ff",
  6: "#ff9b9b",
  8: "#7ee0a8",
  10: "#ffb77b",
  12: "#cebdff",
};

/** Reuses the `.lab-algo-pill` visual language - each pill shows N plus the REAL total solution
 *  count (computed by countQueensSolutions(), never a memorized figure), so a board size like 6
 *  visibly stands out as unusually constrained (only 4 solutions) before the user even picks it. */
export function CspPresetPicker({ presets, value, onChange }: { presets: CspPreset[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <div className="lab-algo-picker">
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`lab-algo-pill ${value === p.id ? "active" : ""}`}
          style={{ "--accent": SIZE_COLOR[p.n] ?? "#afc6ff" } as CSSProperties}
          onClick={() => onChange(p.id)}
        >
          <span className="lab-algo-pill-dot" />
          {p.label}
          <span className="ml-1.5 text-on-surface-variant/70">· {p.solutions} soluções</span>
        </button>
      ))}
    </div>
  );
}
