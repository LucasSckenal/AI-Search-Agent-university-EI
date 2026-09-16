/**
 * A generic NxN grayscale pixel grid - one cell per value in [0, 1], interpolated from a dark
 * background to the accent color. Reused across every module that shows a small raster image: the
 * Dígitos drawing preview, and the silhouette/feature-map thumbnails in Gatos vs Cachorros. Kept
 * value-agnostic (no domain import) so it can sit in shared/ instead of being duplicated per module.
 */
export function GrayscaleGrid({
  values,
  size,
  accentColor = "var(--primary)",
  onToggle,
}: {
  values: number[];
  size: number;
  accentColor?: string;
  onToggle?: (index: number) => void;
}) {
  const view = 300;
  const cell = view / size;
  return (
    <svg viewBox={`0 0 ${view} ${view}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <rect x={0} y={0} width={view} height={view} fill="var(--surface-container-lowest)" />
      {values.map((v, i) => {
        const r = Math.floor(i / size);
        const c = i % size;
        const clamped = Math.max(0, Math.min(1, v));
        return (
          <rect
            key={i}
            x={c * cell + 0.5}
            y={r * cell + 0.5}
            width={cell - 1}
            height={cell - 1}
            fill={accentColor}
            fillOpacity={clamped}
            style={onToggle ? { cursor: "pointer" } : undefined}
            onClick={onToggle ? () => onToggle(i) : undefined}
          />
        );
      })}
    </svg>
  );
}
