"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
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
 *
 * Follows the ARIA "listbox button" pattern: focus stays on the trigger button the whole time
 * (simpler and more robust than moving DOM focus into a portal), with `aria-activedescendant`
 * pointing at the arrow-key-highlighted option so screen readers announce it - the same technique
 * used by Headless UI / Radix's Select.
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
  const [highlight, setHighlight] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (i: number) => `${baseId}-option-${i}`;

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];
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

  const commit = (index: number) => {
    const opt = options[index];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setHighlight(0);
        break;
      case "End":
        e.preventDefault();
        setHighlight(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(highlight);
        break;
    }
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? optionId(highlight) : undefined}
        onClick={() => {
          setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
          setOpen((o) => !o);
        }}
        onKeyDown={handleTriggerKeyDown}
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
            id={listboxId}
            role="listbox"
            className="panel-flat fixed z-[200] overflow-y-auto rounded-xl p-1 shadow-2xl"
            style={{ top: position.top, left: position.left, width: position.width, maxHeight: maxPanelHeight }}
          >
            {options.map((o, i) => (
              <button
                key={o.value}
                id={optionId(i)}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => commit(i)}
                className={`block w-full truncate rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                  o.value === value ? "bg-primary/15 font-medium text-primary" : "text-on-surface"
                } ${i === highlight ? "bg-white/10" : o.value !== value ? "hover:bg-white/5" : ""}`}
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
