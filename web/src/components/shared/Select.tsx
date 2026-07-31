"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/shared/Panel";

export interface SelectOption {
  value: string;
  label: string;
}

interface Position {
  top: number;
  left: number;
  width: number;
}

/**
 * Custom dropdown replacing the native <select> — the browser's own option list can't be themed
 * (it always renders with OS/browser default colors), which looked jarring against this dark UI.
 * Renders its panel through a portal into <body> so it's never clipped by a scrolling ancestor
 * (sidebars, modals), and flips to open upward when there isn't room below the trigger.
 */
export function Select({
  value,
  onChange,
  options,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const maxPanelHeight = Math.min(options.length * 36 + 8, 280);

  useLayoutEffect(() => {
    if (!open) return;
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < maxPanelHeight + 8 && r.top > spaceBelow;
    setPosition({
      top: openUp ? r.top - maxPanelHeight - 6 : r.bottom + 6,
      left: r.left,
      width: r.width,
    });
  }, [open, maxPanelHeight]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-[13px] text-on-surface backdrop-blur-md transition-colors hover:border-white/20 hover:bg-white/10 ${className}`}
      >
        <span className="truncate">{selected?.label ?? "—"}</span>
        <Icon
          name="expand_more"
          className={`shrink-0 text-[16px] text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open &&
        position &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="panel-flat fixed z-[200] overflow-y-auto rounded-xl p-1 shadow-2xl"
            style={{ top: position.top, left: position.left, width: position.width, maxHeight: maxPanelHeight }}
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`block w-full truncate rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                  o.value === value ? "bg-primary/15 font-medium text-primary" : "text-on-surface hover:bg-white/5"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
