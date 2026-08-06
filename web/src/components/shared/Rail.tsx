"use client";

import { ReactNode } from "react";

/**
 * Docked left panel shared by all 3 problem pages - part of the page's normal flex-row layout
 * (a border-right, not a floating glass card), so the Stage next to it gets real remaining space
 * instead of a hand-tuned clearance constant.
 */
export function Rail({ children }: { children: ReactNode }) {
  return (
    <aside className="flex w-[clamp(240px,22vw,300px)] shrink-0 flex-col gap-5 overflow-y-auto bg-background p-5 sm:p-6">
      {children}
    </aside>
  );
}
