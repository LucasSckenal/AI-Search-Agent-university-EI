"use client";

import { ReactNode } from "react";
import { Icon } from "@/components/shared/Panel";

/**
 * Bottom bar for the tic-tac-toe page. Turn-based games have no continuous process to scrub
 * through, so forcing a Timeline scrubber here would just be a fake progress bar attached to
 * nothing real - this shows whose turn it is and the agent's last evaluation instead.
 */
export function StatusBar({
  status,
  pulsing,
  message,
  onReset,
  resetLabel = "Reiniciar",
}: {
  status: string;
  pulsing?: boolean;
  message: ReactNode;
  onReset: () => void;
  resetLabel?: string;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-3 bg-background px-4 sm:px-5">
      <div className="flex shrink-0 items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${pulsing ? "animate-pulse" : ""}`} style={{ background: "var(--tertiary)" }} />
        <span className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant/70">{status}</span>
      </div>
      <div className="min-w-0 flex-1 truncate text-center text-[12px] text-on-surface-variant">{message}</div>
      <button
        onClick={onReset}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-on-surface transition-colors hover:bg-white/10"
      >
        <Icon name="refresh" className="text-[15px]" />
        {resetLabel}
      </button>
    </div>
  );
}
