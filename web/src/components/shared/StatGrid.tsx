import { ReactNode } from "react";

/** Grid of small stat tiles - shown inside a Modal (Última execução / Última jogada). */
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
