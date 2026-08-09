/**
 * Chrome-Dino-runner-style physics, pure functions only (mirrors src/lib/game/model.ts's
 * convention) - stepGame is a deterministic, replayable transition function so a genetic
 * algorithm can compare many agents against an identical obstacle sequence, and so a finished
 * generation can be re-simulated on demand for playback instead of having to record every frame.
 */

export type GooseAction = "none" | "jump" | "duck";
export type ObstacleType = "cactus" | "bird";

export interface Obstacle {
  id: number;
  type: ObstacleType;
  x: number;
  width: number;
  height: number;
  /** Height of the obstacle's bottom edge above the ground. */
  y: number;
}

export interface GooseRunState {
  y: number;
  vy: number;
  isJumping: boolean;
  isDucking: boolean;
  obstacles: Obstacle[];
  speed: number;
  distance: number;
  elapsed: number;
  alive: boolean;
  obstaclesCleared: number;
  /** Plain LCG seed (not a closure) - required for stepGame to stay pure/replayable. */
  rngSeed: number;
  nextSpawnAt: number;
  nextObstacleId: number;
}

export const GOOSE_DT = 1 / 60;
export const GRAVITY = -25;
export const JUMP_IMPULSE = 9;
export const GROUND_Y = 0;
export const GOOSE_X = 0;
export const GOOSE_WIDTH = 0.6;
export const GOOSE_HEIGHT = 1.0;
export const DUCK_WIDTH = 0.9;
export const DUCK_HEIGHT = 0.5;

const BASE_SPEED = 6;
const SPEED_RAMP = 0.15; // units/s gained per second elapsed
const MAX_SPEED = 14;

/** `distance` doubles as the on-screen score, and the scene cycles through its 3 biomes every 100
 *  points - so a run needs to reach at least 300 distance to have a chance of showing all of them.
 *  Below this many steps the speed ramp (BASE_SPEED -> MAX_SPEED over dt) can't get there even if
 *  the goose survives the whole run, so this is the floor for "Passos máximos". */
export const GOOSE_MIN_STEPS_FOR_FULL_BIOME_CYCLE = 2100;
const SPAWN_X = 14;
const DESPAWN_X = -4;
const BIRD_MIN_ELAPSED = 5; // birds only start appearing after this much survival time
const BIRD_HEIGHT_DUCK = 0.75; // goose must duck to clear this one
const BIRD_HEIGHT_JUMP = 0.05; // low enough that only jumping clears it (ducking doesn't lift the hitbox)

function nextRandom(seed: number): { value: number; seed: number } {
  const s = (seed * 1103515245 + 12345) & 0x7fffffff;
  return { value: s / 0x7fffffff, seed: s || 1 };
}

export function createInitialState(seed: number): GooseRunState {
  return {
    y: GROUND_Y,
    vy: 0,
    isJumping: false,
    isDucking: false,
    obstacles: [],
    speed: BASE_SPEED,
    distance: 0,
    elapsed: 0,
    alive: true,
    obstaclesCleared: 0,
    rngSeed: (seed >>> 0) || 1,
    nextSpawnAt: 1.2,
    nextObstacleId: 1,
  };
}

function aabbOverlap(
  ax: number,
  aw: number,
  ay: number,
  ah: number,
  bx: number,
  bw: number,
  by: number,
  bh: number
): boolean {
  return ax - aw / 2 < bx + bw / 2 && ax + aw / 2 > bx - bw / 2 && ay < by + bh && ay + ah > by;
}

/**
 * Advances the simulation by one fixed timestep. Pure: takes a state, returns a new one - never
 * mutates `state` or anything inside it, so a caller can safely re-run this against a stored
 * seed/genome to reproduce an exact past run frame-by-frame.
 */
export function stepGame(state: GooseRunState, action: GooseAction, dtSeconds: number): GooseRunState {
  if (!state.alive) return state;

  let { y, vy, isJumping, rngSeed, nextSpawnAt, nextObstacleId } = state;

  if (action === "jump" && !isJumping) {
    vy = JUMP_IMPULSE;
    isJumping = true;
  }

  vy += GRAVITY * dtSeconds;
  y += vy * dtSeconds;
  if (y <= GROUND_Y) {
    y = GROUND_Y;
    vy = 0;
    isJumping = false;
  }

  const isDucking = action === "duck" && !isJumping;
  const elapsed = state.elapsed + dtSeconds;
  const speed = Math.min(MAX_SPEED, BASE_SPEED + elapsed * SPEED_RAMP);
  const distance = state.distance + speed * dtSeconds;

  let obstacles = state.obstacles
    .map((o) => ({ ...o, x: o.x - speed * dtSeconds }))
    .filter((o) => o.x > DESPAWN_X);
  const obstaclesCleared = state.obstaclesCleared + (state.obstacles.length - obstacles.length);

  if (elapsed >= nextSpawnAt) {
    const typeRoll = nextRandom(rngSeed);
    rngSeed = typeRoll.seed;
    const canBeBird = elapsed >= BIRD_MIN_ELAPSED;
    const isBird = canBeBird && typeRoll.value < 0.3;

    let obstacle: Obstacle;
    if (isBird) {
      const heightRoll = nextRandom(rngSeed);
      rngSeed = heightRoll.seed;
      obstacle = {
        id: nextObstacleId,
        type: "bird",
        x: SPAWN_X,
        width: 0.6,
        height: 0.4,
        y: heightRoll.value < 0.5 ? BIRD_HEIGHT_DUCK : BIRD_HEIGHT_JUMP,
      };
    } else {
      const sizeRoll = nextRandom(rngSeed);
      rngSeed = sizeRoll.seed;
      obstacle = {
        id: nextObstacleId,
        type: "cactus",
        x: SPAWN_X,
        width: 0.3 + sizeRoll.value * 0.3,
        height: 0.6 + sizeRoll.value * 0.5,
        y: GROUND_Y,
      };
    }
    nextObstacleId += 1;
    obstacles = [...obstacles, obstacle];

    const gapRoll = nextRandom(rngSeed);
    rngSeed = gapRoll.seed;
    nextSpawnAt = elapsed + 1.0 + gapRoll.value * 1.2;
  }

  const gooseWidth = isDucking ? DUCK_WIDTH : GOOSE_WIDTH;
  const gooseHeight = isDucking ? DUCK_HEIGHT : GOOSE_HEIGHT;
  const alive = !obstacles.some((o) => aabbOverlap(GOOSE_X, gooseWidth, y, gooseHeight, o.x, o.width, o.y, o.height));

  return {
    y,
    vy,
    isJumping,
    isDucking,
    obstacles,
    speed,
    distance,
    elapsed,
    alive,
    obstaclesCleared,
    rngSeed,
    nextSpawnAt,
    nextObstacleId,
  };
}
