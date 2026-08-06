"use client";

import { ReactNode } from "react";

/**
 * Docked canvas area - a flex-1 row sibling of Rail (and StatsDrawer), so the 3D visualization
 * gets whatever space is actually left instead of a width/height capped against a floating
 * sidebar's clearance. This is what lets the canvas dominate the screen in the redesign.
 */
export function Stage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative flex min-w-0 flex-1 items-center justify-center overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

/** Small mono readout pinned to the stage's top-left corner (problem size, optimal cost, ...). */
export function StageHint({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute left-4 top-4 z-[1] font-mono text-[11px] tracking-wide text-on-surface-variant/70">
      {children}
    </div>
  );
}
