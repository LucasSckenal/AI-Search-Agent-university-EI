"use client";

import { useMemo, useRef } from "react";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { Edges, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { MazeState, rc } from "@/lib/maze/model";

const WALL_HEIGHT = 0.85;
const FLOOR_HEIGHT = 0.14;
const WALL_COLOR = "#0d0f16";
const WALL_EDGE_COLOR = "#363b4a";
const PATH_COLOR = "#f5f6fa";
const PATH_HEIGHT = 0.4;
const PATH_RADIUS = 0.17;
// Backdrop tone the far edges of the maze fade into (fog) and the platform it sits on - matches
// the page's own --background token so the 3D scene's horizon blends into the surrounding UI
// instead of cutting off in a visible box.
const BACKDROP_COLOR = "#11131a";
const GROUND_COLOR = "#0b0d13";

/** Deterministic pseudo-random in [0, 1) from a cell index - used for small per-block variation
 *  (height, tint) that reads as hand-built stone rather than a uniform, mass-produced block, while
 *  staying stable across re-renders (no seeded RNG state to thread through). */
function hashJitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
// Cells the search visited but that aren't part of the final path - a dead end the algorithm
// backed out of. Distinct from VISITED_COLOR (still-live exploration) so "the AI thought about
// this and rejected it" reads differently from "the AI is currently looking here".
const DISCARDED_COLOR = "#c25a55";
// The last few cells revealed during live playback - a brighter pulse riding just ahead of the
// steady VISITED_COLOR trail, so the search wave itself reads as moving instead of the whole
// visited set just popping into a flat gray all at once.
const FRONTIER_COLOR = "#7e93c9";
const VISITED_COLOR = "#5b6070";

function floorColor(
  isStart: boolean,
  isGoal: boolean,
  isDiscarded: boolean,
  isFrontier: boolean,
  isVisited: boolean,
  isMud: boolean
): string {
  if (isStart) return "#afc6ff";
  if (isGoal) return "#ffb77b";
  if (isDiscarded) return DISCARDED_COLOR;
  if (isFrontier) return FRONTIER_COLOR;
  if (isVisited) return VISITED_COLOR;
  if (isMud) return "#8a5a2e";
  return "#20232c";
}

function Cell({
  x,
  z,
  index,
  isWall,
  isStart,
  isGoal,
  isVisited,
  isMud,
  isDiscarded,
  isFrontier,
  detailed,
  interactive,
  onCellClick,
}: {
  x: number;
  z: number;
  index: number;
  isWall: boolean;
  isStart: boolean;
  isGoal: boolean;
  isVisited: boolean;
  isMud: boolean;
  isDiscarded: boolean;
  isFrontier: boolean;
  detailed: boolean;
  interactive: boolean;
  onCellClick?: (index: number) => void;
}) {
  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    onCellClick?.(index);
  };
  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive || e.buttons !== 1) return;
    onCellClick?.(index);
  };

  // Subtle per-block variation (~±8% height, ~±3% lightness) so a long wall reads as individual
  // stacked blocks instead of one flat slab, without disturbing the layout grid. Only worth the
  // extra Color object when this is the one big solo view - the race grid renders several mazes
  // at once at thumbnail size, where it'd just be wasted cost with no visible payoff. Computed
  // unconditionally (not just for wall cells) to keep this hook call order-stable per Rules of
  // Hooks, even though only the isWall branch below ends up using it.
  const wallColor = useMemo(
    () =>
      detailed
        ? new THREE.Color(WALL_COLOR).offsetHSL(0, 0, (hashJitter(index + 101) - 0.5) * 0.06)
        : new THREE.Color(WALL_COLOR),
    [index, detailed]
  );

  if (isWall) {
    const wallHeight = detailed ? WALL_HEIGHT * (0.92 + hashJitter(index) * 0.16) : WALL_HEIGHT;
    return (
      <mesh position={[x, wallHeight / 2, z]} onPointerDown={handleDown} onPointerOver={handleOver}>
        <boxGeometry args={[0.96, wallHeight, 0.96]} />
        <meshStandardMaterial color={wallColor} roughness={0.95} metalness={0} />
        {detailed && <Edges color={WALL_EDGE_COLOR} threshold={15} />}
      </mesh>
    );
  }

  const bright = isStart || isGoal || isFrontier;
  const color = floorColor(isStart, isGoal, isDiscarded, isFrontier, isVisited, isMud);
  const height = FLOOR_HEIGHT + (bright ? 0.05 : isDiscarded ? 0.02 : 0);
  return (
    <mesh position={[x, height / 2, z]} onPointerDown={handleDown} onPointerOver={handleOver}>
      <boxGeometry args={[0.94, height, 0.94]} />
      <meshStandardMaterial
        color={color}
        roughness={0.7}
        metalness={0}
        emissive={bright ? color : isDiscarded ? DISCARDED_COLOR : "#000000"}
        emissiveIntensity={bright ? 0.5 : isDiscarded ? 0.22 : 0}
      />
    </mesh>
  );
}

// How many bright pulses ride the path at once, and how many path-lengths they cover per second -
// several evenly staggered pulses (rather than one) keep the direction readable even on a long path,
// where a single pulse would spend most of its time out of view between one end and the other.
const PULSE_COUNT = 3;
const PULSE_SPEED = 0.22;

/**
 * The solved path rendered as an actual 3D object - a glowing tube threading through the centers
 * of the path cells - rather than just recoloring floor tiles, so it reads unambiguously as
 * "the route" from any camera angle instead of competing with the other flat floor colors. A soft
 * additive halo around the core gives it a neon-glow read, and small bright pulses travel along it
 * from start to goal so the route's direction is legible at a glance, not just its shape.
 */
function PathTube({ maze, path }: { maze: MazeState; path: number[] }) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const curve = useMemo(() => {
    if (path.length < 2) return null;
    const points = path.map((i) => {
      const [r, c] = rc(maze, i);
      return new THREE.Vector3(c - (maze.cols - 1) / 2, PATH_HEIGHT, r - (maze.rows - 1) / 2);
    });
    return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.15);
  }, [maze, path]);

  const coreGeometry = useMemo(() => {
    if (!curve) return null;
    const segments = Math.max(path.length * 3, 8);
    return new THREE.TubeGeometry(curve, segments, PATH_RADIUS, 8, false);
  }, [curve, path.length]);

  const glowGeometry = useMemo(() => {
    if (!curve) return null;
    const segments = Math.max(path.length * 3, 8);
    return new THREE.TubeGeometry(curve, segments, PATH_RADIUS * 2.2, 8, false);
  }, [curve, path.length]);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.emissiveIntensity = 0.6 + Math.sin(clock.elapsedTime * 2.2) * 0.15;
    }
  });

  if (!curve || !coreGeometry || !glowGeometry) return null;
  return (
    <>
      <mesh geometry={glowGeometry}>
        <meshBasicMaterial
          color={PATH_COLOR}
          transparent
          opacity={0.14}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={coreGeometry}>
        <meshStandardMaterial
          ref={materialRef}
          color={PATH_COLOR}
          emissive={PATH_COLOR}
          emissiveIntensity={0.7}
          roughness={0.25}
          metalness={0.15}
        />
      </mesh>
      <PathPulses curve={curve} />
    </>
  );
}

/** The traveling bright spots riding PathTube's curve - see PULSE_COUNT/PULSE_SPEED above. Uses
 *  getPointAt (arc-length parameterization) rather than getPoint so they move at a visually
 *  constant speed even where CatmullRom bunches control points unevenly close together. */
function PathPulses({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    for (let i = 0; i < PULSE_COUNT; i++) {
      const mesh = refs.current[i];
      if (!mesh) continue;
      const t = (((clock.elapsedTime * PULSE_SPEED + i / PULSE_COUNT) % 1) + 1) % 1;
      curve.getPointAt(t, mesh.position);
    }
  });

  return (
    <>
      {Array.from({ length: PULSE_COUNT }).map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            refs.current[i] = m;
          }}
        >
          <sphereGeometry args={[PATH_RADIUS * 1.9, 12, 12]} />
          <meshBasicMaterial color={PATH_COLOR} transparent opacity={0.85} />
        </mesh>
      ))}
    </>
  );
}

// Clear of the tallest jittered wall (WALL_HEIGHT * 1.08 ≈ 0.92) so the beacon floats visibly
// above the skyline instead of sitting low enough for a neighboring wall to hide or shadow it.
const BEACON_Y = 1.3;

/** Floating glowing marker hovering above start/goal - makes both endpoints readable at a glance
 *  from any zoom or angle, on top of the flat floor-tile coloring which alone gets lost from far
 *  away or a low camera angle. Unlit core (meshBasicMaterial) so it reads as a bright, constant
 *  color from every direction instead of going dark on faces turned away from the key light, plus
 *  an additive glow halo and a thin beam anchoring it visually back down to its tile. */
function Beacon({ x, z, color }: { x: number; z: number; color: string }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const y = BEACON_Y + Math.sin(clock.elapsedTime * 1.6) * 0.1;
    if (coreRef.current) {
      coreRef.current.position.y = y;
      coreRef.current.rotation.y = clock.elapsedTime * 0.6;
    }
    if (glowRef.current) glowRef.current.position.y = y;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, BEACON_Y / 2, 0]}>
        <cylinderGeometry args={[0.012, 0.012, BEACON_Y, 6, 1]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.34, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={coreRef}>
        <octahedronGeometry args={[0.18, 0]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

/** Visual indicator for keyboard focus - the canvas has no native focus ring of its own, so
 *  without this arrow-key navigation would be invisible and useless. */
function FocusRing({ x, z }: { x: number; z: number }) {
  // y must clear the tallest floor tile top surface (glow tiles: FLOOR_HEIGHT + 0.05 = 0.19) or
  // it renders hidden inside the solid tile mesh instead of floating visibly above it.
  return (
    <mesh position={[x, 0.22, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.36, 0.46, 24]} />
      <meshBasicMaterial color="#afc6ff" transparent opacity={0.95} depthTest={false} />
    </mesh>
  );
}

function Scene({
  maze,
  visited,
  path,
  pathRevealed,
  frontier,
  detailed,
  interactive,
  onCellClick,
  focusIndex,
}: {
  maze: MazeState;
  visited: Set<number>;
  path: number[];
  pathRevealed: boolean;
  frontier: Set<number>;
  detailed: boolean;
  interactive: boolean;
  onCellClick?: (index: number) => void;
  focusIndex?: number | null;
}) {
  const cells = useMemo(() => {
    const out: { x: number; z: number; index: number; isWall: boolean; isMud: boolean }[] = [];
    for (let i = 0; i < maze.cells.length; i++) {
      const [r, c] = rc(maze, i);
      out.push({
        x: c - (maze.cols - 1) / 2,
        z: r - (maze.rows - 1) / 2,
        index: i,
        isWall: maze.cells[i] === "wall",
        isMud: maze.cells[i] === "mud",
      });
    }
    return out;
  }, [maze]);

  // O(1) path membership for every cell below - path.includes() would be O(n) per cell, O(n²)
  // over the whole grid on a maze with a long solution.
  const pathSet = useMemo(() => new Set(path), [path]);

  const focused = focusIndex != null ? cells[focusIndex] : undefined;
  const startCell = cells[maze.start];
  const goalCell = cells[maze.goal];
  const maxDim = Math.max(maze.rows, maze.cols);

  return (
    <>
      {detailed ? (
        <>
          {/* Far walls fade into the page's own background tone instead of cutting off sharply,
              and the whole scene sits on a dark platform so it doesn't look like it floats on
              nothing when viewed from a low angle. Reserved for the one big solo view - skipped
              in the race grid, where several mazes render at once at thumbnail size. */}
          <fog attach="fog" args={[BACKDROP_COLOR, maxDim * 0.7, maxDim * 2.4]} />
          <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
            <planeGeometry args={[maxDim + 12, maxDim + 12]} />
            <meshStandardMaterial color={GROUND_COLOR} roughness={1} metalness={0} />
          </mesh>
          <hemisphereLight args={["#5c6a8f", "#0d0f16", 0.85]} />
          <directionalLight position={[6, 10, 4]} intensity={2.2} />
          <directionalLight position={[-6, 4, -6]} intensity={0.55} />
          {startCell && <Beacon x={startCell.x} z={startCell.z} color="#afc6ff" />}
          {goalCell && <Beacon x={goalCell.x} z={goalCell.z} color="#ffb77b" />}
        </>
      ) : (
        <>
          <ambientLight intensity={1.4} />
          <directionalLight position={[6, 10, 4]} intensity={2.4} />
          <directionalLight position={[-6, 4, -6]} intensity={0.6} />
        </>
      )}
      {cells.map((c) => {
        const isVisited = visited.has(c.index);
        // Once the path is known (solved, or "no solution" - path.length 0 either way), anything
        // visited but not on it was a dead end the algorithm backed out of. If there's no
        // solution at all, that means everything explored gets marked discarded - a true reading
        // of "none of this led anywhere".
        const isDiscarded = isVisited && pathRevealed && !pathSet.has(c.index);
        const isFrontier = !pathRevealed && frontier.has(c.index);
        return (
          <Cell
            key={c.index}
            x={c.x}
            z={c.z}
            index={c.index}
            isWall={c.isWall}
            isMud={c.isMud}
            isStart={c.index === maze.start}
            isGoal={c.index === maze.goal}
            isVisited={isVisited}
            isDiscarded={isDiscarded}
            isFrontier={isFrontier}
            detailed={detailed}
            interactive={interactive}
            onCellClick={onCellClick}
          />
        );
      })}
      <PathTube maze={maze} path={path} />
      {focused && <FocusRing x={focused.x} z={focused.z} />}
    </>
  );
}

export function MazeCanvas({
  maze,
  visited,
  path,
  pathRevealed,
  frontier,
  detailed = true,
  interactive = false,
  onCellClick,
  controls = true,
  view = "iso",
  focusIndex,
}: {
  maze: MazeState;
  visited?: Set<number>;
  path?: number[];
  /** True once the search is done (found or not) and `path` reflects the final answer - gates
   *  the discarded/dead-end red so it can't appear mid-search, before "discarded" means anything. */
  pathRevealed?: boolean;
  /** The most recently revealed cells during live playback - rendered as a brighter moving wave
   *  ahead of the settled visited trail. Ignored once pathRevealed is true. */
  frontier?: Set<number>;
  /** Fog, ground platform, beacons, and per-wall stone variation - the richer look for when this
   *  is the one maze on screen. Set false for the algorithm race grid, where several mazes render
   *  at once at thumbnail size and the extra detail would just be cost with no visible payoff. */
  detailed?: boolean;
  interactive?: boolean;
  onCellClick?: (index: number) => void;
  /** Set false for read-only previews (e.g. the algorithm race grid) to skip OrbitControls entirely. */
  controls?: boolean;
  /** "top" gives a near-overhead, flat map-like read (used by the race grid for legibility at
   *  small size); "iso" is the default corner view used by the main interactive maze. */
  view?: "iso" | "top";
  /** Cell index to highlight as the keyboard-navigation cursor (see labirinto/page.tsx). */
  focusIndex?: number | null;
}) {
  const maxDim = Math.max(maze.rows, maze.cols);
  const dist = maxDim * 0.85 + 4;
  const cameraPosition: [number, number, number] =
    view === "top" ? [0.01, dist * 1.05, dist * 0.32] : [dist * 0.55, dist * 0.75, dist * 0.55];

  return (
    <Canvas
      camera={{ position: cameraPosition, fov: view === "top" ? 38 : 42 }}
      gl={{ antialias: true, alpha: true }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Scene
        maze={maze}
        visited={visited ?? new Set()}
        path={path ?? []}
        pathRevealed={pathRevealed ?? false}
        frontier={frontier ?? new Set()}
        detailed={detailed}
        interactive={interactive}
        onCellClick={onCellClick}
        focusIndex={focusIndex}
      />
      {controls && (
        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={maxDim * 0.3}
          maxDistance={maxDim * 1.6}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI / 2 - 0.05}
          rotateSpeed={0.6}
          mouseButtons={{ LEFT: undefined, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
        />
      )}
    </Canvas>
  );
}
