"use client";

import { CSSProperties } from "react";
import { CmPreset } from "@/lib/tutorial/cm-presets";

const DIFFICULTY_COLOR: Record<string, string> = {
  iniciante: "#afc6ff",
  intermediario: "#ff9b9b",
  avancado: "#7ee0a8",
};

export function CmPresetPicker({ presets, value, onChange }: { presets: CmPreset[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <div className="lab-algo-picker">
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`lab-algo-pill ${value === p.id ? "active" : ""}`}
          style={{ "--accent": DIFFICULTY_COLOR[p.difficulty] ?? "#afc6ff" } as CSSProperties}
          onClick={() => onChange(p.id)}
        >
          <span className="lab-algo-pill-dot" />
          {p.label}
        </button>
      ))}
    </div>
  );
}
