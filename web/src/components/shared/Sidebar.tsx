"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/shared/Panel";
import { openCommandPalette } from "@/components/shared/CommandPalette";

const LINKS = [
  { href: "/", label: "Início", icon: "home" },
  { href: "/tutorial", label: "Tutorial", icon: "school" },
  { href: "/labirinto", label: "Labirinto", icon: "route" },
  { href: "/cubo", label: "Cubo Mágico", icon: "grid_view" },
  { href: "/jogo", label: "Jogo da Velha", icon: "sports_esports" },
  { href: "/goose", label: "Goose (AG)", icon: "directions_run" },
  { href: "/tsp", label: "Caixeiro Viajante", icon: "view_in_ar" },
];

/**
 * Docked full-height sidebar replacing TopBar - part of the app-shell flex row (a plain border-
 * right panel, not a floating overlay), with a rounded card (the routed page) as its sibling. Below
 * the lg breakpoint it hides entirely (mirrors the app-shell CSS) and MobileDock takes over
 * cross-page navigation instead of trying to cram this into a hamburger menu.
 */
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
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

      <nav className="sidebar-nav">
        {LINKS.map((link) => {
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
      </nav>

      <div className="sidebar-footer">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
        <span className="sidebar-label truncate">v0.1.0 · 100% local</span>
      </div>
    </aside>
  );
}

/**
 * Fixed floating dock, visible only below the lg breakpoint where Sidebar hides entirely - keeps
 * "go to another problem" reachable on mobile instead of leaving the 3 pages unreachable from
 * each other. Mirrors Sidebar's own LINKS instead of importing them to avoid a client/server
 * boundary dance for 5 short objects.
 */
export function MobileDock() {
  const pathname = usePathname();
  return (
    <nav className="mobile-dock">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`mobile-dock-item ${active ? "mobile-dock-item-active" : ""}`}
            aria-label={link.label}
            title={link.label}
          >
            <Icon name={link.icon} className="text-[19px]" />
          </Link>
        );
      })}
    </nav>
  );
}
