"use client";

import { ReactNode } from "react";

export interface StatusSegment {
  label: string;
  value: ReactNode;
  /** Highlights the value in the primary color (used for the active algorithm/agent segment). */
  accent?: boolean;
}

/**
 * The floating status pill shared by all 3 pages. `overflow-x-auto` + a capped max-width means a
 * narrow viewport scrolls the pill horizontally instead of the segments spilling off-screen -
 * there's no responsive breakpoint elsewhere that would give them room to wrap onto a second line
 * without breaking the pill shape.
 */
export function StatusFooter({
  status,
  pulsing,
  segments,
}: {
  status: string;
  pulsing: boolean;
  segments: StatusSegment[];
}) {
  return (
    <footer className="glass-strong fixed bottom-4 left-1/2 z-50 flex max-w-[min(94vw,860px)] -translate-x-1/2 items-center gap-4 overflow-x-auto rounded-full px-5 py-2 text-[11px] font-medium shadow-xl sm:bottom-6 sm:gap-6 sm:px-6">
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${pulsing ? "animate-pulse" : ""}`}
          style={{ background: "var(--tertiary)", boxShadow: "0 0 8px rgba(255,183,123,0.6)" }}
        />
        <span className="whitespace-nowrap tracking-wide text-on-surface-variant/80">{status}</span>
      </div>
      {segments.map((s) => (
        <div key={s.label} className="flex shrink-0 items-center gap-2 border-l border-white/10 pl-4">
          <span className="whitespace-nowrap uppercase text-on-surface-variant/60">{s.label}:</span>
          <span className={`whitespace-nowrap font-mono ${s.accent ? "text-primary/90" : "text-on-surface/90"}`}>
            {s.value}
          </span>
        </div>
      ))}
    </footer>
  );
}
