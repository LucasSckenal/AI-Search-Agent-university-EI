"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/shared/Panel";
import { openCommandPalette } from "@/components/shared/CommandPalette";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/tutorial", label: "Tutorial" },
  { href: "/labirinto", label: "Labirinto" },
  { href: "/cubo", label: "Cubo Mágico" },
  { href: "/jogo", label: "Jogo da Velha" },
];

/**
 * Docked top bar (part of the normal document flow, not a floating pill overlaying the content) -
 * replaces the old fixed Header now that pages reserve its height via flex layout instead of a
 * hand-tuned padding-top constant.
 */
export function TopBar() {
  const pathname = usePathname();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/8 bg-background px-3 sm:gap-5 sm:px-5">
      <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5">
        {/* alt="" - decorative: the wordmark text right next to it already conveys the same info */}
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl">
          <Image src="/logo-mark.png" alt="" width={32} height={32} className="h-full w-full object-cover" priority />
        </span>
        <span className="hidden truncate text-sm font-semibold tracking-tight text-on-surface sm:inline">
          Agentes de Busca
        </span>
      </Link>

      <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                active ? "bg-primary/15 text-primary" : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={openCommandPalette}
        className="hidden shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12.5px] text-on-surface-variant transition-colors hover:border-white/20 hover:bg-white/10 hover:text-on-surface sm:flex"
      >
        <Icon name="search" className="text-[16px]" />
        Buscar
        <kbd className="ml-1 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-on-surface-variant">
          ⌘K
        </kbd>
      </button>
    </header>
  );
}
