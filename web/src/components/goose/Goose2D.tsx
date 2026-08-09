"use client";

import { useEffect, useRef } from "react";
import { Obstacle, GOOSE_X } from "@/lib/goose/model";
import {
  loadSprite,
  KENNEY_TILEMAP,
  KENNEY_TILE_PX,
  KENNEY_TILE_STRIDE,
  KENNEY_CHARACTERS,
  BIRD_FRAMES,
  DEFAULT_SCENE_CONFIG,
  BIOME_ORDER,
  getBiomeGroundTop,
  drawSkyFill,
  drawBiomeMountain,
  drawPaintedRow,
  drawGroundLayers,
  PaintedLayer,
} from "@/lib/goose/scenery";

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

const GOOSE_SHEETS = {
  idle: { img: loadSprite("/sprites/goose/Idle.png"), frames: 2 },
  run: { img: loadSprite("/sprites/goose/Run.png"), frames: 4 },
  flap: { img: loadSprite("/sprites/goose/Flap.png"), frames: 4 },
};

// Same coords as DEFAULT_SCENE_CONFIG.hillDecor's cactus entry - obstacles reuse this tile
// directly (rather than importing the whole decor list) since they only ever draw this one shape.
const CACTUS_DECOR_TILE = { col: 7, row: 6 };

const PIXELS_PER_UNIT = 44;
const ANCHOR_X_FRACTION = 0.17;
const GROUND_Y_FRACTION = 0.74;

/** `groundOffset` doubles as the score shown by `drawScore` below, so this is literally "every 100
 *  points" - cycles through BIOME_ORDER (forest -> desert -> ice -> forest -> ...). */
const POINTS_PER_BIOME = 100;

const BIOME_MOUNTAIN_TILE_HEIGHT = 104;
const BIOME_MOUNTAIN_SPEED = 0.05;

/** How many of each biome's 100 points are spent crossfading into the next one, instead of the
 *  sky/mountain/ground-cap hard-cutting the instant `groundOffset` crosses a POINTS_PER_BIOME
 *  boundary - the next biome's layers fade in on top of the current one over this window. */
const BIOME_TRANSITION_WIDTH = 22;

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

// How much bigger than its own hitbox the bird is drawn - the collision box (0.6x0.4 units) is
// sized for fair gameplay, not legibility, so the sprite is scaled up around that same center
// point purely for visibility, same idea as GOOSE_DRAW_UNITS below for the runner itself.
const BIRD_DRAW_SCALE = 1.7;
// Ping-pongs through the 3 flap frames (up, spread, down, spread, up, ...) instead of just
// cycling 0-1-2-0-1-2, which would jump straight from "wings down" back to "wings up" - a real
// flap eases through the middle pose both ways. Position-driven (not time-driven) keeps it a pure
// function of the frame state, matching how the rest of this canvas has no animation clock of
// its own.
const BIRD_FLAP_SEQUENCE = [0, 1, 2, 1];

/** Drawn from the same Kenney "Pixel Platformer" character sheet as the rest of the scenery's
 *  tiles (a bat, reused as this game's flying obstacle) instead of a hand-drawn vector shape -
 *  keeps it visually consistent with the cactus/ground tiles rather than standing out as the one
 *  smooth, anti-aliased shape among crisp pixel art. */
function drawBird(ctx: CanvasRenderingContext2D, view: View, o: Obstacle) {
  const img = KENNEY_CHARACTERS;
  if (!img || !img.complete || img.naturalWidth === 0) return;
  // o.x runs negative just before the obstacle despawns (DESPAWN_X = -4), and JS's % keeps the
  // sign of the dividend - a plain modulo would go negative there and index undefined out of the
  // sequence array, so it's normalized into [0, length) first.
  const step = ((Math.floor(o.x * 2.2) % BIRD_FLAP_SEQUENCE.length) + BIRD_FLAP_SEQUENCE.length) % BIRD_FLAP_SEQUENCE.length;
  const frame = BIRD_FRAMES[BIRD_FLAP_SEQUENCE[step]];

  const cx = worldToScreenX(view, o.x);
  const cy = view.groundY - (o.y + o.height / 2) * view.scale;
  const drawH = o.height * view.scale * BIRD_DRAW_SCALE;
  const drawW = drawH * (frame.w / frame.h);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
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

    const scene = DEFAULT_SCENE_CONFIG;
    // Every POINTS_PER_BIOME points the biome advances - the sky fill, the mountain silhouette
    // scene, and the ground's top cap swap (the empty forest/decor layers and the dirt fill stay
    // put). Over the last BIOME_TRANSITION_WIDTH points of each biome, the upcoming biome's layers
    // fade in on top so the swap reads as a crossfade instead of a hard cut.
    const rawBiomeIndex = Math.max(0, groundOffset) / POINTS_PER_BIOME;
    const biomeIndex = Math.floor(rawBiomeIndex) % BIOME_ORDER.length;
    const biome = BIOME_ORDER[biomeIndex];
    const nextBiome = BIOME_ORDER[(biomeIndex + 1) % BIOME_ORDER.length];
    const posInBiome = (rawBiomeIndex - Math.floor(rawBiomeIndex)) * POINTS_PER_BIOME;
    const transitionT = Math.max(0, Math.min(1, (posInBiome - (POINTS_PER_BIOME - BIOME_TRANSITION_WIDTH)) / BIOME_TRANSITION_WIDTH));

    drawSkyFill(ctx, width, height, biome);
    if (transitionT > 0) {
      ctx.globalAlpha = transitionT;
      drawSkyFill(ctx, width, height, nextBiome);
      ctx.globalAlpha = 1;
    }

    const mountainPhase = -groundOffset * view.scale * BIOME_MOUNTAIN_SPEED;
    drawBiomeMountain(ctx, width, view.groundY, mountainPhase, biome, BIOME_MOUNTAIN_TILE_HEIGHT);
    if (transitionT > 0) {
      ctx.globalAlpha = transitionT;
      drawBiomeMountain(ctx, width, view.groundY, mountainPhase, nextBiome, BIOME_MOUNTAIN_TILE_HEIGHT);
      ctx.globalAlpha = 1;
    }

    const layerPhase = (layer: PaintedLayer) => -groundOffset * view.scale * layer.speed;
    drawPaintedRow(ctx, width, view.groundY - scene.forestFar.baseYOffset, layerPhase(scene.forestFar), scene.forestFar);
    drawPaintedRow(ctx, width, view.groundY - scene.forestNear.baseYOffset, layerPhase(scene.forestNear), scene.forestNear);
    drawPaintedRow(ctx, width, view.groundY - scene.decor.baseYOffset, layerPhase(scene.decor), scene.decor);

    const groundTop = getBiomeGroundTop(scene.groundTop, biome);
    drawGroundLayers(ctx, width, height, view.groundY, groundOffset, view.scale, groundTop, scene.groundFill);
    if (transitionT > 0) {
      const nextGroundTop = getBiomeGroundTop(scene.groundTop, nextBiome);
      const topBaseY = view.groundY + groundTop.tileSize;
      const topPhase = -groundOffset * view.scale * groundTop.speed;
      ctx.globalAlpha = transitionT;
      drawPaintedRow(ctx, width, topBaseY, topPhase, nextGroundTop);
      ctx.globalAlpha = 1;
    }

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
