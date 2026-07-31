import { CSSProperties, ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  children,
  className = "",
  actions,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={`glass rounded-3xl p-6 shadow-2xl ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-1 text-xs text-on-surface-variant">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

export function Icon({
  name,
  className = "",
  style,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  );
}
