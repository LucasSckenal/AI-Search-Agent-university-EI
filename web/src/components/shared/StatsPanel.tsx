"use client";

import { ReactNode } from "react";

/**
 * The floating bottom-right stats panel shared by all 3 pages. Capped max-width + smaller text on
 * narrow viewports so it can't grow past the screen edge or collide with CanvasStage's content
 * (which reserves matching clearance for this panel's typical footprint).
 */
export function StatsPanel({
  items,
  cols = 3,
  children,
}: {
  items: [string, ReactNode][];
  cols?: 2 | 3;
  children?: ReactNode;
}) {
  return (
    <aside className="glass fixed bottom-20 right-3 z-40 flex max-w-[min(92vw,380px)] flex-col gap-3 rounded-2xl p-3 shadow-2xl sm:bottom-24 sm:right-6 sm:p-4">
      <div className={`grid gap-2 sm:gap-3 ${cols === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {items.map(([label, value]) => (
          <div
            key={label}
            className="flex min-w-[68px] flex-col items-center justify-center rounded-xl bg-white/5 px-3 py-2 sm:min-w-[80px] sm:px-4"
          >
            <div className="text-center text-[9px] uppercase tracking-wider text-on-surface-variant/70 sm:text-[10px]">
              {label}
            </div>
            <div className="truncate font-mono text-[13px] font-medium text-on-surface sm:text-[14px]">{value}</div>
          </div>
        ))}
      </div>
      {children}
    </aside>
  );
}
