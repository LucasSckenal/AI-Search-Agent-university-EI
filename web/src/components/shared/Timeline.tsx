"use client";

import { Icon } from "@/components/shared/Panel";

/**
 * Bottom playback bar for pages with a real continuous process to scrub through (the maze's
 * node-reveal animation, the cube's move-by-move solution) - replaces both the old StatusFooter
 * pill and the small play/pause/skip buttons that used to live in the sidebar. The progress track
 * is read-only (no click-to-seek yet), so it deliberately isn't styled as clickable.
 */
export function Timeline({
  status,
  pulsing,
  playing,
  onTogglePlay,
  onSkipEnd,
  current,
  total,
  unitLabel,
  disabled,
  speed,
  onSpeedChange,
  speedLabel,
}: {
  status: string;
  pulsing?: boolean;
  playing: boolean;
  onTogglePlay: () => void;
  onSkipEnd: () => void;
  current: number;
  total: number;
  unitLabel: string;
  disabled?: boolean;
  speed?: number;
  onSpeedChange?: (v: number) => void;
  speedLabel?: string;
}) {
  const fraction = total > 0 ? Math.min(current / total, 1) : 0;

  return (
    <div className="flex h-14 shrink-0 items-center gap-3 bg-background px-4 sm:px-5">
      <div className="flex shrink-0 items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${pulsing ? "animate-pulse" : ""}`} style={{ background: "var(--tertiary)" }} />
        <span className="hidden text-[10px] font-medium uppercase tracking-wide text-on-surface-variant/70 sm:inline">
          {status}
        </span>
      </div>

      <button
        onClick={onTogglePlay}
        disabled={disabled}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-transform hover:scale-105 disabled:opacity-30 disabled:hover:scale-100"
      >
        <Icon name={playing ? "pause" : "play_arrow"} className="text-[18px]" />
      </button>
      <button
        onClick={onSkipEnd}
        disabled={disabled}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-on-surface transition-colors hover:bg-white/10 disabled:opacity-30"
      >
        <Icon name="skip_next" className="text-[16px]" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="hidden shrink-0 font-mono text-[11px] text-on-surface-variant sm:inline">
          {current.toLocaleString("pt-BR")} / {total.toLocaleString("pt-BR")} {unitLabel}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-secondary to-primary"
            style={{ width: `${fraction * 100}%` }}
          />
        </div>
      </div>

      {onSpeedChange && (
        <div className="hidden shrink-0 items-center gap-2 text-[11px] text-on-surface-variant md:flex">
          {speedLabel}
          <input type="range" min={1} max={200} value={speed} onChange={(e) => onSpeedChange(Number(e.target.value))} className="w-20" />
        </div>
      )}
    </div>
  );
}
