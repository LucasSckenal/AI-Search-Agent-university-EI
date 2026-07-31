"use client";

import { ReactNode, useEffect } from "react";
import { Icon } from "@/components/shared/Panel";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className={`panel-flat flex max-h-[80vh] flex-col overflow-hidden rounded-3xl shadow-2xl ${
          wide ? "w-[720px]" : "w-[440px]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold text-on-surface">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[11px] text-on-surface-variant">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-white/10 hover:text-on-surface"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
