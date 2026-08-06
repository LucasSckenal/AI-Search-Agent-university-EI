"use client";

import { ReactNode, useState } from "react";

/**
 * Collapsible right panel replacing the old always-visible floating StatsPanel. Off-screen by
 * default with a thin edge tab; slides in on demand so the canvas keeps the space when there's
 * nothing to show yet (this is only rendered once a result actually exists - see each page).
 */
export function StatsDrawer({ label = "Estatísticas", children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`absolute top-1/2 z-10 -translate-y-1/2 rounded-l-lg border border-r-0 border-white/10 bg-surface-container px-2 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant transition-[right] duration-500 ease-out [writing-mode:vertical-rl] hover:bg-surface-container-high hover:text-primary ${
          open ? "right-[280px]" : "right-0"
        }`}
      >
        {label}
      </button>
      <aside
        className={`absolute right-0 top-0 bottom-0 z-[5] flex w-[280px] flex-col gap-4 overflow-y-auto border-l border-white/10 bg-background p-4 shadow-2xl transition-transform duration-500 ease-out sm:p-5 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {children}
      </aside>
    </>
  );
}

/** Grid of small stat tiles - same visual language the old StatsPanel used, reused inside the drawer. */
export function StatGrid({ items, cols = 2 }: { items: [string, ReactNode][]; cols?: 2 | 3 }) {
  return (
    <div className={`grid gap-2 ${cols === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-0.5 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
          <span className="text-[9.5px] uppercase tracking-wider text-on-surface-variant/70">{label}</span>
          <span className="truncate font-mono text-[13px] font-medium text-on-surface">{value}</span>
        </div>
      ))}
    </div>
  );
}
