/**
 * A horizontal probability-bar readout for a classifier's output layer - one bar per class, the
 * predicted class highlighted. Generic over label count so it works for Dígitos' 10-way softmax and
 * Gatos vs Cachorros' 2-way sigmoid alike, instead of two near-identical bar charts.
 */
export function ClassBars({
  labels,
  probabilities,
  accentColor = "var(--primary)",
}: {
  labels: string[];
  probabilities: number[];
  accentColor?: string;
}) {
  let bestIndex = 0;
  for (let i = 1; i < probabilities.length; i++) if (probabilities[i] > probabilities[bestIndex]) bestIndex = i;

  return (
    <div className="flex flex-col gap-1.5">
      {labels.map((label, i) => {
        const p = probabilities[i] ?? 0;
        const isBest = i === bestIndex;
        return (
          <div key={label} className="flex items-center gap-2">
            <span className={`w-6 shrink-0 text-right font-mono text-[11px] ${isBest ? "font-semibold text-primary" : "text-on-surface-variant"}`}>
              {label}
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${Math.max(0, Math.min(1, p)) * 100}%`, background: isBest ? accentColor : "rgba(255,255,255,0.25)" }}
              />
            </div>
            <span className="w-9 shrink-0 text-right font-mono text-[10.5px] text-on-surface-variant">{(p * 100).toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}
