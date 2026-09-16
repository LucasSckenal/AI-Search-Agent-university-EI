"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { START, TARGET } from "@/lib/algoritmo-genetico/model";

// Same hardcoded-hex-mirrors-globals.css convention as Maze3D.tsx/TspCanvas.tsx/MinimaxTree3D.tsx.
const BACKDROP_COLOR = "#11131a";
const GROUND_COLOR = "#0b0d13";
const FAR_COLOR = new THREE.Color("#e07e7e");
const CLOSE_COLOR = new THREE.Color("#7ee0a8");
const START_COLOR = "#afc6ff";
const TARGET_COLOR = "#ffb77b";
const BEST_COLOR = "#ffe08a";

/** Deterministic pseudo-random in [0,1) from an index - desyncs each individual's traveling-dot
 *  phase without threading extra RNG state through props (same trick as Maze3D's hashJitter). */
function hashJitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function fitnessColor(fitness: number, worst: number, best: number): string {
  const t = best === worst ? 1 : Math.max(0, Math.min(1, (fitness - worst) / (best - worst)));
  return `#${FAR_COLOR.clone().lerp(CLOSE_COLOR, t).getHexString()}`;
}

function Walker({
  path,
  color,
  isBest,
  phase,
}: {
  path: [number, number][];
  color: string;
  isBest: boolean;
  phase: number;
}) {
  const dotRef = useRef<THREE.Mesh>(null);

  const curve = useMemo(() => {
    const points = path.map(([x, y]) => new THREE.Vector3(x, 0.05, y));
    return points.length >= 2 ? new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.1) : null;
  }, [path]);

  useFrame(({ clock }) => {
    if (!curve || !dotRef.current) return;
    const t = ((clock.elapsedTime * 0.18 + phase) % 1 + 1) % 1;
    curve.getPointAt(t, dotRef.current.position);
  });

  const linePoints = useMemo(() => path.map(([x, y]) => [x, 0.02, y] as [number, number, number]), [path]);
  const finalPoint = path[path.length - 1];

  return (
    <>
      <Line points={linePoints} color={color} transparent opacity={isBest ? 0.85 : 0.35} lineWidth={isBest ? 2 : 1} />
      <mesh position={[finalPoint[0], 0.05, finalPoint[1]]}>
        <sphereGeometry args={[isBest ? 0.12 : 0.08, 10, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isBest ? 0.7 : 0.35} />
      </mesh>
      {curve && (
        <mesh ref={dotRef}>
          <sphereGeometry args={[isBest ? 0.09 : 0.06, 8, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
      {isBest && (
        <mesh position={[finalPoint[0], 0.02, finalPoint[1]]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.16, 0.21, 20]} />
          <meshBasicMaterial color={BEST_COLOR} transparent opacity={0.9} depthTest={false} />
        </mesh>
      )}
    </>
  );
}

/** Floating marker for START/TARGET - same bobbing-octahedron-on-a-ring language as Maze3D's Beacon,
 *  simplified since this scene has no wall geometry it needs to clear. */
function Marker({ x, z, color }: { x: number; z: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = 0.4 + Math.sin(clock.elapsedTime * 1.6) * 0.08;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.4, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
      <mesh ref={ref}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Line points={[[0, 0, 0], [0, 0.9, 0]]} color={color} transparent opacity={0.25} lineWidth={1} />
    </group>
  );
}

function Scene({ paths, fitnesses, bestIndex }: { paths: [number, number][][]; fitnesses: number[]; bestIndex: number | null }) {
  const worst = Math.min(...fitnesses);
  const best = Math.max(...fitnesses);
  const span = Math.max(Math.abs(START[0] - TARGET[0]), Math.abs(START[1] - TARGET[1])) + 6;

  return (
    <>
      <fog attach="fog" args={[BACKDROP_COLOR, span * 1.1, span * 3]} />
      <mesh position={[(START[0] + TARGET[0]) / 2, -0.02, (START[1] + TARGET[1]) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[span * 2, span * 2]} />
        <meshStandardMaterial color={GROUND_COLOR} roughness={1} />
      </mesh>
      <gridHelper args={[span * 2, span * 2, "#242835", "#1a1d27"]} position={[(START[0] + TARGET[0]) / 2, 0, (START[1] + TARGET[1]) / 2]} />
      <hemisphereLight args={["#5c6a8f", "#0d0f16", 0.9]} />
      <directionalLight position={[5, 8, 4]} intensity={2} />
      <directionalLight position={[-5, 4, -3]} intensity={0.5} />

      <Marker x={START[0]} z={START[1]} color={START_COLOR} />
      <Marker x={TARGET[0]} z={TARGET[1]} color={TARGET_COLOR} />

      {paths.map((path, i) => (
        <Walker
          key={i}
          path={path}
          color={fitnessColor(fitnesses[i], worst, best)}
          isBest={i === bestIndex}
          phase={hashJitter(i)}
        />
      ))}
    </>
  );
}

export function PopulationArena3D({
  paths,
  fitnesses,
  bestIndex = null,
}: {
  paths: [number, number][][];
  fitnesses: number[];
  bestIndex?: number | null;
}) {
  const centerX = (START[0] + TARGET[0]) / 2;
  const centerZ = (START[1] + TARGET[1]) / 2;
  const span = Math.max(Math.abs(START[0] - TARGET[0]), Math.abs(START[1] - TARGET[1])) + 6;
  const dist = span * 0.95 + 2;

  return (
    <Canvas
      camera={{ position: [centerX + dist * 0.5, dist * 0.75, centerZ + dist * 0.5], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Scene paths={paths} fitnesses={fitnesses} bestIndex={bestIndex} />
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        target={[centerX, 0, centerZ]}
        minDistance={span * 0.4}
        maxDistance={span * 2.4}
        rotateSpeed={0.6}
        mouseButtons={{ LEFT: undefined, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
      />
    </Canvas>
  );
}
