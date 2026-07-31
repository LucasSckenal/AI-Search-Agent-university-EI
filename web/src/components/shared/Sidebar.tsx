"use client";

import { ReactNode } from "react";

/**
 * Floating left sidebar shared by all 3 problem pages. Width scales with the viewport (clamp)
 * instead of a fixed pixel value so it never eats into the canvas's available space on a laptop
 * or projector narrower than the ~1280px this app was originally designed against.
 */
export function Sidebar({ children }: { children: ReactNode }) {
  return (
    <aside className="glass fixed left-3 top-20 bottom-20 z-40 flex w-[clamp(220px,24vw,280px)] flex-col gap-4 overflow-y-auto rounded-3xl p-4 shadow-2xl sm:left-6 sm:top-24 sm:bottom-24 sm:p-5">
      {children}
    </aside>
  );
}
