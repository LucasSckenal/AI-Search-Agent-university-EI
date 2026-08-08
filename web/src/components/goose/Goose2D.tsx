"use client";

import { useEffect, useRef } from "react";
import { Obstacle, GOOSE_X } from "@/lib/goose/model";

export interface GooseRenderState {
  y: number;
  isDucking: boolean;
  isJumping: boolean;
  alive: boolean;
  highlight: boolean;
  /** Cycles 0-3 while running so the gait advances through the sprite sheet's 4 running frames,
   *  instead of a single frozen pose. */
  runPhase: number;
}

const SKY_TOP_COLOR = "#080a12";
const BACKDROP_COLOR = "#11131a";
const HILL_FAR_COLOR = "#1a1e2c";
const BIRD_COLOR = "#ffb77b";
const BIRD_EDGE_COLOR = "#a35f2c";

// Fill color for the evolving population sweeps from a dull, unrefined slate at generation 0 to a
// warm, saturated amber by the final generation - a "later generation" should visibly look like a
// more evolved result at a glance, not just say so in the readout text above the canvas.
const EARLY_GEN_COLOR: [number, number, number] = [107, 118, 138];
const LATE_GEN_COLOR: [number, number, number] = [255, 176, 74];

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(a[0] + (b[0] - a[0]) * clamped);
  const g = Math.round(a[1] + (b[1] - a[1]) * clamped);
  const bch = Math.round(a[2] + (b[2] - a[2]) * clamped);
  return `rgb(${r}, ${g}, ${bch})`;
}

/**
 * The runner is drawn from a real downloaded sprite sheet (CC0-licensed "Goose" pack by Duckhive,
 * itch.io) instead of a procedural outline - each animation is a horizontal strip of 64x64px
 * frames. Loaded once, lazily, guarded against SSR (no `Image`/`window` in the Node build step).
 */
const GOOSE_FRAME_PX = 64;
// Row (from the frame's top) where the goose's feet sit - measured directly from the source art,
// consistent across every frame of every sheet even though the art's left/right/top edges shift
// with the gait. The frame itself is much taller than the visible goose (lots of transparent
// padding below), so anchoring on the frame's own bottom edge would float the sprite off the
// ground - this is the real contact point to line up with `view.groundY` instead.
const GOOSE_ART_BOTTOM_PX = 31;

function loadSprite(src: string): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  const img = new Image();
  img.src = src;
  return img;
}

const GOOSE_SHEETS = {
  idle: { img: loadSprite("/sprites/goose/Idle.png"), frames: 2 },
  run: { img: loadSprite("/sprites/goose/Run.png"), frames: 4 },
  flap: { img: loadSprite("/sprites/goose/Flap.png"), frames: 4 },
};

/**
 * Ground/scenery tiles come from Kenney's CC0-licensed "Pixel Platformer" pack instead of the
 * earlier procedural dashes-and-dots ground - the sheet is a grid of 18x18px tiles with a 1px gap
 * (19px stride), coordinates found by inspecting the sheet directly.
 */
const KENNEY_TILE_PX = 18;
const KENNEY_TILE_STRIDE = 19;
const KENNEY_TILEMAP = loadSprite("/sprites/kenney/tilemap.png");
const GRASS_TILE = { col: 0, row: 0 };
const TREE_TILE = { col: 6, row: 6 };
const CACTUS_DECOR_TILE = { col: 7, row: 6 };
const BUSH_TILE = { col: 4, row: 6 };
const GROUND_TILE_WORLD_UNITS = 0.5;
const HILL_DECOR: { col: number; row: number }[] = [TREE_TILE, CACTUS_DECOR_TILE, BUSH_TILE, TREE_TILE, BUSH_TILE];
const DECOR_SPACING_PX = 130;

const PIXELS_PER_UNIT = 44;
const ANCHOR_X_FRACTION = 0.17;
const GROUND_Y_FRACTION = 0.74;

// Fixed star field, generated once at module load - the sky above the ground line was mostly
// dead space before; stars/moon/hills give it depth without competing with the runner itself.
const STARS: { xf: number; yf: number; r: number; a: number }[] = Array.from({ length: 46 }, () => ({
  xf: Math.random(),
  yf: Math.random() * 0.62,
  r: Math.random() * 1.1 + 0.4,
  a: Math.random() * 0.5 + 0.25,
}));

function drawSky(ctx: CanvasRenderingContext2D, width: number, height: number, groundY: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, SKY_TOP_COLOR);
  sky.addColorStop(1, BACKDROP_COLOR);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
}

function drawStars(ctx: CanvasRenderingContext2D, width: number, height: number) {
  for (const s of STARS) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = "#e8ecff";
    ctx.beginPath();
    ctx.arc(s.xf * width, s.yf * height, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMoon(ctx: CanvasRenderingContext2D, width: number, height: number, color: string) {
  const mx = width * 0.83;
  const my = height * 0.16;
  const r = 13;
  const glow = ctx.createRadialGradient(mx, my, 0, mx, my, r * 3.2);
  glow.addColorStop(0, colorWithAlpha(color, 0.3));
  glow.addColorStop(1, colorWithAlpha(color, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(mx, my, r * 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(mx, my, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = SKY_TOP_COLOR;
  ctx.beginPath();
  ctx.arc(mx + r * 0.42, my - r * 0.18, r * 0.86, 0, Math.PI * 2);
  ctx.fill();
}

/** A soft repeating sine silhouette, scrolled slower than the ground for parallax depth. */
function drawHillLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  baseY: number,
  amplitude: number,
  wavelength: number,
  phase: number,
  color: string
) {
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  for (let x = 0; x <= width; x += 10) {
    const y = baseY - amplitude * (0.5 + 0.5 * Math.sin(((x + phase) / wavelength) * Math.PI * 2));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, baseY + 4);
  ctx.lineTo(0, baseY + 4);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function colorWithAlpha(rgb: string, alpha: number): string {
  return rgb.replace("rgb", "rgba").replace(")", `, ${alpha})`);
}

function drawKenneyTile(ctx: CanvasRenderingContext2D, tile: { col: number; row: number }, dx: number, dy: number, size: number) {
  const img = KENNEY_TILEMAP;
  if (!img || !img.complete || img.naturalWidth === 0) return;
  ctx.drawImage(img, tile.col * KENNEY_TILE_STRIDE, tile.row * KENNEY_TILE_STRIDE, KENNEY_TILE_PX, KENNEY_TILE_PX, dx, dy, size, size);
}

// Sampled from the tile art's own dirt tone, so the solid fill below the single tile row reads
// as a continuation of the block instead of a visibly different color.
const GROUND_FILL_COLOR = "#8a5a3b";

/** A single row of the grass-top dirt tile across the ground band, scrolling in lockstep with
 *  the same `groundOffset` the obstacles and score readout already use - stacking many tile rows
 *  read as a wall of repeated mini-blocks, so everything below that one row is just a flat fill
 *  in the tile's own dirt tone instead. */
function drawGroundTiles(ctx: CanvasRenderingContext2D, view: View, width: number, height: number, groundOffset: number) {
  const tileSize = GROUND_TILE_WORLD_UNITS * view.scale;
  const shiftPx = (((groundOffset * view.scale) % tileSize) + tileSize) % tileSize;
  const cols = Math.ceil(width / tileSize) + 2;
  ctx.fillStyle = GROUND_FILL_COLOR;
  ctx.fillRect(0, view.groundY + tileSize, width, height - view.groundY - tileSize);
  ctx.imageSmoothingEnabled = false;
  for (let c = -1; c < cols; c++) {
    drawKenneyTile(ctx, GRASS_TILE, c * tileSize - shiftPx, view.groundY, tileSize);
  }
}

/** Scatters trees/cacti/bushes along the near hill line, parallax-scrolled slower than the
 *  ground so they read as background scenery instead of ground-level obstacles. */
function drawHillDecor(ctx: CanvasRenderingContext2D, view: View, width: number, groundY: number, nearPhasePx: number) {
  const decorSize = view.scale * 0.55;
  const shiftPx = ((-nearPhasePx % DECOR_SPACING_PX) + DECOR_SPACING_PX) % DECOR_SPACING_PX;
  const count = Math.ceil(width / DECOR_SPACING_PX) + 2;
  ctx.imageSmoothingEnabled = false;
  for (let i = -1; i < count; i++) {
    const tile = HILL_DECOR[((i % HILL_DECOR.length) + HILL_DECOR.length) % HILL_DECOR.length];
    const x = i * DECOR_SPACING_PX - shiftPx;
    drawKenneyTile(ctx, tile, x - decorSize / 2, groundY - decorSize + 5, decorSize);
  }
}

interface View {
  scale: number;
  anchorX: number;
  groundY: number;
}

function worldToScreenX(view: View, worldX: number): number {
  return view.anchorX + (worldX - GOOSE_X) * view.scale;
}

/** The obstacle cactus reuses the same Kenney cactus tile as the hill decor, stretched
 *  non-uniformly to fill the obstacle's own randomized width/height so it still lines up with
 *  the physics model's collision box. */
function drawCactus(ctx: CanvasRenderingContext2D, view: View, o: Obstacle) {
  const cx = worldToScreenX(view, o.x);
  const w = o.width * view.scale;
  const h = o.height * view.scale;
  const img = KENNEY_TILEMAP;
  if (!img || !img.complete || img.naturalWidth === 0) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    img,
    CACTUS_DECOR_TILE.col * KENNEY_TILE_STRIDE,
    CACTUS_DECOR_TILE.row * KENNEY_TILE_STRIDE,
    KENNEY_TILE_PX,
    KENNEY_TILE_PX,
    cx - w / 2,
    view.groundY - h,
    w,
    h
  );
}

/** A pterodactyl-style silhouette (body, downturned beak, and a two-segment zigzag wing) instead
 *  of a single flat rotated rectangle - the wing's chevron flips between an up-flap and a
 *  down-flap based on the obstacle's own x position, so it visibly flies as it scrolls by rather
 *  than gliding motionless. Position-driven (not time-driven) keeps it a pure function of the
 *  frame state, matching how the rest of this canvas has no animation clock of its own. */
function drawBird(ctx: CanvasRenderingContext2D, view: View, o: Obstacle) {
  const cx = worldToScreenX(view, o.x);
  const cy = view.groundY - (o.y + o.height / 2) * view.scale;
  const w = o.width * view.scale;
  const h = o.height * view.scale;
  const flapUp = Math.floor(o.x * 2.2) % 2 === 0;

  ctx.fillStyle = BIRD_COLOR;
  ctx.strokeStyle = BIRD_EDGE_COLOR;
  ctx.lineWidth = 1.5;

  const rect = (x: number, y: number, rw: number, rh: number) => {
    ctx.fillRect(x, y, rw, rh);
    ctx.strokeRect(x, y, rw, rh);
  };

  rect(cx - w * 0.24, cy - h * 0.17, w * 0.48, h * 0.34);

  ctx.save();
  ctx.translate(cx + w * 0.22, cy - h * 0.01);
  ctx.rotate(-0.22);
  rect(0, -h * 0.09, w * 0.2, h * 0.18);
  ctx.restore();

  const innerAngle = flapUp ? -0.95 : 0.5;
  const outerAngle = flapUp ? -0.3 : 1.15;
  ctx.save();
  ctx.translate(cx - w * 0.02, cy - h * 0.07);
  ctx.rotate(innerAngle);
  rect(-w * 0.03, -h * 0.07, w * 0.3, h * 0.15);
  ctx.restore();
  ctx.save();
  ctx.translate(cx - w * 0.26, cy - h * 0.07);
  ctx.rotate(outerAngle);
  rect(-w * 0.02, -h * 0.06, w * 0.26, h * 0.13);
  ctx.restore();
}

/** World-unit height of a drawn 64px sprite frame (frame includes transparent padding around the
 *  actual goose art, so this reads larger than the runner's real ~0.9-unit collision height). */
const GOOSE_DRAW_UNITS = 2;

/** The Run sheet's 4 frames only shift the leg art by 1-3px at native resolution, which reads as
 *  a flicker rather than a gait once scaled down. A synthetic sine-wave vertical bob across the
 *  4-frame cycle sells a running rhythm on top of (not instead of) the sprite's own frame changes. */
const RUN_BOB_UNITS = 0.09;

/** Tints one 64x64 frame toward the generation color on a scratch canvas first, so `source-atop`
 *  masks against the sprite's own alpha instead of whatever's already painted on the main canvas
 *  (compositing straight onto the main canvas would tint the entire destination rectangle, since
 *  the sky/ground behind it is already opaque). */
function tintFrame(img: HTMLImageElement, frameIndex: number, color: string): HTMLCanvasElement {
  const off = document.createElement("canvas");
  off.width = GOOSE_FRAME_PX;
  off.height = GOOSE_FRAME_PX;
  const octx = off.getContext("2d")!;
  octx.drawImage(img, frameIndex * GOOSE_FRAME_PX, 0, GOOSE_FRAME_PX, GOOSE_FRAME_PX, 0, 0, GOOSE_FRAME_PX, GOOSE_FRAME_PX);
  octx.globalCompositeOperation = "source-atop";
  octx.globalAlpha = 0.5;
  octx.fillStyle = color;
  octx.fillRect(0, 0, GOOSE_FRAME_PX, GOOSE_FRAME_PX);
  return off;
}

/** Draws one frame of a goose sheet (the source art already faces +x, the oncoming obstacles),
 *  tinted toward the generation color so the sprite still carries the gray->amber evolution cue
 *  instead of staying a flat white bitmap regardless of generation. `squash` fakes a duck pose
 *  (the pack has no crouch animation) by flattening the frame toward the ground. */
function drawGooseFrame(
  ctx: CanvasRenderingContext2D,
  view: View,
  sheet: { img: HTMLImageElement | null; frames: number },
  frameIndex: number,
  localY: number,
  color: string,
  opacity: number,
  squash: number
) {
  const img = sheet.img;
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const frame = ((frameIndex % sheet.frames) + sheet.frames) % sheet.frames;
  const tinted = tintFrame(img, frame, color);

  const drawH = GOOSE_DRAW_UNITS * view.scale * squash;
  const drawW = GOOSE_DRAW_UNITS * view.scale;
  const groundLocalPx = (GOOSE_ART_BOTTOM_PX / GOOSE_FRAME_PX) * drawH;
  const sx = worldToScreenX(view, GOOSE_X) - drawW / 2;
  const sy = view.groundY - localY * view.scale - groundLocalPx;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tinted, sx, sy, drawW, drawH);
  ctx.restore();
}

function drawGoose(ctx: CanvasRenderingContext2D, view: View, goose: GooseRenderState, color: string) {
  const opacity = goose.highlight ? 1 : 0.4;
  if (goose.isDucking) {
    drawGooseFrame(ctx, view, GOOSE_SHEETS.idle, 0, goose.y, color, opacity, 0.6);
  } else if (goose.isJumping) {
    drawGooseFrame(ctx, view, GOOSE_SHEETS.flap, goose.runPhase, goose.y, color, opacity, 1);
  } else {
    const bob = Math.sin((goose.runPhase / GOOSE_SHEETS.run.frames) * Math.PI * 2) * RUN_BOB_UNITS;
    drawGooseFrame(ctx, view, GOOSE_SHEETS.run, goose.runPhase, goose.y + bob, color, opacity, 1);
  }
}

/** Live "best score" readout, top-right, like the original game's own score counter - shows how
 *  far the leader of the watched generation has run in the current playback frame. */
function drawScore(ctx: CanvasRenderingContext2D, width: number, distance: number, color: string) {
  const text = String(Math.max(0, Math.round(distance))).padStart(5, "0");
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.font = "600 10px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "rgba(232,236,255,0.5)";
  ctx.fillText("MELHOR", width - 16, 14);
  ctx.font = "700 19px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = color;
  ctx.fillText(text, width - 16, 27);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

export function GooseCanvas({
  obstacles,
  geese,
  groundOffset = 0,
  generationRatio = 0,
}: {
  obstacles: Obstacle[];
  geese: GooseRenderState[];
  groundOffset?: number;
  generationRatio?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ width: 600, height: 260 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { width: rect.width, height: rect.height };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      render();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function render() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { width, height } = sizeRef.current;
    ctx.clearRect(0, 0, width, height);

    const view: View = { scale: PIXELS_PER_UNIT, anchorX: width * ANCHOR_X_FRACTION, groundY: height * GROUND_Y_FRACTION };
    const genColor = lerpColor(EARLY_GEN_COLOR, LATE_GEN_COLOR, generationRatio);

    drawSky(ctx, width, height, view.groundY);
    drawStars(ctx, width, view.groundY);
    drawMoon(ctx, width, height, genColor);

    const glow = ctx.createRadialGradient(view.anchorX, view.groundY, 10, view.anchorX, view.groundY, height * 0.9);
    glow.addColorStop(0, colorWithAlpha(genColor, 0.14));
    glow.addColorStop(1, colorWithAlpha(genColor, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const farPhase = -groundOffset * view.scale * 0.06;
    const nearPhase = -groundOffset * view.scale * 0.14;
    drawHillLayer(ctx, width, view.groundY - 6, 22, 220, farPhase, HILL_FAR_COLOR);
    drawHillDecor(ctx, view, width, view.groundY - 2, nearPhase);

    drawGroundTiles(ctx, view, width, height, groundOffset);

    ctx.strokeStyle = lerpColor(EARLY_GEN_COLOR, LATE_GEN_COLOR, generationRatio * 0.4);
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, view.groundY);
    ctx.lineTo(width, view.groundY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    for (const o of obstacles) {
      if (o.type === "bird") drawBird(ctx, view, o);
      else drawCactus(ctx, view, o);
    }

    const highlighted = geese.find((d) => d.highlight && d.alive);
    for (const d of geese) {
      if (!d.alive || d.highlight) continue;
      drawGoose(ctx, view, d, genColor);
    }
    if (highlighted) drawGoose(ctx, view, highlighted, genColor);

    const vignette = ctx.createRadialGradient(width / 2, height * 0.55, height * 0.35, width / 2, height * 0.55, height * 0.9);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    drawScore(ctx, width, groundOffset, genColor);
  }

  useEffect(() => {
    render();
  });

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}
