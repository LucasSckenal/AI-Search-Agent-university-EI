"use client";

import { ReactNode } from "react";

// Shared by both the stage's own padding and CanvasBox's height cap below, so the two stay in
// sync by construction instead of two hand-tuned constants silently drifting apart.
const HEADER_CLEARANCE = 112; // clears the fixed top nav (CanvasStage's paddingTop)
const BOTTOM_CLEARANCE = 304; // clears the fixed StatsPanel + StatusFooter's max footprint (paddingBottom)
const GLASS_PADDING = 48; // CanvasStage's own glass wrapper padding (top+bottom combined)
const EXTRA_CONTENT = 48; // buffer for a status line + gap some pages render below the canvas (e.g. cube/jogo)

/**
 * Centers the glass panel holding a page's 3D canvas in the space to the right of the Sidebar.
 * paddingTop/paddingBottom are set to the exact clearance CanvasBox's height cap also assumes -
 * a hand-tuned mismatch between the two is what caused the cube page's badge to overlap the
 * fixed StatsPanel in the first place, since "centered within padding" only avoids a fixed
 * sibling if the padding actually reserves that sibling's full footprint.
 */
export function CanvasStage({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-auto px-3 pl-[15.5rem] sm:px-8 sm:pl-[21rem]"
      style={{ paddingTop: HEADER_CLEARANCE, paddingBottom: BOTTOM_CLEARANCE }}
    >
      <div className="glass flex flex-col items-center gap-4 rounded-3xl p-4 shadow-2xl sm:p-6">{children}</div>
    </div>
  );
}

/**
 * The actual WebGL container inside CanvasStage. `width`/`height` are the ideal desktop pixel
 * size (unchanged from before); on smaller viewports it shrinks to whatever fits instead of
 * forcing horizontal/vertical scroll or overlapping the fixed panels - R3F's <Canvas> already
 * resizes its camera/renderer reactively, so shrinking this box is all that's needed.
 */
export function CanvasBox({
  width,
  height,
  className = "",
  children,
}: {
  width: number;
  height: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        width: `min(${width}px, calc(100vw - 27.5rem))`,
        height: `min(${height}px, calc(100vh - ${HEADER_CLEARANCE + BOTTOM_CLEARANCE + GLASS_PADDING + EXTRA_CONTENT}px))`,
        minWidth: 240,
        minHeight: 220,
      }}
    >
      {children}
    </div>
  );
}
