/**
 * Background-scenery drawing shared between the real game canvas (Goose2D.tsx) and the scene
 * editor (SceneEditor.tsx) - kept in one place so the editor's live preview renders pixel-identical
 * output to what actually ships in the game, instead of two implementations drifting apart.
 */

export function loadSprite(src: string): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  const img = new Image();
  img.src = src;
  return img;
}

// Kenney's CC0-licensed "Pixel Platformer" pack (kenney.nl) - an 18x18px tile grid with a 1px gap
// (19px stride) shared by every tile-based sheet in this game.
export const KENNEY_TILE_PX = 18;
export const KENNEY_TILE_STRIDE = 19;
export const KENNEY_TILEMAP = loadSprite("/sprites/kenney/tilemap.png");
// tilemap-backgrounds.png uses its own, larger grid (24x24 + 1px gap), measured directly off the
// sheet - it is not the same 18/19 grid as tilemap.png.
export const KENNEY_BG_TILE_PX = 24;
export const KENNEY_BG_TILE_STRIDE = 25;
export const KENNEY_BACKGROUNDS = loadSprite("/sprites/kenney/tilemap-backgrounds.png");
// Companion character sheet from the same pack (not the same grid as tilemap.png - characters are
// different pixel sizes, so each one is addressed by its own hand-measured rect below rather than
// a fixed stride).
export const KENNEY_CHARACTERS = loadSprite("/sprites/kenney/tilemap-characters.png");

// The bat's 3-frame flap cycle (wings up, spread, folded down), hand-measured off
// tilemap-characters.png by scanning for its alpha bounding box within its grid cell - used as the
// flying obstacle instead of a procedurally-drawn shape, so it reads as one more piece of the same
// pixel-art set instead of a smooth vector shape clashing with everything else.
export const BIRD_FRAMES: SourceRect[] = [
  { x: 153, y: 54, w: 18, h: 17 },
  { x: 175, y: 58, w: 24, h: 12 },
  { x: 203, y: 57, w: 18, h: 13 },
];

export function colorWithAlpha(rgb: string, alpha: number): string {
  return rgb.replace("rgb", "rgba").replace(")", `, ${alpha})`);
}

/** Arbitrary source-pixel rectangle (not grid-snapped) - lets the scene editor (and the biome
 *  variants below) grab a region without being confined to one sheet's particular tile grid. */
export interface SourceRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const regionCache = new Map<string, HTMLCanvasElement>();

export function getTintedRegion(img: HTMLImageElement | null, rect: SourceRect, color: string, mode: "atop" | "multiply"): HTMLCanvasElement | null {
  if (!img || !img.complete || img.naturalWidth === 0 || rect.w <= 0 || rect.h <= 0) return null;
  const key = `${img.src}|${rect.x},${rect.y},${rect.w},${rect.h}|${color}|${mode}`;
  const cached = regionCache.get(key);
  if (cached) return cached;
  const off = document.createElement("canvas");
  off.width = rect.w;
  off.height = rect.h;
  const octx = off.getContext("2d")!;
  octx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  octx.globalCompositeOperation = mode === "multiply" ? "multiply" : "source-atop";
  octx.fillStyle = color;
  octx.fillRect(0, 0, rect.w, rect.h);
  regionCache.set(key, off);
  return off;
}

export type SpriteSheetId = "tilemap" | "backgrounds";
export type Tint = "atop" | "multiply" | "none";

export function sheetImage(sheet: SpriteSheetId): HTMLImageElement | null {
  return sheet === "tilemap" ? KENNEY_TILEMAP : KENNEY_BACKGROUNDS;
}

export interface Placement {
  rect: SourceRect;
  /** Left edge in pattern-local px, freely chosen - not grid-snapped. */
  x: number;
}

export interface PaintedLayer {
  placements: Placement[];
  color: string;
  tileSize: number;
  baseYOffset: number;
  speed: number;
  sheet: SpriteSheetId;
  tint: Tint;
  /** Width of one loop of the row, in pattern-local px. */
  patternWidth: number;
}

/** Tiles a hand-placed set of regions across the full width, looping every `patternWidth` px - each
 *  placement renders at the layer's tileSize height, width scaled to match the picked region's own
 *  aspect ratio. Shared by the scene editor's live preview and the real game so they never drift
 *  apart from each other. */
export function drawPaintedRow(ctx: CanvasRenderingContext2D, width: number, baseY: number, phasePx: number, layer: PaintedLayer) {
  const { placements, tileSize, sheet, tint, color, patternWidth } = layer;
  if (placements.length === 0 || patternWidth <= 0) return;
  const shiftPx = (((phasePx % patternWidth) + patternWidth) % patternWidth) - patternWidth;
  const repeats = Math.ceil(width / patternWidth) + 2;
  ctx.imageSmoothingEnabled = false;
  for (let r = -1; r < repeats; r++) {
    for (const p of placements) {
      const rect = p.rect;
      // Rounded to whole device pixels - with imageSmoothingEnabled off, adjacent tiles drawn at
      // fractional x can round to different pixels and leave a 1px seam between them while
      // scrolling (shiftPx is only ever fractional mid-scroll, which is why the gap only shows up
      // while the scene is animating and disappears the instant it's paused).
      const dx = Math.round(r * patternWidth + p.x + shiftPx);
      const drawH = tileSize;
      const drawW = Math.round(tileSize * (rect.w / rect.h));
      const img = tint === "none" ? sheetImage(sheet) : null;
      if (tint === "none" && img) {
        ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, dx, baseY - drawH, drawW, drawH);
      } else {
        const tinted = getTintedRegion(sheetImage(sheet), rect, color, tint === "multiply" ? "multiply" : "atop");
        if (tinted) ctx.drawImage(tinted, dx, baseY - drawH, drawW, drawH);
      }
    }
  }
}

/** Draws the ground: `groundFill` stacked in rows from just below the top cap down to the canvas
 *  bottom, then `groundTop` painted over the seam - shared by the real game and the editor preview
 *  so a design authored in one renders identically in the other. */
export function drawGroundLayers(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  groundY: number,
  groundOffset: number,
  scale: number,
  groundTop: PaintedLayer,
  groundFill: PaintedLayer
) {
  const topBaseY = groundY + groundTop.tileSize;
  const fillTileSize = Math.max(1, groundFill.tileSize);
  const fillRows = Math.ceil((height - topBaseY) / fillTileSize) + 1;
  const topPhase = -groundOffset * scale * groundTop.speed;
  const fillPhase = -groundOffset * scale * groundFill.speed;
  for (let r = 0; r < fillRows; r++) {
    drawPaintedRow(ctx, width, topBaseY + (r + 1) * fillTileSize, fillPhase, groundFill);
  }
  drawPaintedRow(ctx, width, topBaseY, topPhase, groundTop);
}

export interface SceneConfig {
  forestFar: PaintedLayer;
  forestNear: PaintedLayer;
  decor: PaintedLayer;
  groundTop: PaintedLayer;
  groundFill: PaintedLayer;
}

// Authored in the /goose/editor scene composer, then handed back and pasted in verbatim - this is
// the actual shipped background, not a placeholder. The sky and the tree/mountain silhouette are
// biome-specific (see BIOME_SKY_TILE / BIOME_MOUNTAIN_TILES further down), not part of this config.
export const DEFAULT_SCENE_CONFIG: SceneConfig = {
  forestFar: {
    sheet: "tilemap",
    tint: "atop",
    color: "#2a3050",
    tileSize: 40,
    baseYOffset: 2,
    speed: 0.06,
    patternWidth: 320,
    placements: [],
  },
  forestNear: {
    sheet: "tilemap",
    tint: "atop",
    color: "#080810",
    tileSize: 56,
    baseYOffset: -2,
    speed: 0.14,
    patternWidth: 448,
    placements: [],
  },
  decor: {
    sheet: "tilemap",
    tint: "none",
    color: "#ffffff",
    tileSize: 24,
    baseYOffset: 2,
    speed: 0.14,
    patternWidth: 192,
    placements: [],
  },
  groundTop: {
    sheet: "tilemap",
    tint: "none",
    color: "#ffffff",
    tileSize: 22,
    baseYOffset: 0,
    speed: 1,
    patternWidth: 176,
    placements: [{ x: 92, rect: { x: 38, y: 0, w: 18, h: 18 } }, { x: 160, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 134, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 106, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 116, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 135, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 149, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 70, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 48, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 26, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 4, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: -18, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 4, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 4, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 70, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 70, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 88, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 90, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 94, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 108, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 140, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 109, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 130, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 153, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 162, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 163, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 150, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 132, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 114, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 89, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 77, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 55, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 32, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 15, rect: { x: 38, y: 19, w: 18, h: 18 } }, { x: 0, rect: { x: 38, y: 19, w: 18, h: 18 } }],
  },
  groundFill: {
    sheet: "tilemap",
    tint: "none",
    color: "#ffffff",
    tileSize: 22,
    baseYOffset: 0,
    speed: 1,
    patternWidth: 176,
    placements: [{ x: 28, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: -3, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 6, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 50, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 28, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 20, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 20, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 43, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 52, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 74, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 80, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 101, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 87, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 65, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 64, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 123, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 129, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 127, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 118, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 115, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 143, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 147, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 153, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 160, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 150, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 156, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 158, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 155, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 135, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 127, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 117, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 107, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 97, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 84, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 74, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 65, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 53, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 45, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 33, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 19, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 3, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: -7, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: -7, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: -3, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 17, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 35, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 45, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 52, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 89, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 147, rect: { x: 76, y: 95, w: 18, h: 18 } }, { x: 109, rect: { x: 76, y: 95, w: 18, h: 18 } }],
  },
};

// --- Biomes -----------------------------------------------------------------------------------
// Every ~100 points the running game swaps to the next biome: only the sky fill and the ground's
// top-cap tiles change (the dirt fill underneath, and the empty mountain/forest/decor layers,
// stay put) - matching the request to keep the swap lightweight rather than reshuffling everything.

export type BiomeId = "forest" | "desert" | "ice";

export const BIOME_ORDER: BiomeId[] = ["forest", "desert", "ice"];

/** Ground-cap tile pairs (bordered variant / seamless variant, same convention as the forest pair
 *  already authored in DEFAULT_SCENE_CONFIG.groundTop) - measured directly off tilemap.png's
 *  cols 0-3: rows 0-1 are grass-topped dirt, rows 2-3 are sand-topped dirt, rows 4-5 are
 *  snow-topped dirt, all sharing the same col 2 the authored design already uses. */
const BIOME_GROUND_TOP_VARIANTS: Record<BiomeId, { a: SourceRect; b: SourceRect }> = {
  forest: { a: { x: 2 * KENNEY_TILE_STRIDE, y: 0 * KENNEY_TILE_STRIDE, w: KENNEY_TILE_PX, h: KENNEY_TILE_PX }, b: { x: 2 * KENNEY_TILE_STRIDE, y: 1 * KENNEY_TILE_STRIDE, w: KENNEY_TILE_PX, h: KENNEY_TILE_PX } },
  desert: { a: { x: 2 * KENNEY_TILE_STRIDE, y: 2 * KENNEY_TILE_STRIDE, w: KENNEY_TILE_PX, h: KENNEY_TILE_PX }, b: { x: 2 * KENNEY_TILE_STRIDE, y: 3 * KENNEY_TILE_STRIDE, w: KENNEY_TILE_PX, h: KENNEY_TILE_PX } },
  ice: { a: { x: 2 * KENNEY_TILE_STRIDE, y: 4 * KENNEY_TILE_STRIDE, w: KENNEY_TILE_PX, h: KENNEY_TILE_PX }, b: { x: 2 * KENNEY_TILE_STRIDE, y: 5 * KENNEY_TILE_STRIDE, w: KENNEY_TILE_PX, h: KENNEY_TILE_PX } },
};

// Flat sky-fill tile (row 0) from tilemap-backgrounds.png, one representative column per biome
// group (ice spans cols 0-3, desert cols 4-5, forest cols 6-7 - every column within a group is the
// same flat color, so any one of them works).
export const BIOME_SKY_TILE: Record<BiomeId, SourceRect> = {
  forest: { x: 6 * KENNEY_BG_TILE_STRIDE, y: 0, w: KENNEY_BG_TILE_PX, h: KENNEY_BG_TILE_PX },
  desert: { x: 4 * KENNEY_BG_TILE_STRIDE, y: 0, w: KENNEY_BG_TILE_PX, h: KENNEY_BG_TILE_PX },
  ice: { x: 0, y: 0, w: KENNEY_BG_TILE_PX, h: KENNEY_BG_TILE_PX },
};

function sameRect(a: SourceRect, b: SourceRect): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/** Remaps the authored (forest) ground-top layer onto another biome's tile pair, preserving every
 *  placement's x position and which variant (a/b) it used - the hand-tuned spacing/mix carries over
 *  to every biome for free instead of needing to be re-authored per biome. */
export function getBiomeGroundTop(base: PaintedLayer, biome: BiomeId): PaintedLayer {
  if (biome === "forest") return base;
  const forest = BIOME_GROUND_TOP_VARIANTS.forest;
  const target = BIOME_GROUND_TOP_VARIANTS[biome];
  return {
    ...base,
    placements: base.placements.map((p) => {
      if (sameRect(p.rect, forest.a)) return { ...p, rect: target.a };
      if (sameRect(p.rect, forest.b)) return { ...p, rect: target.b };
      return p;
    }),
  };
}

/** Fills the whole canvas with the current biome's flat sky tile from tilemap-backgrounds.png,
 *  stretched to size - a real Kenney sprite instead of a code-drawn gradient, per biome. Drawn raw
 *  (no tint): row 0 (this) and row 1 (drawBiomeMountain below) are meant to be used together at
 *  their native colors, not recolored. */
export function drawSkyFill(ctx: CanvasRenderingContext2D, width: number, height: number, biome: BiomeId) {
  const img = KENNEY_BACKGROUNDS;
  const rect = BIOME_SKY_TILE[biome];
  if (!img || !img.complete || img.naturalWidth === 0) {
    ctx.fillStyle = "#0b0e16";
    ctx.fillRect(0, 0, width, height);
    return;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, width, height);
}

// Row 1 of tilemap-backgrounds.png: a hand-painted tree/mountain silhouette, one column per
// variant (a plain fill plus a bushier/detailed accent) within each biome's group - ice cols 0-3,
// desert cols 4-5, forest cols 6-7. Each column is its own clean 24x24 tile with no gap inside it;
// grabbing more than one column at once crosses the sheet's 1px transparent grid seam between
// cells, which is what caused the visible gaps. Tiling single columns and alternating between them
// (same trick as the ground's grass variants) keeps it seamless while still varying the shape.
export const BIOME_MOUNTAIN_TILES: Record<BiomeId, SourceRect[]> = {
  forest: [0, 1].map((i) => ({ x: (6 + i) * KENNEY_BG_TILE_STRIDE, y: KENNEY_BG_TILE_STRIDE, w: KENNEY_BG_TILE_PX, h: KENNEY_BG_TILE_PX })),
  desert: [0, 1].map((i) => ({ x: (4 + i) * KENNEY_BG_TILE_STRIDE, y: KENNEY_BG_TILE_STRIDE, w: KENNEY_BG_TILE_PX, h: KENNEY_BG_TILE_PX })),
  ice: [0, 1, 2, 3].map((i) => ({ x: i * KENNEY_BG_TILE_STRIDE, y: KENNEY_BG_TILE_STRIDE, w: KENNEY_BG_TILE_PX, h: KENNEY_BG_TILE_PX })),
};

/** Tiles the row-1 silhouette edge-to-edge, alternating between the biome's variant columns by
 *  absolute tile index (so a given tile keeps its shape as it scrolls through view, same as the
 *  old hash-scatter functions did) - drawn raw, at the sheet's native colors (see drawSkyFill
 *  above), bottom-aligned to `baseY` so it sits like a hill/tree line right behind the runner. */
export function drawBiomeMountain(ctx: CanvasRenderingContext2D, width: number, baseY: number, phasePx: number, biome: BiomeId, tileSize: number) {
  const img = KENNEY_BACKGROUNDS;
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const tiles = BIOME_MOUNTAIN_TILES[biome];
  const shiftPx = (((phasePx % tileSize) + tileSize) % tileSize) - tileSize;
  const tileIndexOffset = Math.floor(phasePx / tileSize);
  const count = Math.ceil((width - shiftPx) / tileSize) + 1;
  ctx.imageSmoothingEnabled = false;
  for (let i = -1; i <= count; i++) {
    const tile = tiles[(((i + tileIndexOffset) % tiles.length) + tiles.length) % tiles.length];
    // Rounded for the same reason as drawPaintedRow above - shiftPx is fractional while scrolling,
    // and unrounded fractional x positions round independently per tile, leaving a 1px seam.
    ctx.drawImage(img, tile.x, tile.y, tile.w, tile.h, Math.round(i * tileSize + shiftPx), baseY - tileSize, tileSize, tileSize);
  }
}
