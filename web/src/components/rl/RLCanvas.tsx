"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { GridWorld, Rollout } from "@/lib/rl/model";

// Same palette convention as QueensCanvas.tsx/TspCanvas.tsx - hardcoded hex matching globals.css's
// custom properties, since three.js materials need resolved colors, not CSS var() references.
const BACKDROP_COLOR = "#11131a";
const GROUND_COLOR = "#0b0d13";
const EMPTY_LOW = "#1c2b4a";
const EMPTY_TILE = "#1a1d27";
const WALL_COLOR = "#3a3f4f";
const PIT_COLOR = "#4a1a1f";
const PIT_GLOW = "#ff5d5d";
const SPIKE_COLOR = "#3a2a10";
const SPIKE_GLOW = "#ffb020";
const SPIKE_HIT_COLOR = "#ff8a3d";
const GOAL_COLOR = "#1f4a2a";
const GOAL_GLOW = "#5be08a";
const HEAT_LOW = "#2f6fb8";
const HEAT_HIGH = "#ff5d5d";
const AGENT_COLOR = "#7ea8f5";
const PATH_COLOR = "#a9c4ff";

// Fixed scene-unit footprint regardless of grid size, same reasoning as QueensCanvas's BOARD_SPAN -
// cells shrink as rows/cols grow, so the camera formula never needs to depend on grid size.
const BOARD_SPAN = 5.4;
const TILE_HEIGHT = 0.05;
const WALL_HEIGHT = 0.55;

function cellCenter(row: number, col: number, rows: number, cols: number, cellSize: number): [number, number] {
  return [(col - (cols - 1) / 2) * cellSize, (row - (rows - 1) / 2) * cellSize];
}

const heatFrom = new THREE.Color(HEAT_LOW);
const heatTo = new THREE.Color(HEAT_HIGH);
function heatColor(t: number): string {
  return heatFrom.clone().lerp(heatTo, Math.max(0, Math.min(1, t))).getStyle();
}

function Wall({ x, z, size }: { x: number; z: number; size: number }) {
  return (
    <mesh position={[x, WALL_HEIGHT / 2, z]} castShadow receiveShadow>
      <boxGeometry args={[size * 0.94, WALL_HEIGHT, size * 0.94]} />
      <meshStandardMaterial color={WALL_COLOR} roughness={0.9} metalness={0.05} />
    </mesh>
  );
}

function Tile({ x, z, size, color, glow, emissiveIntensity }: { x: number; z: number; size: number; color: string; glow?: string; emissiveIntensity: number }) {
  return (
    <mesh position={[x, 0, z]} receiveShadow>
      <boxGeometry args={[size * 0.96, TILE_HEIGHT, size * 0.96]} />
      <meshStandardMaterial color={color} emissive={glow ?? color} emissiveIntensity={emissiveIntensity} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

/** A slowly pulsing ring - the pit's opacity breathes so the danger marker reads as "live" even
 *  when nothing else on the board is moving. */
function PitMarker({ x, z, size }: { x: number; z: number; size: number }) {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const mat = ringRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (mat) mat.opacity = 0.45 + Math.sin(clock.getElapsedTime() * 2.4) * 0.25;
  });
  return (
    <mesh ref={ringRef} position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[size * 0.14, size * 0.4, 20]} />
      <meshBasicMaterial color={PIT_GLOW} transparent opacity={0.7} />
    </mesh>
  );
}

const SPIKE_SPRIGS = [
  { dx: 0, dz: 0, rot: 0.1, scale: 1 },
  { dx: 0.16, dz: 0.11, rot: 0.9, scale: 0.68 },
  { dx: -0.15, dz: 0.1, rot: -0.7, scale: 0.72 },
  { dx: 0.02, dz: -0.17, rot: 1.6, scale: 0.6 },
] as const;

/** A cluster of jagged thorns instead of a hole in the ground - visually a completely different
 *  kind of hazard from a pit (a physical obstacle you can survive brushing against, not a void you
 *  fall into), so the two dangers read as distinct at a glance. */
function SpikeMarker({ x, z, size }: { x: number; z: number; size: number }) {
  const matRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    matRefs.current.forEach((mat, i) => {
      if (mat) mat.emissiveIntensity = 0.45 + Math.sin(t * 3 + i * 1.7) * 0.25;
    });
  });
  return (
    <group position={[x, 0, z]}>
      {SPIKE_SPRIGS.map((s, i) => (
        <mesh key={i} position={[s.dx * size, size * 0.11 * s.scale, s.dz * size]} rotation={[0.15, s.rot, 0.1]} castShadow>
          <coneGeometry args={[size * 0.05 * s.scale, size * 0.22 * s.scale, 6]} />
          <meshStandardMaterial
            ref={(el) => {
              matRefs.current[i] = el;
            }}
            color={SPIKE_COLOR}
            emissive={SPIKE_GLOW}
            emissiveIntensity={0.5}
            roughness={0.55}
            metalness={0.25}
          />
        </mesh>
      ))}
    </group>
  );
}

const GOAL_ORBIT_COUNT = 3;

/** A floating crystal beacon instead of a plain cone: a pulsing ground ring, a soft translucent
 *  light column rising out of it, a slowly tumbling gem hovering above, and a few tiny sparks
 *  orbiting the gem - still fully procedural (no external asset), just more going on than one
 *  static shape. */
function GoalMarker({ x, z, size }: { x: number; z: number; size: number }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const gemRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const orbitRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const ringMat = ringRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (ringMat) ringMat.opacity = 0.6 + Math.sin(t * 2.2) * 0.2;

    const beamMat = beamRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (beamMat) beamMat.opacity = 0.12 + Math.sin(t * 1.4) * 0.05;

    if (gemRef.current) {
      gemRef.current.rotation.y = t * 0.8;
      gemRef.current.rotation.x = Math.sin(t * 0.6) * 0.18;
      gemRef.current.position.y = size * 0.56 + Math.sin(t * 1.6) * size * 0.06;
    }

    const orbitRadius = size * 0.32;
    orbitRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const angle = t * 1.1 + (i * Math.PI * 2) / GOAL_ORBIT_COUNT;
      mesh.position.set(Math.cos(angle) * orbitRadius, size * 0.56 + Math.sin(t * 2 + i) * size * 0.05, Math.sin(angle) * orbitRadius);
    });
  });

  return (
    <group position={[x, 0, z]}>
      <mesh ref={ringRef} position={[0, size * 0.05, 0]}>
        <ringGeometry args={[size * 0.16, size * 0.4, 28]} />
        <meshBasicMaterial color={GOAL_GLOW} transparent opacity={0.75} />
      </mesh>
      <mesh ref={beamRef} position={[0, size * 0.9, 0]}>
        <cylinderGeometry args={[size * 0.05, size * 0.18, size * 1.8, 16, 1, true]} />
        <meshBasicMaterial color={GOAL_GLOW} transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={gemRef} castShadow position={[0, size * 0.56, 0]}>
        <octahedronGeometry args={[size * 0.22, 0]} />
        <meshStandardMaterial color={GOAL_GLOW} emissive={GOAL_GLOW} emissiveIntensity={0.7} roughness={0.15} metalness={0.6} />
      </mesh>
      {Array.from({ length: GOAL_ORBIT_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            orbitRefs.current[i] = el;
          }}
        >
          <sphereGeometry args={[size * 0.035, 8, 8]} />
          <meshStandardMaterial color={GOAL_GLOW} emissive={GOAL_GLOW} emissiveIntensity={0.9} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

const SEGMENT_SECONDS = 0.55;
const REST_SECONDS = 1.2;

/** Procedural agent piece - a rounded body + a "head" sphere, no external asset (same rule the
 *  TSP car and Queens piece already follow) - that actually walks `path` in a loop instead of
 *  sitting still. With no path yet (nothing has run), it idles at the start cell with a small bob
 *  and slow spin so the scene never reads as frozen.
 *
 *  Also doubles as the page's "the algorithm made a mistake" indicator: it flashes orange while
 *  crossing a spike cell, and if the walk didn't reach the goal it keeps reacting at rest - a red
 *  shaking pulse for a fatal pit, a dimmer amber pulse for simply running out of steps - instead of
 *  silently idling as if nothing went wrong. */
function Agent({
  world,
  path,
  cellSize,
  spikeHitKeys,
  outcome,
}: {
  world: GridWorld;
  path: [number, number][] | undefined;
  cellSize: number;
  spikeHitKeys: Set<string>;
  outcome: Rollout["outcome"] | undefined;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const headMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const g = groupRef.current;
    const bodyMat = bodyMatRef.current;
    const headMat = headMatRef.current;
    if (!g || !bodyMat || !headMat) return;
    const t = clock.getElapsedTime();

    const tint = (hex: string, intensity: number) => {
      bodyMat.color.set(hex);
      bodyMat.emissive.set(hex);
      bodyMat.emissiveIntensity = intensity;
      headMat.color.set(hex);
      headMat.emissive.set(hex);
      headMat.emissiveIntensity = intensity;
    };

    if (!path || path.length < 2) {
      const [x, z] = cellCenter(world.start[0], world.start[1], world.rows, world.cols, cellSize);
      g.position.set(x, TILE_HEIGHT / 2 + Math.sin(t * 2) * cellSize * 0.03, z);
      g.rotation.y = t * 0.6;
      tint(AGENT_COLOR, 0.4);
      return;
    }

    const totalSegments = path.length - 1;
    const cycle = totalSegments * SEGMENT_SECONDS + REST_SECONDS;
    const localT = t % cycle;

    if (localT >= totalSegments * SEGMENT_SECONDS) {
      const [lr, lc] = path[path.length - 1];
      const [x, z] = cellCenter(lr, lc, world.rows, world.cols, cellSize);
      if (outcome === "pit") {
        const shakeX = Math.sin(t * 32) * cellSize * 0.025;
        const shakeZ = Math.cos(t * 27) * cellSize * 0.025;
        g.position.set(x + shakeX, TILE_HEIGHT / 2 + Math.sin(t * 3) * cellSize * 0.04, z + shakeZ);
        g.rotation.y = t * 1.4;
        tint(PIT_GLOW, 0.55 + Math.sin(t * 6) * 0.35);
      } else if (outcome === "timeout") {
        g.position.set(x, TILE_HEIGHT / 2 + Math.sin(t * 3) * cellSize * 0.04, z);
        g.rotation.y = t * 1.4;
        tint(SPIKE_GLOW, 0.3 + Math.sin(t * 2) * 0.18);
      } else {
        g.position.set(x, TILE_HEIGHT / 2 + Math.sin(t * 3) * cellSize * 0.04, z);
        g.rotation.y = t * 1.4;
        tint(spikeHitKeys.has(`${lr},${lc}`) ? SPIKE_HIT_COLOR : AGENT_COLOR, 0.5);
      }
      return;
    }

    const segIndex = Math.min(totalSegments - 1, Math.floor(localT / SEGMENT_SECONDS));
    const segT = (localT - segIndex * SEGMENT_SECONDS) / SEGMENT_SECONDS;
    const [ar, ac] = path[segIndex];
    const [br, bc] = path[segIndex + 1];
    const [ax, az] = cellCenter(ar, ac, world.rows, world.cols, cellSize);
    const [bx, bz] = cellCenter(br, bc, world.rows, world.cols, cellSize);
    const hop = Math.sin(segT * Math.PI) * cellSize * 0.14;
    g.position.set(ax + (bx - ax) * segT, TILE_HEIGHT / 2 + hop, az + (bz - az) * segT);
    if (bx !== ax || bz !== az) g.rotation.y = Math.atan2(bx - ax, bz - az);

    if (segT > 0.5 && spikeHitKeys.has(`${br},${bc}`)) {
      tint(SPIKE_HIT_COLOR, 0.6 + Math.sin(t * 16) * 0.4);
    } else {
      tint(AGENT_COLOR, 0.4);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow position={[0, cellSize * 0.16, 0]}>
        <capsuleGeometry args={[cellSize * 0.18, cellSize * 0.16, 6, 12]} />
        <meshStandardMaterial ref={bodyMatRef} color={AGENT_COLOR} emissive={AGENT_COLOR} emissiveIntensity={0.4} roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh castShadow position={[0, cellSize * 0.4, 0]}>
        <sphereGeometry args={[cellSize * 0.13, 14, 14]} />
        <meshStandardMaterial ref={headMatRef} color={AGENT_COLOR} emissive={AGENT_COLOR} emissiveIntensity={0.55} roughness={0.3} metalness={0.4} />
      </mesh>
    </group>
  );
}

function Scene({ world, values, rollout }: { world: GridWorld; values?: Float32Array | null; rollout?: Rollout | null }) {
  const cellSize = BOARD_SPAN / Math.max(world.rows, world.cols);
  const groundSize = BOARD_SPAN * 1.4;
  const path = rollout?.path;

  // Percentile-based bounds instead of raw min/max: a single outlier state (one bad pit-adjacent
  // cell that converged very negative, or one very-good goal-adjacent cell) would otherwise
  // squash every other cell's t into a narrow band at one end of the gradient - reading as "the
  // whole floor is red" instead of an actual heatmap.
  const heatRange = useMemo(() => {
    if (!values) return null;
    const sample: number[] = [];
    for (let r = 0; r < world.rows; r++) {
      for (let c = 0; c < world.cols; c++) {
        if (world.cells[r][c].type === "wall") continue;
        sample.push(values[r * world.cols + c]);
      }
    }
    if (sample.length < 2) return null;
    sample.sort((a, b) => a - b);
    const pct = (p: number) => sample[Math.max(0, Math.min(sample.length - 1, Math.round(p * (sample.length - 1))))];
    const min = pct(0.1);
    const max = pct(0.9);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max - min < 1e-6) return null;
    return { min, max };
  }, [values, world]);

  const pathSet = useMemo(() => new Set((path ?? []).map(([r, c]) => `${r},${c}`)), [path]);
  const spikeHitKeys = useMemo(() => new Set((rollout?.spikeHits ?? []).map(([r, c]) => `${r},${c}`)), [rollout]);

  return (
    <>
      <fog attach="fog" args={[BACKDROP_COLOR, groundSize * 0.9, groundSize * 2.6]} />
      <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial color={GROUND_COLOR} roughness={1} metalness={0} />
      </mesh>
      <hemisphereLight args={["#5c6a8f", "#0d0f16", 0.85]} />
      <directionalLight
        position={[5, 9, 4]}
        intensity={2.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-groundSize / 2}
        shadow-camera-right={groundSize / 2}
        shadow-camera-top={groundSize / 2}
        shadow-camera-bottom={-groundSize / 2}
        shadow-camera-near={0.5}
        shadow-camera-far={groundSize * 3}
      />
      <directionalLight position={[-5, 4, -5]} intensity={0.5} />

      {world.cells.flatMap((row, r) =>
        row.map((cell, c) => {
          const [x, z] = cellCenter(r, c, world.rows, world.cols, cellSize);
          if (cell.type === "wall") return <Wall key={`${r}-${c}`} x={x} z={z} size={cellSize} />;

          const onPath = pathSet.has(`${r},${c}`);
          let color = EMPTY_TILE;
          let emissiveIntensity = 0;
          if (cell.type === "pit") {
            color = PIT_COLOR;
            emissiveIntensity = 0.35;
          } else if (cell.type === "spike") {
            color = SPIKE_COLOR;
            emissiveIntensity = 0.25;
          } else if (cell.type === "goal") {
            color = GOAL_COLOR;
            emissiveIntensity = 0.3;
          } else if (heatRange) {
            const t = (values![r * world.cols + c] - heatRange.min) / (heatRange.max - heatRange.min);
            color = t > 0.02 ? heatColor(t) : EMPTY_LOW;
            emissiveIntensity = 0.15 + Math.max(0, Math.min(1, t)) * 0.25;
          } else if (onPath) {
            color = PATH_COLOR;
            emissiveIntensity = 0.2;
          }

          return (
            <group key={`${r}-${c}`}>
              <Tile x={x} z={z} size={cellSize} color={color} emissiveIntensity={emissiveIntensity} />
              {cell.type === "pit" && <PitMarker x={x} z={z} size={cellSize} />}
              {cell.type === "spike" && <SpikeMarker x={x} z={z} size={cellSize} />}
              {cell.type === "goal" && <GoalMarker x={x} z={z} size={cellSize} />}
            </group>
          );
        })
      )}

      <Agent world={world} path={path} cellSize={cellSize} spikeHitKeys={spikeHitKeys} outcome={rollout?.outcome} />
    </>
  );
}

export interface RLCanvasProps {
  world: GridWorld;
  /** Per-state heatmap values (max-Q from a snapshot, or Value Iteration's values) - null/undefined
   *  falls back to a flat neutral floor with only the optional `rollout` trail highlighted. */
  values?: Float32Array | null;
  /** The agent walks this route (start to goal) in a looping animation; with no rollout (nothing
   *  has run yet) it idles at the world's start cell instead. Passing the full Rollout (not just
   *  the path) lets the agent react visually when the walk didn't go well - flashing on spikes it
   *  crossed, and reacting differently at rest depending on whether it reached the goal, fell in a
   *  pit, or simply ran out of steps. */
  rollout?: Rollout | null;
}

export function RLCanvas({ world, values, rollout }: RLCanvasProps) {
  const dist = BOARD_SPAN * 0.95 + 1.6;
  // Same oblique 3/4 default camera as TSP/Queens - x stays off exactly 0 to dodge OrbitControls'
  // gimbal-lock singularity (a camera looking straight down its own up vector has an indeterminate azimuth).
  const cameraPosition: [number, number, number] = [0.01, dist * 0.95, dist * 0.95];

  return (
    <Canvas shadows camera={{ position: cameraPosition, fov: 34 }} gl={{ antialias: true, alpha: true }} onContextMenu={(e) => e.preventDefault()}>
      <Scene world={world} values={values} rollout={rollout} />
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={BOARD_SPAN * 0.5}
        maxDistance={BOARD_SPAN * 2.6}
        minPolarAngle={0.08}
        maxPolarAngle={0.95}
        rotateSpeed={0.5}
        mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
      />
    </Canvas>
  );
}
