"use client";

import { Icon } from "@/components/shared/Panel";

/** Continuous scrubbing control with a "previous" button and click-to-seek, unlike the shared
 *  Timeline (which has neither - see its own header comment) - used for the tutorial's own
 *  step-by-step walk (03/06), where going back a step is part of the point. */
export function StepControls({
  index,
  total,
  onChange,
  playing,
  onTogglePlay,
  disabled,
}: {
  index: number;
  total: number;
  onChange: (i: number) => void;
  playing?: boolean;
  onTogglePlay?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 bg-background px-4 sm:px-5">
      <button
        onClick={() => onChange(Math.max(0, index - 1))}
        disabled={disabled || index <= 0}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-on-surface transition-colors hover:bg-white/10 disabled:opacity-30"
      >
        <Icon name="skip_previous" className="text-[16px]" />
      </button>
      {onTogglePlay && (
        <button
          onClick={onTogglePlay}
          disabled={disabled}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-transform hover:scale-105 disabled:opacity-30 disabled:hover:scale-100"
        >
          <Icon name={playing ? "pause" : "play_arrow"} className="text-[18px]" />
        </button>
      )}
      <button
        onClick={() => onChange(Math.min(total, index + 1))}
        disabled={disabled || index >= total}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-on-surface transition-colors hover:bg-white/10 disabled:opacity-30"
      >
        <Icon name="skip_next" className="text-[16px]" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="hidden shrink-0 font-mono text-[11px] text-on-surface-variant sm:inline">
          Passo {index} / {total}
        </span>
        <input
          type="range"
          min={0}
          max={total}
          value={index}
          disabled={disabled || total === 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full flex-1"
        />
      </div>
    </div>
  );
}
