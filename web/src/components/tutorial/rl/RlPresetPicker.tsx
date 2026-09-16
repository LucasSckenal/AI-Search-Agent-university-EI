"use client";

import { CSSProperties } from "react";
import { RlPreset } from "@/lib/tutorial/rl-presets";

const SIZE_COLOR: Record<number, string> = {
  5: "#afc6ff",
  6: "#ff9b9b",
  8: "#7ee0a8",
};

export function RlPresetPicker({ presets, value, onChange }: { presets: RlPreset[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <div className="lab-algo-picker">
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`lab-algo-pill ${value === p.id ? "active" : ""}`}
          style={{ "--accent": SIZE_COLOR[p.size] ?? "#afc6ff" } as CSSProperties}
          onClick={() => onChange(p.id)}
        >
          <span className="lab-algo-pill-dot" />
          {p.label}
        </button>
      ))}
    </div>
  );
}
