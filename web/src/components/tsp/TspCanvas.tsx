"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { City, TSP_WORLD_SIZE } from "@/lib/tsp/model";

// Same palette convention as Maze3D.tsx/Goose2D.tsx - hardcoded hex matching globals.css's custom
// properties, since three.js materials need resolved colors, not CSS var() references.
const BACKDROP_COLOR = "#11131a";
const GROUND_COLOR = "#0b0d13";
const PLAZA_COLOR = "#1a1d27";
const CITY_COLORS = ["#e1e2ec", "#c2c6d6", "#9aa0b8"];
const ORIGIN_COLOR = "#afc6ff";
const ROAD_COLOR = "#2a2d38";
const CURB_COLOR = "#3d4250";
const ROAD_LINE_COLOR = "#f4d35e";
const LAMP_GLOW_COLOR = "#ffe3a3";
const GHOST_COLOR = "#cebdff";
const HIGHLIGHT_COLOR = "#ffb77b";
const CAR_COLOR = "#ffb77b";
const TREE_COLOR = "#4f8f5b";

// World coordinates (0..TSP_WORLD_SIZE) shrink into scene units by this factor, centered on the
// origin - same centering convention Maze3D uses for its grid (subtract half the extent).
const SCENE_SCALE = 0.022;
const ROUTE_HEIGHT = 0.03;
const ROAD_WIDTH = 0.17;
const GHOST_ROAD_WIDTH = 0.09;
// Scene-units/sec the car travels along the route's arc length - a longer route takes proportionally
// longer to drive, like a real car at constant speed, rather than every tour taking the same lap time.
const CAR_SPEED = 4.2;
const CAR_Y = 0.09;

function toScene(city: City): THREE.Vector3 {
  return new THREE.Vector3((city.x - TSP_WORLD_SIZE / 2) * SCENE_SCALE, 0, (city.y - TSP_WORLD_SIZE / 2) * SCENE_SCALE);
}

/** Deterministic pseudo-random in [0,1) from a seed - same trick Maze3D's hashJitter uses for
 *  per-block variation that's stable across re-renders without threading RNG state through props. */
function hashJitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Each city renders as a tiny block of buildings on a plaza pad, rather than a single abstract
 *  marker - heights/footprints/roof styles/positions vary deterministically by the city's own id,
 *  so it reads as a little town instead of a repeated stamp. Rooftops (pitched vs flat-with-a-detail)
 *  and a couple of small trees matter most here since the camera looks almost straight down - that's
 *  the one face of every building actually visible most of the time. The tour's origin city gets one
 *  taller landmark tower, a beacon light, and a glowing plaza ring instead of a small cluster. */
function CityBlock({ city, position, isOrigin }: { city: City; position: THREE.Vector3; isOrigin: boolean }) {
  const buildings = useMemo(() => {
    const count = isOrigin ? 1 : 2 + Math.floor(hashJitter(city.id) * 2);
    return Array.from({ length: count }, (_, i) => {
      const seed = city.id * 97 + i * 13;
      const h = isOrigin ? 0.6 + hashJitter(seed) * 0.18 : 0.16 + hashJitter(seed) * 0.24;
      const w = 0.08 + hashJitter(seed + 1) * 0.05;
      const angle = (i / count) * Math.PI * 2 + hashJitter(seed + 2) * 2;
      const radius = count === 1 ? 0 : 0.07 + hashJitter(seed + 3) * 0.04;
      const colorIndex = Math.floor(hashJitter(seed + 4) * CITY_COLORS.length);
      const pitchedRoof = hashJitter(seed + 5) > 0.55;
      const hasRoofDetail = !pitchedRoof && hashJitter(seed + 6) > 0.5;
      return {
        h,
        w,
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        color: CITY_COLORS[colorIndex],
        pitchedRoof,
        hasRoofDetail,
      };
    });
  }, [city.id, isOrigin]);

  const trees = useMemo(() => {
    if (isOrigin) return [];
    const count = hashJitter(city.id + 500) > 0.35 ? 1 + Math.floor(hashJitter(city.id + 501) * 2) : 0;
    return Array.from({ length: count }, (_, i) => {
      const seed = city.id * 211 + i * 29;
      const angle = hashJitter(seed) * Math.PI * 2;
      const radius = 0.1 + hashJitter(seed + 1) * 0.06;
      return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, scale: 0.85 + hashJitter(seed + 2) * 0.3 };
    });
  }, [city.id, isOrigin]);

  const plazaRadius = isOrigin ? 0.26 : 0.19;
  const tallest = Math.max(...buildings.map((b) => b.h));

  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <cylinderGeometry args={[plazaRadius, plazaRadius, 0.02, 16]} />
        <meshStandardMaterial color={PLAZA_COLOR} roughness={0.95} metalness={0} />
      </mesh>
      {isOrigin && (
        <mesh position={[0, 0.021, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[plazaRadius * 0.76, plazaRadius * 0.9, 32]} />
          <meshBasicMaterial color={ORIGIN_COLOR} transparent opacity={0.7} />
        </mesh>
      )}
      {buildings.map((b, i) => {
        const color = isOrigin ? ORIGIN_COLOR : b.color;
        const roofY = b.h + 0.02;
        return (
          <group key={i} position={[b.x, 0, b.z]}>
            <mesh position={[0, b.h / 2 + 0.02, 0]} castShadow>
              <boxGeometry args={[b.w, b.h, b.w]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={isOrigin ? 0.5 : 0.2}
                roughness={0.5}
                metalness={0.15}
              />
            </mesh>
            {b.pitchedRoof && (
              <mesh position={[0, roofY + 0.035, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                <coneGeometry args={[b.w * 0.72, 0.07, 4]} />
                <meshStandardMaterial color={color} roughness={0.65} />
              </mesh>
            )}
            {b.hasRoofDetail && (
              <mesh position={[b.w * 0.22, roofY + 0.02, b.w * 0.22]}>
                <boxGeometry args={[0.025, 0.04, 0.025]} />
                <meshStandardMaterial color="#0d0f16" roughness={0.8} />
              </mesh>
            )}
          </group>
        );
      })}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <mesh position={[0, 0.02 * t.scale, 0]}>
            <cylinderGeometry args={[0.008, 0.01, 0.04 * t.scale, 6]} />
            <meshStandardMaterial color="#3d2a1f" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.055 * t.scale, 0]} castShadow>
            <sphereGeometry args={[0.035 * t.scale, 8, 8]} />
            <meshStandardMaterial color={TREE_COLOR} roughness={0.8} emissive={TREE_COLOR} emissiveIntensity={0.12} />
          </mesh>
        </group>
      ))}
      {isOrigin && (
        <mesh position={[0, tallest + 0.08, 0]}>
          <sphereGeometry args={[0.035, 10, 10]} />
          <meshBasicMaterial color={ORIGIN_COLOR} />
        </mesh>
      )}
    </group>
  );
}

/** Builds a flat ribbon mesh along a closed curve - a real road lying on the ground, rather than a
 *  round glowing tube. Sampled via getSpacedPoints (uniform parametric spacing is fine here; the
 *  curve is already fairly evenly distributed since Catmull-Rom interpolates through evenly-toured
 *  cities) and offset sideways by the local XZ-plane tangent's perpendicular to build the two road
 *  edges as a triangle strip. */
function buildRoadGeometry(curve: THREE.CatmullRomCurve3, width: number, y: number, segments: number): THREE.BufferGeometry {
  const points = curve.getSpacedPoints(segments);
  const n = points.length; // getSpacedPoints on a closed curve already omits the duplicate end point
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < n; i++) {
    const next = points[(i + 1) % n];
    const prev = points[(i - 1 + n) % n];
    const tangent = next.clone().sub(prev);
    if (tangent.lengthSq() < 1e-9) tangent.set(1, 0, 0);
    tangent.normalize();
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(width / 2);
    const cur = points[i];
    positions.push(cur.x - right.x, y, cur.z - right.z, cur.x + right.x, y, cur.z + right.z);
    uvs.push(0, i / n, 1, i / n);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = ((i + 1) % n) * 2;
    const d = ((i + 1) % n) * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function Road({
  curve,
  width,
  color,
  opacity,
  y = ROUTE_HEIGHT,
}: {
  curve: THREE.CatmullRomCurve3;
  width: number;
  color: string;
  opacity: number;
  y?: number;
}) {
  const geometry = useMemo(() => buildRoadGeometry(curve, width, y, Math.max(curve.points.length * 8, 48)), [curve, width, y]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        roughness={0.95}
        metalness={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// How much wider the curb ribbon is than the asphalt on each side - rendered as a second, lighter,
// slightly lower ribbon underneath the road so a thin strip peeks out on both edges.
const CURB_EXTRA = 0.06;

// World-space spacing (scene units) between streetlamps - same arc-length-based spacing idea as
// DASH_SPACING below, offset to one side of the road rather than riding its centerline.
const LAMP_SPACING = 1.3;

/** Small glowing streetlamps along one side of the main road - poles are plain matte cylinders, the
 *  glow is an unlit sphere (meshBasicMaterial) so it reads as a light source at a glance rather than
 *  needing an actual point light per lamp, which would be far too many real lights at higher city
 *  counts. */
function RoadLamps({ curve, roadWidth }: { curve: THREE.CatmullRomCurve3; roadWidth: number }) {
  const lamps = useMemo(() => {
    const length = Math.max(curve.getLength(), 0.001);
    const count = Math.max(4, Math.round(length / LAMP_SPACING));
    const out: [number, number, number][] = [];
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const p = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const flat = new THREE.Vector3(tangent.x, 0, tangent.z);
      if (flat.lengthSq() < 1e-9) flat.set(1, 0, 0);
      flat.normalize();
      const side = new THREE.Vector3(-flat.z, 0, flat.x).multiplyScalar(roadWidth / 2 + CURB_EXTRA + 0.05);
      out.push([p.x + side.x, 0, p.z + side.z]);
    }
    return out;
  }, [curve, roadWidth]);

  return (
    <>
      {lamps.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh position={[0, 0.09, 0]} castShadow>
            <cylinderGeometry args={[0.006, 0.009, 0.18, 6]} />
            <meshStandardMaterial color="#1a1d27" roughness={0.7} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0.185, 0]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshBasicMaterial color={LAMP_GLOW_COLOR} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// World-space spacing (scene units) between dashed lane-marking centers - kept in real distance
// (via getPointAt/getTangentAt's arc-length parametrization) rather than a fixed dash count, so
// dashes stay evenly spaced regardless of how long the current tour happens to be.
const DASH_SPACING = 0.42;

/** Yellow dashed centerline riding the main road, echoing Maze3D's PathPulses in spirit (a real
 *  object marking the route's own surface) but static rather than animated - the car itself is
 *  this canvas's one moving element. */
function RoadDashes({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const dashes = useMemo(() => {
    const length = Math.max(curve.getLength(), 0.001);
    const count = Math.max(6, Math.round(length / DASH_SPACING));
    const out: { position: [number, number, number]; quaternion: THREE.Quaternion }[] = [];
    for (let i = 0; i < count; i += 2) {
      const t = i / count;
      const p = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const flat = new THREE.Vector3(tangent.x, 0, tangent.z);
      if (flat.lengthSq() < 1e-9) flat.set(1, 0, 0);
      flat.normalize();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), flat);
      out.push({ position: [p.x, ROUTE_HEIGHT + 0.012, p.z], quaternion });
    }
    return out;
  }, [curve]);

  return (
    <>
      {dashes.map((d, i) => (
        <mesh key={i} position={d.position} quaternion={d.quaternion}>
          <boxGeometry args={[0.035, 0.008, 0.16]} />
          <meshStandardMaterial color={ROAD_LINE_COLOR} emissive={ROAD_LINE_COLOR} emissiveIntensity={0.45} roughness={0.5} />
        </mesh>
      ))}
    </>
  );
}

/** 2-opt's currently-swapped edges, drawn as short glowing cylinders slightly above the main route
 *  tube so they read as an overlay highlight rather than blending into it. */
function HighlightSegments({ cities, edges }: { cities: City[]; edges: [number, number][] }) {
  const cityById = useMemo(() => new Map(cities.map((c) => [c.id, c])), [cities]);
  return (
    <>
      {edges.map(([aId, bId], i) => {
        const a = cityById.get(aId);
        const b = cityById.get(bId);
        if (!a || !b) return null;
        const pa = toScene(a);
        const pb = toScene(b);
        pa.y = ROUTE_HEIGHT + 0.06;
        pb.y = ROUTE_HEIGHT + 0.06;
        const dir = pb.clone().sub(pa);
        const len = dir.length();
        if (len < 1e-6) return null;
        const mid = pa.clone().add(pb).multiplyScalar(0.5);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        return (
          <mesh key={i} position={mid} quaternion={quaternion}>
            <cylinderGeometry args={[0.09, 0.09, len, 8]} />
            <meshStandardMaterial color={HIGHLIGHT_COLOR} emissive={HIGHLIGHT_COLOR} emissiveIntensity={0.9} />
          </mesh>
        );
      })}
    </>
  );
}

// Suspension bob: a tiny sine wave driven by distance traveled (not elapsed time), so the bounce
// rate scales with the car's own speed instead of ticking at a fixed rate regardless of motion -
// same idea as Goose2D's RUN_BOB_UNITS gait bob.
const BOUNCE_FREQUENCY = 14;
const BOUNCE_AMPLITUDE = 0.006;

/** The traveling salesman's car, continuously driving the current route - built from primitives
 *  (there's no premade vehicle sprite/model in this project's assets), oriented every frame via
 *  `lookAt` along the route curve's tangent rather than hand-derived trig, so it always faces the
 *  way it's actually moving regardless of the curve's local twist. */
function Car({ curve }: { curve: THREE.CatmullRomCurve3 | null }) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  const distanceRef = useRef(0);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (!curve || !groupRef.current) return;
    const length = Math.max(curve.getLength(), 0.001);
    progressRef.current = (progressRef.current + (CAR_SPEED * delta) / length) % 1;
    distanceRef.current += CAR_SPEED * delta;
    const pos = curve.getPointAt(progressRef.current);
    const tangent = curve.getTangentAt(progressRef.current);
    const bounce = Math.sin(distanceRef.current * BOUNCE_FREQUENCY) * BOUNCE_AMPLITUDE;
    groupRef.current.position.set(pos.x, CAR_Y + bounce, pos.z);
    lookTarget.set(pos.x + tangent.x, CAR_Y, pos.z + tangent.z);
    groupRef.current.lookAt(lookTarget);
  });

  if (!curve) return null;

  const wheelPositions: [number, number][] = [
    [-0.11, -0.14],
    [0.11, -0.14],
    [-0.11, 0.14],
    [0.11, 0.14],
  ];

  return (
    <group ref={groupRef}>
      <mesh castShadow position={[0, 0.09, 0]}>
        <boxGeometry args={[0.24, 0.14, 0.42]} />
        <meshStandardMaterial color={CAR_COLOR} emissive={CAR_COLOR} emissiveIntensity={0.25} roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.19, -0.03]}>
        <boxGeometry args={[0.16, 0.09, 0.22]} />
        <meshStandardMaterial color="#11131a" roughness={0.3} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.238, 0.06]}>
        <boxGeometry args={[0.17, 0.014, 0.03]} />
        <meshStandardMaterial color="#11131a" roughness={0.4} metalness={0.3} />
      </mesh>
      {wheelPositions.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.045, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.05, 10]} />
          <meshStandardMaterial color="#000000" roughness={0.85} />
        </mesh>
      ))}
      {[-0.07, 0.07].map((x, i) => (
        <mesh key={i} position={[x, 0.09, -0.22]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
      {[-0.07, 0.07].map((x, i) => (
        <mesh key={i} position={[x, 0.09, 0.2]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshBasicMaterial color="#ff4d4d" />
        </mesh>
      ))}
    </group>
  );
}

function Scene({
  cities,
  tour,
  compareTour,
  highlightEdges,
}: {
  cities: City[];
  tour: number[] | null;
  compareTour: number[] | null;
  highlightEdges?: [number, number][];
}) {
  const points = useMemo(() => {
    if (!tour) return [];
    return tour.map((i) => {
      const p = toScene(cities[i]);
      p.y = ROUTE_HEIGHT;
      return p;
    });
  }, [cities, tour]);

  const comparePoints = useMemo(() => {
    if (!compareTour) return [];
    return compareTour.map((i) => {
      const p = toScene(cities[i]);
      p.y = ROUTE_HEIGHT + 0.02;
      return p;
    });
  }, [cities, compareTour]);

  const curve = useMemo(() => (points.length > 1 ? new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.12) : null), [points]);
  const compareCurve = useMemo(
    () => (comparePoints.length > 1 ? new THREE.CatmullRomCurve3(comparePoints, true, "catmullrom", 0.12) : null),
    [comparePoints]
  );

  const groundSize = Math.max(TSP_WORLD_SIZE * SCENE_SCALE * 1.5, 6);

  return (
    <>
      <fog attach="fog" args={[BACKDROP_COLOR, groundSize * 0.8, groundSize * 2.4]} />
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial color={GROUND_COLOR} roughness={1} metalness={0} />
      </mesh>
      <hemisphereLight args={["#5c6a8f", "#0d0f16", 0.85]} />
      <directionalLight position={[6, 10, 4]} intensity={2.1} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-6, 4, -6]} intensity={0.5} />

      {compareCurve && <Road curve={compareCurve} width={GHOST_ROAD_WIDTH} color={GHOST_COLOR} opacity={0.32} />}
      {curve && <Road curve={curve} width={ROAD_WIDTH + CURB_EXTRA * 2} color={CURB_COLOR} opacity={1} y={ROUTE_HEIGHT - 0.008} />}
      {curve && <Road curve={curve} width={ROAD_WIDTH} color={ROAD_COLOR} opacity={1} />}
      {curve && <RoadDashes curve={curve} />}
      {curve && <RoadLamps curve={curve} roadWidth={ROAD_WIDTH} />}
      {highlightEdges && highlightEdges.length > 0 && <HighlightSegments cities={cities} edges={highlightEdges} />}
      {cities.map((c, i) => (
        <CityBlock key={c.id} city={c} position={toScene(c)} isOrigin={i === 0} />
      ))}
      <Car curve={curve} />
    </>
  );
}

interface TspCanvasProps {
  cities: City[];
  tour: number[] | null;
  /** e.g. the optimal tour drawn faded underneath, for the "compare to optimal" toggle. */
  compareTour?: number[] | null;
  /** City-id edge pairs to draw emphasized (from a 2-opt TourStep's newEdges). */
  highlightEdges?: [number, number][];
}

export function TspCanvas({ cities, tour, compareTour, highlightEdges }: TspCanvasProps) {
  const groundSize = Math.max(TSP_WORLD_SIZE * SCENE_SCALE, 4);
  const dist = groundSize * 0.95 + 2;
  // A shallow-angle near-overhead camera (not a mathematically perfect 90° top-down), same trick
  // Maze3D's own "top" view uses - a camera looking straight down along its up vector is a
  // gimbal-lock singularity for OrbitControls (indeterminate azimuth), so a small real z-offset
  // keeps it stable while still reading as a top-down view.
  const cameraPosition: [number, number, number] = [0.01, dist * 1.35, dist * 0.42];

  return (
    <Canvas
      shadows
      camera={{ position: cameraPosition, fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Scene cities={cities} tour={tour} compareTour={compareTour ?? null} highlightEdges={highlightEdges} />
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={groundSize * 0.4}
        maxDistance={groundSize * 2.4}
        minPolarAngle={0.08}
        maxPolarAngle={0.55}
        rotateSpeed={0.5}
        mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
      />
    </Canvas>
  );
}
