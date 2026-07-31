"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/labirinto", label: "Labirinto" },
  { href: "/cubo", label: "Cubo Mágico" },
  { href: "/jogo", label: "Jogo da Velha" },
];

export function Header() {
  const pathname = usePathname();
  const activeTitle = LINKS.find((l) => l.href === pathname)?.label ?? "Agentes de Busca";

  return (
    <header className="glass-strong fixed left-6 right-6 top-4 z-50 flex h-14 items-center justify-between rounded-2xl px-4 shadow-lg">
      <Link href="/" className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-[11px] font-bold text-on-primary">
          IA
        </span>
        <span className="truncate text-sm font-medium tracking-tight text-on-surface">{activeTitle}</span>
      </Link>

      <nav className="flex items-center gap-1">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-xl px-3 py-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-white/10 text-primary"
                  : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
