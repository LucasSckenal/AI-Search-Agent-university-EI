"use client";

import { useMemo, useRef } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { attackedCells, conflicts } from "@/lib/queens/model";

// Same palette convention as TspCanvas.tsx/Maze3D.tsx - hardcoded hex matching globals.css's custom
// properties, since three.js materials need resolved colors, not CSS var() references.
const BACKDROP_COLOR = "#11131a";
const GROUND_COLOR = "#0b0d13";
const LIGHT_SQUARE = "#2a2d38";
const DARK_SQUARE = "#181b24";
const QUEEN_COLOR = "#d9a441";
const QUEEN_ATTACKED_COLOR = "#ff6b6b";
const ATTACKED_SQUARE_COLOR = "#ff6b6b";
const CANDIDATE_COLOR = "#7ee0a8";
const SOLVED_RING_COLOR = "#f4d98a";

// Fixed scene-unit footprint regardless of N - cells just shrink as the board grows, so the camera
// formula below never needs to change with board size (unlike TSP, where the world literally spans
// more scene units as more cities scatter across it).
const BOARD_SPAN = 5.2;
const SQUARE_HEIGHT = 0.05;

// Max pointerdown->pointerup screen-space movement, in pixels, still counted as a tap rather than
// the start of an OrbitControls drag-to-rotate. Touch needs a much more forgiving threshold than
// mouse - a finger naturally drifts several pixels over the course of a tap in a way a mouse click
// doesn't, so a mouse-tuned threshold reads as "the board barely responds to taps" on a real phone.
const TAP_THRESHOLD_PX_MOUSE = 6;
const TAP_THRESHOLD_PX_TOUCH = 20;

function cellCenter(col: number, row: number, n: number, cellSize: number): [number, number] {
  return [(col - (n - 1) / 2) * cellSize, (row - (n - 1) / 2) * cellSize];
}

/** A single checkerboard square, optionally glowing red (under attack) or green (a Forward Checking
 *  candidate row still valid for the column currently being explored). */
function Square({
  x,
  z,
  size,
  dark,
  attacked,
  candidate,
  onPointerDown,
  onPointerUp,
}: {
  x: number;
  z: number;
  size: number;
  dark: boolean;
  attacked: boolean;
  candidate: boolean;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const color = attacked ? ATTACKED_SQUARE_COLOR : candidate ? CANDIDATE_COLOR : dark ? DARK_SQUARE : LIGHT_SQUARE;
  const emissiveIntensity = attacked ? 0.55 : candidate ? 0.4 : 0;
  return (
    <mesh position={[x, 0, z]} receiveShadow onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <boxGeometry args={[size * 0.96, SQUARE_HEIGHT, size * 0.96]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissiveIntensity} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

/** A procedural queen piece (no external asset, same rule TSP's car follows) - a base, a tapered
 *  body, and a crown, scaled to the current cell size so it stays proportional at any N. */
function Queen({ x, z, size, attacked, solved }: { x: number; z: number; size: number; attacked: boolean; solved: boolean }) {
  const color = attacked ? QUEEN_ATTACKED_COLOR : QUEEN_COLOR;
  return (
    <group position={[x, SQUARE_HEIGHT / 2, z]}>
      <mesh castShadow position={[0, size * 0.06, 0]}>
        <cylinderGeometry args={[size * 0.32, size * 0.36, size * 0.12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.4} metalness={0.35} />
      </mesh>
      <mesh castShadow position={[0, size * 0.32, 0]}>
        <coneGeometry args={[size * 0.24, size * 0.42, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.4} metalness={0.35} />
      </mesh>
      <mesh castShadow position={[0, size * 0.58, 0]}>
        <sphereGeometry args={[size * 0.14, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} roughness={0.3} metalness={0.4} />
      </mesh>
      {solved && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * 0.4, size * 0.48, 20]} />
          <meshBasicMaterial color={SOLVED_RING_COLOR} transparent opacity={0.75} />
        </mesh>
      )}
    </group>
  );
}

function Scene({
  n,
  board,
  domains,
  frontierCol,
  solved,
  interactive,
  onCellClick,
}: {
  n: number;
  board: number[];
  domains?: number[][];
  frontierCol?: number;
  solved: boolean;
  interactive?: boolean;
  onCellClick?: (col: number, row: number) => void;
}) {
  const cellSize = BOARD_SPAN / n;

  // OrbitControls calls preventDefault() on the touch that starts a drag, which suppresses the
  // browser's synthesized "click" event on mobile - breaking a plain onClick-based cell tap even
  // when the finger never moved. Pointer events themselves aren't suppressed, so placement is
  // driven by comparing pointerdown/pointerup screen coordinates directly: a tap (movement under
  // TAP_THRESHOLD_PX) places/removes a queen, anything past that is treated as the start of an
  // OrbitControls drag-to-rotate and ignored.
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  const attackedCols = useMemo(() => {
    const set = new Set<number>();
    for (const [a, b] of conflicts(board)) {
      set.add(a);
      set.add(b);
    }
    return set;
  }, [board]);

  // Manual play wants every threatened square lit up the instant a queen lands - not just the
  // occupied ones conflicts() reports - so a player can see a piece's full reach, empty cells
  // included, the classic N-Queens teaching visual.
  const allAttacked = useMemo(() => (interactive ? attackedCells(board) : null), [interactive, board]);

  const candidateRows = useMemo(() => {
    if (!domains || frontierCol === undefined || frontierCol < 0 || frontierCol >= domains.length) return null;
    return new Set(domains[frontierCol]);
  }, [domains, frontierCol]);

  const groundSize = BOARD_SPAN * 1.4;

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

      {Array.from({ length: n }, (_, col) =>
        Array.from({ length: n }, (_, row) => {
          const [x, z] = cellCenter(col, row, n, cellSize);
          const isCandidate = candidateRows !== null && candidateRows.has(row) && board[col] === -1;
          const isAttacked = allAttacked ? allAttacked.has(`${col},${row}`) : board[col] === row && attackedCols.has(col);
          return (
            <Square
              key={`${col}-${row}`}
              x={x}
              z={z}
              size={cellSize}
              dark={(col + row) % 2 === 0}
              attacked={isAttacked}
              candidate={isCandidate}
              onPointerDown={
                interactive
                  ? (e) => {
                      pointerDownPos.current = { x: e.clientX, y: e.clientY };
                    }
                  : undefined
              }
              onPointerUp={
                interactive && onCellClick
                  ? (e) => {
                      e.stopPropagation();
                      const start = pointerDownPos.current;
                      pointerDownPos.current = null;
                      if (start) {
                        const dx = e.clientX - start.x;
                        const dy = e.clientY - start.y;
                        const threshold = e.pointerType === "touch" || e.pointerType === "pen" ? TAP_THRESHOLD_PX_TOUCH : TAP_THRESHOLD_PX_MOUSE;
                        if (dx * dx + dy * dy > threshold * threshold) return;
                      }
                      onCellClick(col, row);
                    }
                  : undefined
              }
            />
          );
        })
      )}

      {board.map((row, col) => {
        if (row === -1) return null;
        const [x, z] = cellCenter(col, row, n, cellSize);
        const attacked = allAttacked ? allAttacked.has(`${col},${row}`) : attackedCols.has(col);
        return <Queen key={col} x={x} z={z} size={cellSize} attacked={attacked} solved={solved} />;
      })}
    </>
  );
}

export interface QueensCanvasProps {
  n: number;
  /** board[col] = row of the queen in that column, -1 = unplaced. */
  board: number[];
  /** Forward Checking's remaining candidate rows per column, from the current QueensStep. */
  domains?: number[][];
  /** The column currently being explored - domains[frontierCol] renders as glowing candidates. */
  frontierCol?: number;
  solved?: boolean;
  /** Manual play: enables cell clicks and switches attack highlighting to every threatened square. */
  interactive?: boolean;
  onCellClick?: (col: number, row: number) => void;
}

export function QueensCanvas({ n, board, domains, frontierCol, solved = false, interactive = false, onCellClick }: QueensCanvasProps) {
  const dist = BOARD_SPAN * 0.95 + 1.6;
  // Same oblique 3/4 default camera as TSP (tilted enough to read the pieces' height, not a
  // mathematically flat top-down) - x stays off exactly 0 to dodge OrbitControls' gimbal-lock
  // singularity (a camera looking straight down its own up vector has an indeterminate azimuth).
  const cameraPosition: [number, number, number] = [0.01, dist * 0.95, dist * 0.95];

  return (
    <Canvas shadows camera={{ position: cameraPosition, fov: 34 }} gl={{ antialias: true, alpha: true }} onContextMenu={(e) => e.preventDefault()}>
      <Scene n={n} board={board} domains={domains} frontierCol={frontierCol} solved={solved} interactive={interactive} onCellClick={onCellClick} />
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
