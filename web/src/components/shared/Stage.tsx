"use client";

import { ReactNode } from "react";

/** Small mono readout pinned to the stage's top-left corner (problem size, optimal cost, ...). */
export function StageHint({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute left-4 top-4 z-[1] font-mono text-[11px] tracking-wide text-on-surface-variant/70">
      {children}
    </div>
  );
}
