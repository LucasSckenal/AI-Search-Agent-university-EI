"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { CubeSize, CubeState, MoveId, Piece, COLOR_HEX, moveAxisSignAngle } from "@/lib/cube/model";

const MOVE_DURATION_MS = 320;

const AXIS_INDEX: Record<"x" | "y" | "z", 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

/**
 * The whole assembly always spans about [-1, 1] on every axis, regardless of N, so a single fixed
 * camera framing works for every cube size. `pos` coordinates (from cube/model.ts) already span
 * exactly -1..1 for any size - e.g. size 3 uses {-1,0,1} - so mapping a coordinate to world space
 * is `pos * spacing` where `spacing = (size-1)/size` is the distance from center to the outermost
 * cubie's center. (`cell = 2/size` is the space each cubie plus its gap occupies.)
 */
function metricsFor(size: CubeSize) {
  const cell = 2 / size;
  return {
    spacing: (size - 1) / size,
    cubieSize: cell * 0.94,
    stickerSize: cell * 0.94 * 0.8,
    stickerThickness: cell * 0.06,
  };
}
type Metrics = ReturnType<typeof metricsFor>;

function Sticker({
  axis,
  sign,
  color,
  metrics,
}: {
  axis: "x" | "y" | "z";
  sign: number;
  color: string;
  metrics: Metrics;
}) {
  const offset = metrics.cubieSize / 2 + metrics.stickerThickness / 2 + 0.01;
  const position: [number, number, number] =
    axis === "x" ? [sign * offset, 0, 0] : axis === "y" ? [0, sign * offset, 0] : [0, 0, sign * offset];
  const { stickerSize: s, stickerThickness: t } = metrics;
  const size: [number, number, number] = axis === "x" ? [t, s, s] : axis === "y" ? [s, t, s] : [s, s, t];
  // Radius must stay well under half of the *thinnest* dimension (the sticker's own thickness) or
  // RoundedBoxGeometry's extrusion degenerates into NaN vertices.
  const radius = Math.min(0.018, s * 0.05, t * 0.35);
  return (
    <RoundedBox position={position} args={size} radius={radius} smoothness={2}>
      <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
    </RoundedBox>
  );
}

function Cubie({ piece, metrics }: { piece: Piece; metrics: Metrics }) {
  const [x, y, z] = piece.pos;
  return (
    <group position={[x * metrics.spacing, y * metrics.spacing, z * metrics.spacing]}>
      <RoundedBox
        args={[metrics.cubieSize, metrics.cubieSize, metrics.cubieSize]}
        radius={Math.min(0.035, metrics.cubieSize * 0.06)}
        smoothness={2}
      >
        <meshStandardMaterial color="#0b0e15" roughness={0.9} metalness={0} />
      </RoundedBox>
      {piece.stickers.x !== undefined && (
        <Sticker axis="x" sign={x} color={COLOR_HEX[piece.stickers.x]} metrics={metrics} />
      )}
      {piece.stickers.y !== undefined && (
        <Sticker axis="y" sign={y} color={COLOR_HEX[piece.stickers.y]} metrics={metrics} />
      )}
      {piece.stickers.z !== undefined && (
        <Sticker axis="z" sign={z} color={COLOR_HEX[piece.stickers.z]} metrics={metrics} />
      )}
    </group>
  );
}

/** Wraps the pieces affected by the in-flight move and animates the pivot rotation around the
 *  cube's center - identical in effect to reparenting them onto a turning layer, without the
 *  imperative scene-graph surgery that would normally take. */
function TurningGroup({
  move,
  pieces,
  metrics,
  onDone,
}: {
  move: MoveId;
  pieces: Piece[];
  metrics: Metrics;
  onDone: () => void;
}) {
  const ref = useRef<THREE.Group>(null!);
  const elapsed = useRef(0);
  const settled = useRef(false);
  const { axis, angle } = useMemo(() => moveAxisSignAngle(move), [move]);

  useFrame((_, delta) => {
    if (settled.current) return;
    elapsed.current += delta * 1000;
    const t = Math.min(elapsed.current / MOVE_DURATION_MS, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    if (ref.current) {
      ref.current.rotation.set(0, 0, 0);
      ref.current.rotation[axis] = angle * eased;
    }
    if (t >= 1) {
      settled.current = true;
      onDone();
    }
  });

  return (
    <group ref={ref}>
      {pieces.map((p) => (
        <Cubie key={p.id} piece={p} metrics={metrics} />
      ))}
    </group>
  );
}

function Scene({
  cube,
  size,
  animatingMove,
  onMoveSettled,
}: {
  cube: CubeState;
  size: CubeSize;
  animatingMove: MoveId | null;
  onMoveSettled: () => void;
}) {
  const metrics = useMemo(() => metricsFor(size), [size]);
  const layer = animatingMove ? moveAxisSignAngle(animatingMove) : null;
  const axisIdx = layer ? AXIS_INDEX[layer.axis] : null;

  const affected = axisIdx !== null && layer ? cube.filter((c) => c.pos[axisIdx] === layer.layerSign) : [];
  const rest = axisIdx !== null && layer ? cube.filter((c) => c.pos[axisIdx] !== layer.layerSign) : cube;

  return (
    <>
      <ambientLight intensity={2.2} />
      <directionalLight position={[4, 6, 5]} intensity={3.2} />
      <directionalLight position={[-4, -3, -4]} intensity={1.4} />
      <directionalLight position={[0, -5, 2]} intensity={1} />
      {rest.map((c) => (
        <Cubie key={c.id} piece={c} metrics={metrics} />
      ))}
      {animatingMove && (
        <TurningGroup move={animatingMove} pieces={affected} metrics={metrics} onDone={onMoveSettled} />
      )}
      <ContactShadows position={[0, -1.05, 0]} opacity={0.45} scale={5} blur={2.4} far={1.5} />
    </>
  );
}

export function CubeCanvas({
  cube,
  size,
  animatingMove,
  onMoveSettled,
  idle = false,
}: {
  cube: CubeState;
  size: CubeSize;
  animatingMove: MoveId | null;
  onMoveSettled: () => void;
  /** Gentle showroom auto-rotate when nothing is actively animating/searching. */
  idle?: boolean;
}) {
  return (
    <Canvas camera={{ position: [3.4, 2.8, 3.8], fov: 38 }} gl={{ antialias: true, alpha: true }}>
      <Scene cube={cube} size={size} animatingMove={animatingMove} onMoveSettled={onMoveSettled} />
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={3.2}
        maxDistance={7}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI - 0.3}
        rotateSpeed={0.6}
        autoRotate={idle}
        autoRotateSpeed={0.7}
      />
    </Canvas>
  );
}
