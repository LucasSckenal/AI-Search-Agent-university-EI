"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Icon } from "@/components/shared/Panel";

const OPEN_EVENT = "cmdk:open";

/** Opens the palette from anywhere (e.g. Sidebar's "Buscar" button) without prop-drilling state. */
export function openCommandPalette() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_EVENT));
}

const PAGES = [
  { href: "/", label: "Início", icon: "home" },
  { href: "/tutorial", label: "Tutorial", icon: "school" },
  { href: "/labirinto", label: "Labirinto", icon: "grid_view" },
  { href: "/cubo", label: "Cubo Mágico", icon: "view_in_ar" },
  { href: "/jogo", label: "Jogo da Velha", icon: "sports_esports" },
];

/**
 * ⌘K / Ctrl+K command palette - a signature component the Obsidian Flux design system already
 * specified ("full-width search input at top, followed by a list of results, backdrop blur when
 * active") but that the app never actually built until this redesign. Rendered once in the root
 * layout so the shortcut works from any page.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? PAGES.filter((p) => p.label.toLowerCase().includes(q)) : PAGES;
  }, [query]);

  useEffect(() => {
    const onOpenEvent = () => setOpen(true);
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener(OPEN_EVENT, onOpenEvent);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpenEvent);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the search each time the palette opens
    setQuery("");
    setHighlight(0);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keeps the highlighted row valid as the filtered list changes
    setHighlight(0);
  }, [query]);

  if (!open) return null;

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (results[highlight]) go(results[highlight].href);
        break;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/60 pt-[18vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div className="panel-flat w-[min(92vw,480px)] overflow-hidden rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-outline-variant px-4">
          <Icon name="search" className="text-[18px] text-on-surface-variant" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ir para um problema…"
            className="w-full bg-transparent py-3.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/70"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <p className="px-3 py-4 text-center text-[12.5px] text-on-surface-variant">Nada encontrado.</p>
          )}
          {results.map((p, i) => (
            <button
              key={p.href}
              onClick={() => go(p.href)}
              onMouseEnter={() => setHighlight(i)}
              className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors ${
                i === highlight ? "bg-primary/15 text-primary" : "text-on-surface hover:bg-white/5"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon name={p.icon} className="text-[16px]" />
                {p.label}
              </span>
              {pathname === p.href && (
                <span className="text-[10px] uppercase tracking-wide text-on-surface-variant">atual</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
