const LOSS_COLOR = "#f2c94c";
const ACC_COLOR = "#7ee0a8";

/** Structural, not imported from any one module's model - every module's EpochSnapshot (Perceptron,
 *  Dígitos, Gatos vs Cachorros) satisfies this shape regardless of what its own `network` type looks
 *  like, which is what actually lets this component be reused unmodified across all of them. */
interface EpochLike {
  loss: number;
  accuracy: number;
}

/**
 * Inline SVG line chart of loss per epoch - the gradient-descent analog of GaConvergenceChart, but
 * a fresh component rather than a reuse: loss (unbounded, minimized) and fitness (an arbitrary
 * scale, maximized) aren't the same kind of number, so forcing this into GaConvergenceChart's shape
 * would either mislabel a loss curve as a "fitness" or silently assume the wrong direction of
 * "better". Accuracy is shown as a second, independently-scaled line (always 0-100%) since plotting
 * it on the loss axis would squash one series or the other.
 */
export function LossChart({ snapshots }: { snapshots: EpochLike[] }) {
  if (snapshots.length === 0) return null;

  const width = 560;
  const height = 200;
  const padLeft = 44;
  const padRight = 40;
  const padTop = 12;
  const padBottom = 24;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const losses = snapshots.map((s) => s.loss);
  const lossMin = Math.min(...losses);
  const lossMax = Math.max(...losses);
  const lossSpan = lossMax - lossMin || 1;
  const yLossMin = Math.max(0, lossMin - lossSpan * 0.08);
  const yLossMax = lossMax + lossSpan * 0.08;

  const x = (i: number) => padLeft + (snapshots.length === 1 ? 0 : (i / (snapshots.length - 1)) * plotW);
  const yLoss = (v: number) => padTop + plotH - ((v - yLossMin) / (yLossMax - yLossMin)) * plotH;
  const yAcc = (v: number) => padTop + plotH - v * plotH; // accuracy always 0..1

  const lossPath = snapshots.map((s, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${yLoss(s.loss).toFixed(1)}`).join(" ");
  const accPath = snapshots.map((s, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${yAcc(s.accuracy).toFixed(1)}`).join(" ");

  const last = snapshots[snapshots.length - 1];
  const yTicks = [yLossMin + (yLossMax - yLossMin) * 0.02, (yLossMin + yLossMax) / 2, yLossMax - (yLossMax - yLossMin) * 0.02];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-[11px] text-on-surface-variant">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: LOSS_COLOR, boxShadow: `0 0 8px ${LOSS_COLOR}66` }} />
          Perda ({last.loss.toFixed(3)})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: ACC_COLOR }} />
          Acurácia ({(last.accuracy * 100).toFixed(0)}%)
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Perda e acurácia por época">
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padLeft} y1={yLoss(t)} x2={width - padRight} y2={yLoss(t)} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <text x={padLeft - 6} y={yLoss(t) + 3} fontSize={9} textAnchor="end" fill="var(--on-surface-variant)">
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        {[0, 0.5, 1].map((t) => (
          <text key={t} x={width - padRight + 6} y={yAcc(t) + 3} fontSize={9} textAnchor="start" fill={ACC_COLOR} opacity={0.8}>
            {(t * 100).toFixed(0)}%
          </text>
        ))}
        <text x={padLeft} y={height - 6} fontSize={9} fill="var(--on-surface-variant)">
          Época 0
        </text>
        <text x={width - padRight} y={height - 6} fontSize={9} textAnchor="end" fill="var(--on-surface-variant)">
          Época {snapshots.length - 1}
        </text>
        <path d={accPath} fill="none" stroke={ACC_COLOR} strokeWidth={1.5} opacity={0.75} />
        <path d={lossPath} fill="none" stroke={LOSS_COLOR} strokeWidth={2} />
      </svg>
    </div>
  );
}
