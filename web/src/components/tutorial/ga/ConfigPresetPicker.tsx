"use client";

import { CSSProperties } from "react";
import { GaPreset } from "@/lib/tutorial/ga-presets";

const PRESET_COLOR: Record<string, string> = {
  "baixa-mutacao": "#afc6ff",
  padrao: "#7ee0a8",
  "alta-mutacao": "#ff9b9b",
  "populacao-pequena": "#ffb77b",
};

/** Reuses the same `.lab-algo-pill` visual language as AlgorithmPicker - "a pill with a colored
 *  dot, active state" is exactly the shape a preset picker needs too. */
export function ConfigPresetPicker({
  presets,
  value,
  onChange,
}: {
  presets: GaPreset[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="lab-algo-picker">
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`lab-algo-pill ${value === p.id ? "active" : ""}`}
          style={{ "--accent": PRESET_COLOR[p.id] ?? "#afc6ff" } as CSSProperties}
          onClick={() => onChange(p.id)}
        >
          <span className="lab-algo-pill-dot" />
          {p.label}
        </button>
      ))}
    </div>
  );
}
