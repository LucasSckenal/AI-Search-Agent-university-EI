"use client";

import { useMemo, useRef } from "react";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Board } from "@/lib/game/model";

const TILE_SIZE = 0.9;
const TILE_HEIGHT = 0.14;
const X_COLOR = "#afc6ff";
const O_COLOR = "#ffb77b";
const WIN_COLOR = "#f5f6fa";
const WIN_HEIGHT = 0.4;
const WIN_RADIUS = 0.15;

function Tile({
  x,
  z,
  index,
  filled,
  interactive,
  onCellClick,
}: {
  x: number;
  z: number;
  index: number;
  filled: boolean;
  interactive: boolean;
  onCellClick?: (index: number) => void;
}) {
  return (
    <mesh
      position={[x, TILE_HEIGHT / 2, z]}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        if (!interactive || filled) return;
        e.stopPropagation();
        onCellClick?.(index);
      }}
    >
      <boxGeometry args={[TILE_SIZE, TILE_HEIGHT, TILE_SIZE]} />
      <meshStandardMaterial color="#20232c" roughness={0.8} metalness={0} />
    </mesh>
  );
}

function XMark({ x, z }: { x: number; z: number }) {
  const y = TILE_HEIGHT + 0.09;
  const bar: [number, number, number] = [0.72, 0.14, 0.18];
  return (
    <group position={[x, y, z]}>
      <mesh rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={bar} />
        <meshStandardMaterial color={X_COLOR} emissive={X_COLOR} emissiveIntensity={0.45} roughness={0.4} />
      </mesh>
      <mesh rotation={[0, -Math.PI / 4, 0]}>
        <boxGeometry args={bar} />
        <meshStandardMaterial color={X_COLOR} emissive={X_COLOR} emissiveIntensity={0.45} roughness={0.4} />
      </mesh>
    </group>
  );
}

function OMark({ x, z }: { x: number; z: number }) {
  const y = TILE_HEIGHT + 0.09;
  return (
    <mesh position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
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
    const vecs = points.map(([x, z]) => new THREE.Vector3(x, WIN_HEIGHT, z));
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
    const out: { x: number; z: number; index: number; cell: number }[] = [];
    for (let i = 0; i < board.length; i++) {
      const r = Math.floor(i / size);
      const c = i % size;
      out.push({ x: c - (size - 1) / 2, z: r - (size - 1) / 2, index: i, cell: board[i] });
    }
    return out;
  }, [board, size]);

  const winPoints = useMemo<[number, number][]>(() => {
    if (!winLine) return [];
    return winLine.map((i) => {
      const r = Math.floor(i / size);
      const c = i % size;
      return [c - (size - 1) / 2, r - (size - 1) / 2] as [number, number];
    });
  }, [winLine, size]);

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[5, 8, 4]} intensity={2.3} />
      <directionalLight position={[-5, 4, -5]} intensity={0.6} />
      {cells.map((c) => (
        <group key={c.index}>
          <Tile x={c.x} z={c.z} index={c.index} filled={c.cell !== 0} interactive={interactive} onCellClick={onCellClick} />
          {c.cell === 1 && <XMark x={c.x} z={c.z} />}
          {c.cell === -1 && <OMark x={c.x} z={c.z} />}
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
  const dist = size * 1.1 + 3;

  return (
    <Canvas
      camera={{ position: [dist * 0.55, dist * 0.8, dist * 0.55], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Scene board={board} size={size} winLine={winLine} interactive={interactive} onCellClick={onCellClick} />
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={size * 0.6}
        maxDistance={size * 2.2}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2 - 0.05}
        rotateSpeed={0.6}
        mouseButtons={{ LEFT: undefined, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
      />
    </Canvas>
  );
}
