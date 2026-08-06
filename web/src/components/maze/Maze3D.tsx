"use client";

import { useMemo, useRef } from "react";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { MazeState, rc } from "@/lib/maze/model";

const WALL_HEIGHT = 0.85;
const FLOOR_HEIGHT = 0.14;
const WALL_COLOR = "#0d0f16";
const PATH_COLOR = "#f5f6fa";
const PATH_HEIGHT = 0.4;
const PATH_RADIUS = 0.17;
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

  if (isWall) {
    return (
      <mesh position={[x, WALL_HEIGHT / 2, z]} onPointerDown={handleDown} onPointerOver={handleOver}>
        <boxGeometry args={[0.96, WALL_HEIGHT, 0.96]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.95} metalness={0} />
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

/**
 * The solved path rendered as an actual 3D object - a glowing tube threading through the centers
 * of the path cells - rather than just recoloring floor tiles, so it reads unambiguously as
 * "the route" from any camera angle instead of competing with the other flat floor colors.
 */
function PathTube({ maze, path }: { maze: MazeState; path: number[] }) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const geometry = useMemo(() => {
    if (path.length < 2) return null;
    const points = path.map((i) => {
      const [r, c] = rc(maze, i);
      return new THREE.Vector3(c - (maze.cols - 1) / 2, PATH_HEIGHT, r - (maze.rows - 1) / 2);
    });
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.15);
    const segments = Math.max(path.length * 3, 8);
    return new THREE.TubeGeometry(curve, segments, PATH_RADIUS, 8, false);
  }, [maze, path]);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.emissiveIntensity = 0.7 + Math.sin(clock.elapsedTime * 2.4) * 0.25;
    }
  });

  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        ref={materialRef}
        color={PATH_COLOR}
        emissive={PATH_COLOR}
        emissiveIntensity={0.8}
        roughness={0.3}
        metalness={0.1}
      />
    </mesh>
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
  interactive,
  onCellClick,
  focusIndex,
}: {
  maze: MazeState;
  visited: Set<number>;
  path: number[];
  pathRevealed: boolean;
  frontier: Set<number>;
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

  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[6, 10, 4]} intensity={2.4} />
      <directionalLight position={[-6, 4, -6]} intensity={0.6} />
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
