"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  KENNEY_TILE_PX,
  KENNEY_TILE_STRIDE,
  KENNEY_BG_TILE_PX,
  KENNEY_BG_TILE_STRIDE,
  SourceRect,
  Placement,
  PaintedLayer,
  SpriteSheetId as PaletteId,
  Tint,
  BiomeId,
  BIOME_ORDER,
  BIOME_SKY_TILE,
  BIOME_MOUNTAIN_TILES,
  sheetImage,
  drawPaintedRow,
  getTintedRegion,
} from "@/lib/goose/scenery";

/**
 * Internal-only scene composer for the Goose background - a Godot-style "pick from the sheet,
 * paint it onto a row" editor instead of describing tile coordinates back and forth in chat. Not
 * linked from the app's nav; reached by URL only.
 *
 * Selections are free-form pixel rectangles, not grid-snapped tiles: sheets like
 * tilemap-backgrounds.png are one continuous painted scene across several cells (a mountain
 * silhouette spanning 3 columns, say), so restricting picks to a single 18x18 cell would cut that
 * apart. Drag across the sheet to grab whatever region you need; a plain click still grabs one
 * tile for convenience.
 *
 * Every scenery row starts completely empty - you build each one region-by-region rather than
 * tweaking scatter parameters - and the preview stays static by default so placement is easy to
 * judge; a play button previews the parallax scroll on demand. The exported snippet is meant to be
 * read by a human (or handed back to me) to wire into scenery.ts by hand, not consumed at runtime.
 */

function emptyLayer(sheet: PaletteId, tint: Tint, color: string, tileSize: number, baseYOffset: number, speed: number, patternWidth: number): PaintedLayer {
  return { placements: [], color, tileSize, baseYOffset, speed, sheet, tint, patternWidth };
}

type LayerName = "mountainForest" | "mountainDesert" | "mountainIce" | "forestFar" | "forestNear" | "decor" | "groundTop" | "groundFill";

const LAYER_LABELS: Record<LayerName, string> = {
  mountainForest: "Montanha — Floresta",
  mountainDesert: "Montanha — Deserto",
  mountainIce: "Montanha — Gelo",
  forestFar: "Floresta — distante",
  forestNear: "Floresta — próxima",
  decor: "Decoração da colina",
  groundTop: "Chão — topo (grama)",
  groundFill: "Chão — preenchimento (terra)",
};

const BIOME_LABELS: Record<BiomeId, string> = {
  forest: "Floresta",
  desert: "Deserto",
  ice: "Gelo",
};

/** Turns a biome's flat array of alternating source tiles (as the real game's BIOME_MOUNTAIN_TILES
 *  stores them) into an editable PaintedLayer seeded with the same tiling the game currently ships,
 *  so the editor opens on a working starting point instead of an empty strip. */
function mountainLayerFromTiles(tiles: SourceRect[], tileSize: number): PaintedLayer {
  return {
    sheet: "backgrounds",
    tint: "none",
    color: "#ffffff",
    tileSize,
    baseYOffset: 0,
    speed: 0.05,
    patternWidth: tiles.length * tileSize,
    placements: tiles.map((rect, i) => ({ x: i * tileSize, rect })),
  };
}

/** Each sheet has its own tile grid - tilemap.png is 18px tiles on a 19px stride, while
 *  tilemap-backgrounds.png is 24px tiles on a 25px stride (measured directly off the sheet, not
 *  the same grid). */
function sheetGrid(sheet: PaletteId): { px: number; stride: number; cols: number; rows: number } {
  return sheet === "tilemap" ? { px: KENNEY_TILE_PX, stride: KENNEY_TILE_STRIDE, cols: 19, rows: 8 } : { px: KENNEY_BG_TILE_PX, stride: KENNEY_BG_TILE_STRIDE, cols: 8, rows: 3 };
}

function getTinted(sheet: PaletteId, rect: SourceRect, tint: Tint, color: string): HTMLCanvasElement | null {
  if (tint === "none") return null;
  return getTintedRegion(sheetImage(sheet), rect, color, tint);
}

function clientToSourcePx(e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement, canvasW: number, canvasH: number, zoom: number) {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvasW;
  const y = ((e.clientY - rect.top) / rect.height) * canvasH;
  return { x: x / zoom, y: y / zoom };
}

function TilePalette({
  title,
  hint,
  sheet,
  zoom,
  brushRect,
  onPick,
}: {
  title: string;
  hint: string;
  sheet: PaletteId;
  zoom: number;
  brushRect: SourceRect | null;
  onPick: (rect: SourceRect) => void;
}) {
  const image = sheetImage(sheet);
  const { px: tilePx, stride: tileStride, cols, rows } = sheetGrid(sheet);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  const sheetW = cols * tileStride;
  const sheetH = rows * tileStride;
  const width = sheetW * zoom;
  const height = sheetH * zoom;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = false;
      if (image && image.complete && image.naturalWidth > 0) {
        ctx.drawImage(image, 0, 0, sheetW, sheetH, 0, 0, width, height);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      for (let c = 1; c < cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * tileStride * zoom, 0);
        ctx.lineTo(c * tileStride * zoom, height);
        ctx.stroke();
      }
      for (let r = 1; r < rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * tileStride * zoom);
        ctx.lineTo(width, r * tileStride * zoom);
        ctx.stroke();
      }
      if (brushRect) {
        ctx.strokeStyle = "rgba(255,183,123,0.95)";
        ctx.lineWidth = 2;
        ctx.strokeRect(brushRect.x * zoom, brushRect.y * zoom, brushRect.w * zoom, brushRect.h * zoom);
      }
      if (dragStart && dragCurrent) {
        const x0 = Math.min(dragStart.x, dragCurrent.x) * zoom;
        const y0 = Math.min(dragStart.y, dragCurrent.y) * zoom;
        const w = Math.abs(dragCurrent.x - dragStart.x) * zoom;
        const h = Math.abs(dragCurrent.y - dragStart.y) * zoom;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(x0, y0, w, h);
        ctx.setLineDash([]);
      } else if (hover) {
        const col = Math.floor(hover.x / tileStride);
        const row = Math.floor(hover.y / tileStride);
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1;
        ctx.strokeRect(col * tileStride * zoom, row * tileStride * zoom, tilePx * zoom, tilePx * zoom);
      }
      if (!image || !image.complete) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [image, cols, rows, zoom, width, height, sheetW, sheetH, brushRect, hover, dragStart, dragCurrent, tilePx, tileStride]);

  const posFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    return clientToSourcePx(e, canvas, width, height, zoom);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-1 text-[12px] font-semibold text-on-surface">{title}</div>
      <div className="mb-2 text-[11px] text-on-surface-variant">{hint}</div>
      <div className="overflow-auto rounded-lg border border-white/10 bg-black/40" style={{ maxHeight: 360 }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ width, height, display: "block", cursor: "crosshair" }}
          onMouseDown={(e) => {
            const p = posFromEvent(e);
            setDragStart(p);
            setDragCurrent(p);
          }}
          onMouseMove={(e) => {
            const p = posFromEvent(e);
            setHover(p);
            if (dragStart) setDragCurrent(p);
          }}
          onMouseUp={() => {
            if (!dragStart || !dragCurrent) return;
            const x0 = Math.min(dragStart.x, dragCurrent.x);
            const y0 = Math.min(dragStart.y, dragCurrent.y);
            const w = Math.abs(dragCurrent.x - dragStart.x);
            const h = Math.abs(dragCurrent.y - dragStart.y);
            let rect: SourceRect;
            if (w < 3 && h < 3) {
              const col = Math.floor(dragStart.x / tileStride);
              const row = Math.floor(dragStart.y / tileStride);
              rect = { x: col * tileStride, y: row * tileStride, w: tilePx, h: tilePx };
            } else {
              rect = { x: Math.round(x0), y: Math.round(y0), w: Math.round(w), h: Math.round(h) };
            }
            onPick(rect);
            setDragStart(null);
            setDragCurrent(null);
          }}
          onMouseLeave={() => {
            setHover(null);
            setDragStart(null);
            setDragCurrent(null);
          }}
        />
      </div>
    </div>
  );
}

function RegionSwatch({ image, rect, size = 40 }: { image: HTMLImageElement | null; rect: SourceRect | null; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;
      if (rect && image && image.complete && image.naturalWidth > 0) {
        const scale = Math.min(size / rect.w, size / rect.h);
        const dw = rect.w * scale;
        const dh = rect.h * scale;
        ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, (size - dw) / 2, (size - dh) / 2, dw, dh);
      } else if (rect) {
        raf = requestAnimationFrame(draw);
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [image, rect, size]);
  return <canvas ref={canvasRef} width={size} height={size} style={{ width: size, height: size, imageRendering: "pixelated" }} className="rounded border border-dashed border-white/15 bg-black/40" />;
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[11px] text-on-surface-variant">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, step = 1, width = 64 }: { value: number; onChange: (v: number) => void; step?: number; width?: number }) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width }}
      className="rounded border border-white/15 bg-black/30 px-2 py-1 text-right text-[11px] text-on-surface"
    />
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-white/15 bg-transparent" />
      <span className="font-mono text-[11px] text-on-surface-variant">{value}</span>
    </div>
  );
}

/** Single-tile "arm, then click a palette" picker, used for the sky fill (one tile per biome,
 *  stretched to fill the canvas - unlike the layers below, it isn't a repeating strip). */
function SkyPickButton({
  label,
  active,
  onArm,
  image,
  rect,
}: {
  label: string;
  active: boolean;
  onArm: () => void;
  image: HTMLImageElement | null;
  rect: SourceRect;
}) {
  return (
    <button
      onClick={onArm}
      className={`flex items-center gap-2 rounded-lg border px-2 py-1 text-[10px] transition-colors ${
        active ? "border-primary bg-primary/15 text-primary" : "border-white/15 bg-white/5 text-on-surface-variant hover:bg-white/10"
      }`}
    >
      <RegionSwatch image={image} rect={rect} size={32} />
      {active ? "arraste na planilha…" : `${label}: ${rect.w}×${rect.h} @ ${rect.x},${rect.y}`}
    </button>
  );
}

/** Horizontal strip representing one loop (`patternWidth` px) of a layer's pattern. Click places
 *  the current brush centered at the click point - anywhere, no grid. Shift+click snaps the new
 *  placement flush against whichever existing placement is nearest, so blocks can be lined up edge
 *  to edge without hunting for the exact pixel. Right-click removes the placement under the cursor. */
function PlacementStrip({
  layer,
  brush,
  brushSheet,
  onChange,
}: {
  layer: PaintedLayer;
  brush: SourceRect | null;
  brushSheet: PaletteId;
  onChange: (next: PaintedLayer) => void;
}) {
  const image = sheetImage(layer.sheet);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoom = 2.6;
  const width = Math.max(1, layer.patternWidth * zoom);
  const height = Math.max(1, layer.tileSize * zoom);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = false;
      let pending = false;
      for (const p of layer.placements) {
        const drawH = layer.tileSize;
        const drawW = layer.tileSize * (p.rect.w / p.rect.h);
        if (layer.tint === "none") {
          if (image && image.complete && image.naturalWidth > 0) {
            ctx.drawImage(image, p.rect.x, p.rect.y, p.rect.w, p.rect.h, p.x * zoom, 0, drawW * zoom, drawH * zoom);
          } else {
            pending = true;
          }
        } else {
          const tinted = getTinted(layer.sheet, p.rect, layer.tint, layer.color);
          if (tinted) ctx.drawImage(tinted, p.x * zoom, 0, drawW * zoom, drawH * zoom);
          else pending = true;
        }
      }
      ctx.strokeStyle = "rgba(255,183,123,0.5)";
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(width - 0.5, 0);
      ctx.lineTo(width - 0.5, height);
      ctx.stroke();
      ctx.setLineDash([]);
      if (pending) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [layer, image, width, height]);

  const xFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * layer.patternWidth;
  };

  const place = (x: number, snap: boolean) => {
    if (brushSheet !== layer.sheet || !brush) return;
    const drawW = layer.tileSize * (brush.w / brush.h);
    let px = x - drawW / 2;
    if (snap && layer.placements.length > 0) {
      let nearest = layer.placements[0];
      let nearestDist = Infinity;
      for (const p of layer.placements) {
        const pDrawW = layer.tileSize * (p.rect.w / p.rect.h);
        const dist = Math.abs(p.x + pDrawW / 2 - x);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = p;
        }
      }
      const nearestDrawW = layer.tileSize * (nearest.rect.w / nearest.rect.h);
      const nearestCenter = nearest.x + nearestDrawW / 2;
      px = x >= nearestCenter ? nearest.x + nearestDrawW : nearest.x - drawW;
    }
    onChange({ ...layer, placements: [...layer.placements, { rect: brush, x: px }] });
  };

  const removeNear = (x: number) => {
    for (let i = layer.placements.length - 1; i >= 0; i--) {
      const p = layer.placements[i];
      const drawW = layer.tileSize * (p.rect.w / p.rect.h);
      if (x >= p.x && x <= p.x + drawW) {
        onChange({ ...layer, placements: layer.placements.filter((_, idx) => idx !== i) });
        return;
      }
    }
  };

  return (
    <div className="overflow-auto rounded-lg border border-white/10 bg-black/40" style={{ maxHeight: 220 }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width, height, display: "block", cursor: brush ? "copy" : "not-allowed" }}
        onClick={(e) => place(xFromEvent(e), e.shiftKey)}
        onContextMenu={(e) => {
          e.preventDefault();
          removeNear(xFromEvent(e));
        }}
      />
    </div>
  );
}

function LayerEditor({
  name,
  layer,
  brush,
  brushSheet,
  onChange,
  groundMode = false,
}: {
  name: LayerName;
  layer: PaintedLayer;
  brush: SourceRect | null;
  brushSheet: PaletteId;
  onChange: (next: PaintedLayer) => void;
  /** Ground rows are stacked directly off tileSize (grama no topo, terra empilhada abaixo), not
   *  floated above the ground line, so "altura acima do chão" has no effect there - hide it. */
  groundMode?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-on-surface">{LAYER_LABELS[name]}</span>
        <button
          onClick={() => onChange({ ...layer, placements: [] })}
          className="rounded border border-white/15 px-2 py-0.5 text-[10px] text-on-surface-variant hover:bg-white/10"
        >
          limpar
        </button>
      </div>
      {layer.tint !== "none" && (
        <FieldRow label="Cor">
          <ColorInput value={layer.color} onChange={(v) => onChange({ ...layer, color: v })} />
        </FieldRow>
      )}
      <FieldRow label="Altura do tile">
        <NumberInput value={layer.tileSize} onChange={(v) => onChange({ ...layer, tileSize: v })} />
      </FieldRow>
      {!groundMode && (
        <FieldRow label="Altura acima do chão">
          <NumberInput value={layer.baseYOffset} onChange={(v) => onChange({ ...layer, baseYOffset: v })} />
        </FieldRow>
      )}
      <FieldRow label="Velocidade parallax">
        <NumberInput value={layer.speed} onChange={(v) => onChange({ ...layer, speed: v })} step={0.01} />
      </FieldRow>
      <FieldRow label="Largura do padrão">
        <NumberInput value={layer.patternWidth} onChange={(v) => onChange({ ...layer, patternWidth: Math.max(1, v) })} step={10} width={72} />
      </FieldRow>
      <p className="mb-1.5 mt-1 text-[10px] text-on-surface-variant">
        Clique na faixa abaixo para colocar o pincel em qualquer ponto. Segure Shift para encostar no bloco mais
        próximo. Botão direito apaga.
      </p>
      <PlacementStrip layer={layer} brush={brush} brushSheet={brushSheet} onChange={onChange} />
    </div>
  );
}

export default function SceneEditor() {
  // Sky: one raw tile per biome, stretched to fill the canvas - seeded with what the game ships
  // today (BIOME_SKY_TILE) so there's a working starting point to pick over by hand.
  const [sky, setSky] = useState<Record<BiomeId, { rect: SourceRect; sheet: PaletteId }>>(() => ({
    forest: { rect: BIOME_SKY_TILE.forest, sheet: "backgrounds" },
    desert: { rect: BIOME_SKY_TILE.desert, sheet: "backgrounds" },
    ice: { rect: BIOME_SKY_TILE.ice, sheet: "backgrounds" },
  }));
  const [skyTarget, setSkyTarget] = useState<BiomeId | null>(null);

  const [mountainForest, setMountainForest] = useState<PaintedLayer>(() => mountainLayerFromTiles(BIOME_MOUNTAIN_TILES.forest, 104));
  const [mountainDesert, setMountainDesert] = useState<PaintedLayer>(() => mountainLayerFromTiles(BIOME_MOUNTAIN_TILES.desert, 104));
  const [mountainIce, setMountainIce] = useState<PaintedLayer>(() => mountainLayerFromTiles(BIOME_MOUNTAIN_TILES.ice, 104));
  const [previewBiome, setPreviewBiome] = useState<BiomeId>("forest");

  const [forestFar, setForestFar] = useState<PaintedLayer>(() => emptyLayer("tilemap", "atop", "#2a3050", 40, 2, 0.06, 320));
  const [forestNear, setForestNear] = useState<PaintedLayer>(() => emptyLayer("tilemap", "atop", "#080810", 56, -2, 0.14, 448));
  const [decor, setDecor] = useState<PaintedLayer>(() => emptyLayer("tilemap", "none", "#ffffff", 24, 2, 0.14, 192));
  const [groundTop, setGroundTop] = useState<PaintedLayer>(() => emptyLayer("tilemap", "none", "#ffffff", 22, 0, 1, 176));
  const [groundFill, setGroundFill] = useState<PaintedLayer>(() => emptyLayer("tilemap", "none", "#ffffff", 22, 0, 1, 176));

  const [brush, setBrush] = useState<{ rect: SourceRect; sheet: PaletteId } | null>(null);
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(false);

  const mountainByBiome: Record<BiomeId, PaintedLayer> = { forest: mountainForest, desert: mountainDesert, ice: mountainIce };

  const stateRef = useRef({ sky, previewBiome, mountainByBiome, forestFar, forestNear, decor, groundTop, groundFill, playing });
  useEffect(() => {
    stateRef.current = { sky, previewBiome, mountainByBiome, forestFar, forestNear, decor, groundTop, groundFill, playing };
  });

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewSizeRef = useRef({ width: 700, height: 320 });

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let offset = 0;
    const scale = 44;
    const groundYFraction = 0.72;

    const loop = () => {
      const s = stateRef.current;
      if (s.playing) offset += 4;
      const ctx = canvas.getContext("2d");
      const { width, height } = previewSizeRef.current;
      if (ctx) {
        const groundY = height * groundYFraction;
        ctx.clearRect(0, 0, width, height);
        const skyPick = s.sky[s.previewBiome];
        const skyImg = sheetImage(skyPick.sheet);
        if (skyImg && skyImg.complete && skyImg.naturalWidth > 0) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(skyImg, skyPick.rect.x, skyPick.rect.y, skyPick.rect.w, skyPick.rect.h, 0, 0, width, height);
        }

        const phase = (layer: PaintedLayer) => -offset * scale * layer.speed;
        const mountain = s.mountainByBiome[s.previewBiome];
        drawPaintedRow(ctx, width, groundY - mountain.baseYOffset, phase(mountain), mountain);
        drawPaintedRow(ctx, width, groundY - s.forestFar.baseYOffset, phase(s.forestFar), s.forestFar);
        drawPaintedRow(ctx, width, groundY - s.forestNear.baseYOffset, phase(s.forestNear), s.forestNear);
        drawPaintedRow(ctx, width, groundY - s.decor.baseYOffset, phase(s.decor), s.decor);

        const topBaseY = groundY + s.groundTop.tileSize;
        const fillTileSize = Math.max(1, s.groundFill.tileSize);
        const fillRows = Math.ceil((height - topBaseY) / fillTileSize) + 1;
        for (let r = 0; r < fillRows; r++) {
          drawPaintedRow(ctx, width, topBaseY + (r + 1) * fillTileSize, phase(s.groundFill), s.groundFill);
        }
        drawPaintedRow(ctx, width, topBaseY, phase(s.groundTop), s.groundTop);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      previewSizeRef.current = { width: rect.width, height: rect.height };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();
    return () => observer.disconnect();
  }, []);

  const handlePaletteClick = (sheet: PaletteId, rect: SourceRect) => {
    if (skyTarget) {
      setSky((prev) => ({ ...prev, [skyTarget]: { rect, sheet } }));
      setSkyTarget(null);
      return;
    }
    setBrush({ rect, sheet });
  };

  const snippet = useMemo(() => {
    const t = (rect: SourceRect | null) => (rect ? `{ x: ${rect.x}, y: ${rect.y}, w: ${rect.w}, h: ${rect.h} }` : "null");
    const p = (placement: Placement) =>
      `{ x: ${Math.round(placement.x)}, rect: ${t(placement.rect)} }`;
    const layerBlock = (label: string, layer: PaintedLayer) =>
      `  ${label}: {\n    sheet: "${layer.sheet}",\n    tint: "${layer.tint}",\n    color: "${layer.color}",\n    tileSize: ${layer.tileSize},\n    baseYOffset: ${layer.baseYOffset},\n    speed: ${layer.speed},\n    patternWidth: ${layer.patternWidth},\n    placements: [${layer.placements.map(p).join(", ")}],\n  },`;
    const skyBlock = (biome: BiomeId) => `    ${biome}: { sheet: "${sky[biome].sheet}", rect: ${t(sky[biome].rect)} },`;
    return `{
  sky: {
${BIOME_ORDER.map(skyBlock).join("\n")}
  },
${layerBlock("mountainForest", mountainForest)}
${layerBlock("mountainDesert", mountainDesert)}
${layerBlock("mountainIce", mountainIce)}
${layerBlock("forestFar", forestFar)}
${layerBlock("forestNear", forestNear)}
${layerBlock("decor", decor)}
${layerBlock("groundTop", groundTop)}
${layerBlock("groundFill", groundFill)}
}`;
  }, [sky, mountainForest, mountainDesert, mountainIce, forestFar, forestNear, decor, groundTop, groundFill]);

  const copySnippet = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40" style={{ height: 320 }}>
          <canvas ref={previewCanvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setPlaying((p) => !p)} className="btn-pill !px-3 !py-1.5 text-[11px]">
            {playing ? "Pausar" : "▶ Testar rolagem"}
          </button>
          <span className="text-[11px] text-on-surface-variant">
            {playing ? "Rolando com a velocidade de cada camada." : "Parado — o padrão fica fixo para você montar com precisão."}
          </span>
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1">
            {BIOME_ORDER.map((b) => (
              <button
                key={b}
                onClick={() => setPreviewBiome(b)}
                className={`rounded px-2 py-1 text-[10px] transition-colors ${
                  previewBiome === b ? "bg-primary/20 text-primary" : "text-on-surface-variant hover:bg-white/10"
                }`}
              >
                {BIOME_LABELS[b]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <TilePalette
            title="Pixel Platformer — tilemap.png"
            hint="Chão, floresta e decoração usam esta planilha. Arraste para selecionar qualquer região (não precisa ser um tile só)."
            sheet="tilemap"
            zoom={3.4}
            brushRect={brush?.sheet === "tilemap" ? brush.rect : null}
            onPick={(rect) => handlePaletteClick("tilemap", rect)}
          />
          <TilePalette
            title="Backgrounds — tilemap-backgrounds.png"
            hint="A montanha usa esta planilha. As peças formam uma cena contínua — arraste para pegar vários tiles de uma vez."
            sheet="backgrounds"
            zoom={6}
            brushRect={brush?.sheet === "backgrounds" ? brush.rect : null}
            onPick={(rect) => handlePaletteClick("backgrounds", rect)}
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-2 text-[12px] font-semibold text-on-surface">Céu por bioma</div>
          <p className="mb-2 text-[11px] text-on-surface-variant">
            Um tile só, esticado para preencher a tela. Clique em &quot;escolher&quot; e depois numa planilha.
          </p>
          {BIOME_ORDER.map((b) => (
            <FieldRow key={b} label={BIOME_LABELS[b]}>
              <SkyPickButton
                label="escolher"
                active={skyTarget === b}
                onArm={() => setSkyTarget(skyTarget === b ? null : b)}
                image={sheetImage(sky[b].sheet)}
                rect={sky[b].rect}
              />
            </FieldRow>
          ))}
        </div>

        <LayerEditor name="mountainForest" layer={mountainForest} brush={brush?.rect ?? null} brushSheet={brush?.sheet ?? "tilemap"} onChange={setMountainForest} />
        <LayerEditor name="mountainDesert" layer={mountainDesert} brush={brush?.rect ?? null} brushSheet={brush?.sheet ?? "tilemap"} onChange={setMountainDesert} />
        <LayerEditor name="mountainIce" layer={mountainIce} brush={brush?.rect ?? null} brushSheet={brush?.sheet ?? "tilemap"} onChange={setMountainIce} />
        <LayerEditor name="forestFar" layer={forestFar} brush={brush?.rect ?? null} brushSheet={brush?.sheet ?? "tilemap"} onChange={setForestFar} />
        <LayerEditor name="forestNear" layer={forestNear} brush={brush?.rect ?? null} brushSheet={brush?.sheet ?? "tilemap"} onChange={setForestNear} />
        <LayerEditor name="decor" layer={decor} brush={brush?.rect ?? null} brushSheet={brush?.sheet ?? "tilemap"} onChange={setDecor} />
        <LayerEditor name="groundTop" layer={groundTop} brush={brush?.rect ?? null} brushSheet={brush?.sheet ?? "tilemap"} onChange={setGroundTop} groundMode />
        <LayerEditor name="groundFill" layer={groundFill} brush={brush?.rect ?? null} brushSheet={brush?.sheet ?? "tilemap"} onChange={setGroundFill} groundMode />
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-2 text-[12px] font-semibold text-on-surface">Pincel atual</div>
          <div className="flex items-center gap-2">
            <RegionSwatch image={brush ? sheetImage(brush.sheet) : null} rect={brush?.rect ?? null} size={48} />
            <div className="text-[11px] text-on-surface-variant">
              {brush ? `${brush.rect.w}×${brush.rect.h} @ ${brush.rect.x},${brush.rect.y} (${brush.sheet})` : "nenhum — arraste numa planilha"}
            </div>
          </div>
          <p className="mt-2 text-[11px] text-on-surface-variant">
            Arraste (ou clique) numa planilha para escolher a região, depois clique na faixa de uma camada abaixo
            para colocar o pincel em qualquer ponto. Segure Shift para encostar no bloco mais próximo. Botão direito
            apaga.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-on-surface">Exportar configuração</span>
            <button onClick={copySnippet} className="btn-pill btn-pill-primary !px-3 !py-1 text-[11px]">
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <p className="mb-2 text-[11px] text-on-surface-variant">Cole isto na conversa (ou mande o link) para eu aplicar no código.</p>
          <textarea readOnly value={snippet} className="h-64 w-full resize-none rounded-lg border border-white/10 bg-black/40 p-2 font-mono text-[10px] text-on-surface-variant" />
        </div>
      </div>
    </div>
  );
}
