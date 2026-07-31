"use client";

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 text-left transition-colors hover:text-primary"
    >
      {label && <span className="text-[13px] text-on-surface/90">{label}</span>}
      <span className="toggle-track" data-on={checked}>
        <span className="toggle-thumb" />
      </span>
    </button>
  );
}
