"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/shared/Panel";
import { Modal } from "@/components/shared/Modal";
import { openCommandPalette } from "@/components/shared/CommandPalette";
import { NAV_CATEGORIES, NAV_HOME, type NavCategory } from "@/lib/nav";

/**
 * Docked full-height sidebar replacing TopBar - part of the app-shell flex row (a plain border-
 * right panel, not a floating overlay), with a rounded card (the routed page) as its sibling. Below
 * the lg breakpoint it hides entirely (mirrors the app-shell CSS) and MobileDock takes over
 * cross-page navigation instead of trying to cram this into a hamburger menu.
 *
 * Nav is organized by algorithm category rather than one row per page (the user's own idea): with
 * 15 problem pages, a flat or even grouped list was still "muita opção" at a glance. Now the rail
 * shows ~6 category buttons; clicking one opens a modal listing the pages that demonstrate it.
 */
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openCategory, setOpenCategory] = useState<NavCategory | null>(null);
  const pathname = usePathname();

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-brand">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg">
          <Image src="/logo-mark.png" alt="" width={28} height={28} className="h-full w-full object-cover" priority />
        </span>
        <span className="sidebar-label truncate text-[14.5px] font-bold tracking-tight text-on-surface">
          Agentes de Busca
        </span>
      </div>

      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        className="sidebar-collapse-btn"
      >
        <Icon name={collapsed ? "chevron_right" : "chevron_left"} className="text-[15px]" />
      </button>

      <button onClick={openCommandPalette} className="sidebar-search">
        <Icon name="search" className="text-[15px]" />
        <span className="sidebar-label">Buscar...</span>
        <kbd className="sidebar-label ml-auto rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-on-surface-variant">
          ⌘K
        </kbd>
      </button>

      <nav className="sidebar-nav content-scroll">
        {NAV_HOME.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-navitem ${active ? "sidebar-navitem-active" : ""}`}
              title={collapsed ? link.label : undefined}
            >
              <Icon name={link.icon} className="shrink-0 text-[18px]" />
              <span className="sidebar-label truncate">{link.label}</span>
            </Link>
          );
        })}
        <div className="sidebar-group">
          <div className="sidebar-label sidebar-group-title">Categorias</div>
          {NAV_CATEGORIES.map((category) => {
            const active = category.items.some((item) => pathname === item.href);
            return (
              <button
                key={category.title}
                onClick={() => setOpenCategory(category)}
                className={`sidebar-navitem ${active ? "sidebar-navitem-active" : ""}`}
                title={collapsed ? category.title : undefined}
              >
                <Icon name={category.icon} className="shrink-0 text-[18px]" />
                <span className="sidebar-label truncate">{category.title}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="sidebar-footer">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
        <span className="sidebar-label truncate">v0.1.0 · 100% local</span>
      </div>

      <CategoryModal category={openCategory} onClose={() => setOpenCategory(null)} activeHref={pathname} />
    </aside>
  );
}

/** Shared by desktop Sidebar and mobile MobileDock: the page list that opens once a category is
 * picked, so the two menus behave identically past that point. */
function CategoryModal({ category, onClose, activeHref }: { category: NavCategory | null; onClose: () => void; activeHref: string }) {
  return (
    <Modal open={category !== null} onClose={onClose} title={category?.title ?? ""} subtitle={category ? `${category.items.length} página${category.items.length > 1 ? "s" : ""}` : undefined}>
      <div className="flex flex-col gap-1">
        {category?.items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${
              activeHref === item.href ? "bg-primary/15 text-primary" : "text-on-surface hover:bg-white/5"
            }`}
          >
            <Icon name={item.icon} className="shrink-0 text-[18px]" />
            {item.label}
          </Link>
        ))}
      </div>
    </Modal>
  );
}

/**
 * Fixed floating menu, visible only below the lg breakpoint where Sidebar hides entirely - keeps
 * "go to another problem" (and search) reachable on mobile. A center FAB opens a bottom sheet
 * listing the same algorithm categories as Sidebar; picking one opens the same CategoryModal to
 * drill into its pages, so mobile and desktop share one mental model instead of two.
 */
export function MobileDock() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState<NavCategory | null>(null);

  // A route change (tapping an item, or navigating some other way) always means the sheet should
  // be closed on the next screen, not left open over whatever's there now.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- closing the sheet is a one-shot reaction to the route having just changed, not a sync loop
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {open && <button className="mobile-sheet-backdrop" onClick={() => setOpen(false)} aria-label="Fechar menu" />}
      <div className={`mobile-sheet ${open ? "mobile-sheet-open" : ""}`} aria-hidden={!open}>
        <div className="mobile-sheet-handle" />
        <button
          onClick={() => {
            setOpen(false);
            openCommandPalette();
          }}
          className="mobile-sheet-search"
          tabIndex={open ? 0 : -1}
        >
          <Icon name="search" className="text-[16px]" />
          <span>Buscar...</span>
        </button>
        <nav className="mobile-sheet-nav content-scroll">
          {NAV_HOME.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} className={`mobile-sheet-item ${active ? "mobile-sheet-item-active" : ""}`} tabIndex={open ? 0 : -1}>
                <Icon name={link.icon} className="shrink-0 text-[18px]" />
                <span className="truncate">{link.label}</span>
              </Link>
            );
          })}
          <div className="mobile-sheet-group">
            <div className="mobile-sheet-group-title">Categorias</div>
            {NAV_CATEGORIES.map((category) => {
              const active = category.items.some((item) => pathname.startsWith(item.href));
              return (
                <button
                  key={category.title}
                  onClick={() => {
                    // Close the sheet first - it sits at a higher z-index than Modal (it needs to
                    // stay above the FAB while open), so leaving it open would hide the modal
                    // behind it instead of presenting the category's pages on top.
                    setOpen(false);
                    setOpenCategory(category);
                  }}
                  className={`mobile-sheet-item ${active ? "mobile-sheet-item-active" : ""}`}
                  tabIndex={open ? 0 : -1}
                >
                  <Icon name={category.icon} className="shrink-0 text-[18px]" />
                  <span className="truncate">{category.title}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`mobile-dock-fab ${open ? "mobile-dock-fab-open" : ""}`}
        aria-expanded={open}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
      >
        <Icon name={open ? "close" : "apps"} className="text-[22px]" />
      </button>

      <CategoryModal
        category={openCategory}
        onClose={() => setOpenCategory(null)}
        activeHref={pathname}
      />
    </>
  );
}
