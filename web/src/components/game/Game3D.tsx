"use client";

import { useMemo, useRef } from "react";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Board } from "@/lib/game/model";

const TILE_SIZE = 0.9;
const TILE_DEPTH = 0.14;
const MARK_POP = 0.11; // how far the X/O sit in front of the tile face
const X_COLOR = "#afc6ff";
const O_COLOR = "#ffb77b";
const WIN_COLOR = "#f5f6fa";
const WIN_Z = 0.24;
const WIN_RADIUS = 0.15;

function Tile({
  x,
  y,
  index,
  filled,
  interactive,
  onCellClick,
}: {
  x: number;
  y: number;
  index: number;
  filled: boolean;
  interactive: boolean;
  onCellClick?: (index: number) => void;
}) {
  return (
    <mesh
      position={[x, y, -TILE_DEPTH / 2]}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        if (!interactive || filled) return;
        e.stopPropagation();
        onCellClick?.(index);
      }}
    >
      <boxGeometry args={[TILE_SIZE, TILE_SIZE, TILE_DEPTH]} />
      <meshStandardMaterial color="#20232c" roughness={0.8} metalness={0} />
    </mesh>
  );
}

/** The board stands upright facing the camera like the original flat 2D grid - only the X/O
 *  pieces themselves are true 3D objects, popping out of the tile face toward the viewer. */
function XMark({ x, y }: { x: number; y: number }) {
  const bar: [number, number, number] = [0.72, 0.18, 0.14];
  return (
    <group position={[x, y, MARK_POP]}>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={bar} />
        <meshStandardMaterial color={X_COLOR} emissive={X_COLOR} emissiveIntensity={0.45} roughness={0.4} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={bar} />
        <meshStandardMaterial color={X_COLOR} emissive={X_COLOR} emissiveIntensity={0.45} roughness={0.4} />
      </mesh>
    </group>
  );
}

function OMark({ x, y }: { x: number; y: number }) {
  return (
    <mesh position={[x, y, MARK_POP]}>
      <torusGeometry args={[0.26, 0.09, 12, 28]} />
      <meshStandardMaterial color={O_COLOR} emissive={O_COLOR} emissiveIntensity={0.45} roughness={0.4} />
    </mesh>
  );
}

/** The winning line is a real 3D object (a glowing tube through the winning cells), matching the
 *  same "the answer is an object, not just a color" language used for the maze's solved path. */
function WinLine({ points }: { points: [number, number][] }) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const vecs = points.map(([x, y]) => new THREE.Vector3(x, y, WIN_Z));
    const curve = new THREE.CatmullRomCurve3(vecs, false, "catmullrom", 0);
    return new THREE.TubeGeometry(curve, Math.max(points.length * 4, 8), WIN_RADIUS, 8, false);
  }, [points]);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.emissiveIntensity = 0.75 + Math.sin(clock.elapsedTime * 2.4) * 0.25;
    }
  });

  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        ref={materialRef}
        color={WIN_COLOR}
        emissive={WIN_COLOR}
        emissiveIntensity={0.85}
        roughness={0.3}
        metalness={0.1}
      />
    </mesh>
  );
}

function Scene({
  board,
  size,
  winLine,
  interactive,
  onCellClick,
}: {
  board: Board;
  size: number;
  winLine: number[] | null;
  interactive: boolean;
  onCellClick?: (index: number) => void;
}) {
  const cells = useMemo(() => {
    const out: { x: number; y: number; index: number; cell: number }[] = [];
    for (let i = 0; i < board.length; i++) {
      const r = Math.floor(i / size);
      const c = i % size;
      out.push({ x: c - (size - 1) / 2, y: (size - 1) / 2 - r, index: i, cell: board[i] });
    }
    return out;
  }, [board, size]);

  const winPoints = useMemo<[number, number][]>(() => {
    if (!winLine) return [];
    return winLine.map((i) => {
      const r = Math.floor(i / size);
      const c = i % size;
      return [c - (size - 1) / 2, (size - 1) / 2 - r] as [number, number];
    });
  }, [winLine, size]);

  return (
    <>
      <ambientLight intensity={1.7} />
      <directionalLight position={[3, 4, 7]} intensity={2.5} />
      <directionalLight position={[-3, -2, 6]} intensity={0.8} />
      {cells.map((c) => (
        <group key={c.index}>
          <Tile x={c.x} y={c.y} index={c.index} filled={c.cell !== 0} interactive={interactive} onCellClick={onCellClick} />
          {c.cell === 1 && <XMark x={c.x} y={c.y} />}
          {c.cell === -1 && <OMark x={c.x} y={c.y} />}
        </group>
      ))}
      <WinLine points={winPoints} />
    </>
  );
}

export function BoardCanvas({
  board,
  size,
  winLine,
  interactive = false,
  onCellClick,
}: {
  board: Board;
  size: number;
  winLine: number[] | null;
  interactive?: boolean;
  onCellClick?: (index: number) => void;
}) {
  const dist = size * 1.3 + 3.4;

  return (
    <Canvas camera={{ position: [0, 0, dist], fov: 36 }} gl={{ antialias: true, alpha: true }}>
      <Scene board={board} size={size} winLine={winLine} interactive={interactive} onCellClick={onCellClick} />
    </Canvas>
  );
}
