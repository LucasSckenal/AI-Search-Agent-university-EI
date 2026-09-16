"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import { MinimaxNode } from "@/lib/minimax/trace";

// Same hardcoded-hex-mirrors-globals.css convention as Maze3D.tsx/TspCanvas.tsx.
const BACKDROP_COLOR = "#11131a";
const GROUND_COLOR = "#0b0d13";
const X_COLOR = "#7ea8f5"; // node reached by an X move (maximizing)
const O_COLOR = "#ff6bd6"; // node reached by an O move (minimizing)
const ROOT_COLOR = "#e8ecff";
const WIN_COLOR = "#7ee0a8";
const LOSS_COLOR = "#e07e7e";
const DRAW_COLOR = "#9aa0b8";
const PRUNED_COLOR = "#4a4d58";
const BEST_MOVE_COLOR = "#ffb77b";

const SIBLING_SPACING = 0.62;
const DEPTH_SPACING = 1.05;

interface LaidOutNode extends MinimaxNode {
  x: number;
  z: number;
  y: number;
}

/** Classic layered-tree layout: every leaf gets the next sequential X slot (in sibling order), and
 *  every internal node's X is the average of its own children's - the same technique behind most
 *  textbook tree-drawing algorithms, cheap enough to just recompute whenever the trace changes since
 *  these trees top out at a few hundred nodes. Z carries depth (root closest to camera, deeper
 *  plies receding away) so orbiting the scene reads the tree's shape, not just a flat diagram. */
function layoutTree(nodes: MinimaxNode[]): Map<number, LaidOutNode> {
  const childrenOf = new Map<number, MinimaxNode[]>();
  for (const n of nodes) {
    if (n.parentId === null) continue;
    if (!childrenOf.has(n.parentId)) childrenOf.set(n.parentId, []);
    childrenOf.get(n.parentId)!.push(n);
  }
  for (const kids of childrenOf.values()) kids.sort((a, b) => a.siblingIndex - b.siblingIndex);

  const xOf = new Map<number, number>();
  let nextLeafSlot = 0;
  function assignX(id: number): number {
    const kids = childrenOf.get(id);
    if (!kids || kids.length === 0) {
      const x = nextLeafSlot++;
      xOf.set(id, x);
      return x;
    }
    const childXs = kids.map((k) => assignX(k.id));
    const x = childXs.reduce((a, b) => a + b, 0) / childXs.length;
    xOf.set(id, x);
    return x;
  }
  const root = nodes.find((n) => n.parentId === null);
  if (root) assignX(root.id);
  // Nodes assignX() never reached (shouldn't happen for a well-formed trace) still need a slot.
  for (const n of nodes) if (!xOf.has(n.id)) xOf.set(n.id, nextLeafSlot++);

  const centerX = (nextLeafSlot - 1) / 2;
  const out = new Map<number, LaidOutNode>();
  for (const n of nodes) {
    const x = (xOf.get(n.id) ?? 0) - centerX;
    const z = -n.depth * DEPTH_SPACING;
    const y = n.pruned ? -0.12 : n.terminal ? 0.14 : 0;
    out.set(n.id, { ...n, x: x * SIBLING_SPACING, y, z });
  }
  return out;
}

function nodeColor(n: MinimaxNode): string {
  if (n.pruned) return PRUNED_COLOR;
  if (n.parentId === null) return ROOT_COLOR;
  if (n.terminal && n.score !== null) {
    if (n.score > 0) return WIN_COLOR;
    if (n.score < 0) return LOSS_COLOR;
    return DRAW_COLOR;
  }
  return n.moverOfLastMove === 1 ? X_COLOR : O_COLOR;
}

function TreeNode({ node, isBestMove }: { node: LaidOutNode; isBestMove: boolean }) {
  const color = nodeColor(node);
  const radius = node.parentId === null ? 0.13 : node.pruned ? 0.06 : 0.09;
  return (
    <group position={[node.x, node.y, node.z]}>
      <mesh>
        <sphereGeometry args={[radius, 14, 14]} />
        {node.pruned ? (
          <meshBasicMaterial color={color} transparent opacity={0.35} wireframe />
        ) : (
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={node.terminal || node.parentId === null ? 0.55 : 0.25}
            roughness={0.4}
            metalness={0.1}
          />
        )}
      </mesh>
      {isBestMove && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius + 0.05, radius + 0.09, 20]} />
          <meshBasicMaterial color={BEST_MOVE_COLOR} transparent opacity={0.9} depthTest={false} />
        </mesh>
      )}
    </group>
  );
}

function TreeEdge({ parent, child }: { parent: LaidOutNode; child: LaidOutNode }) {
  const points: [number, number, number][] = [
    [parent.x, parent.y, parent.z],
    [child.x, child.y, child.z],
  ];
  return (
    <Line
      points={points}
      color={child.pruned ? PRUNED_COLOR : child.moverOfLastMove === 1 ? X_COLOR : O_COLOR}
      transparent
      opacity={child.pruned ? 0.35 : 0.55}
      lineWidth={child.pruned ? 1 : 1.5}
      dashed={child.pruned}
      dashSize={0.05}
      gapSize={0.05}
    />
  );
}

function Scene({ laidOut, bestMoveChildId }: { laidOut: LaidOutNode[]; bestMoveChildId: number | null }) {
  const maxZSpread = Math.max(1, ...laidOut.map((n) => Math.abs(n.z)));
  return (
    <>
      <fog attach="fog" args={[BACKDROP_COLOR, maxZSpread * 0.9, maxZSpread * 3.2]} />
      <mesh position={[0, -0.35, -maxZSpread / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[maxZSpread * 3, maxZSpread * 2]} />
        <meshStandardMaterial color={GROUND_COLOR} roughness={1} />
      </mesh>
      <hemisphereLight args={["#5c6a8f", "#0d0f16", 0.9]} />
      <directionalLight position={[4, 6, 3]} intensity={1.9} />
      <directionalLight position={[-4, 3, -2]} intensity={0.5} />

      {laidOut.map((n) =>
        n.parentId !== null ? (
          <TreeEdgeLookup key={`e${n.id}`} nodes={laidOut} node={n} />
        ) : null
      )}
      {laidOut.map((n) => (
        <TreeNode key={n.id} node={n} isBestMove={n.id === bestMoveChildId} />
      ))}
    </>
  );
}

function TreeEdgeLookup({ nodes, node }: { nodes: LaidOutNode[]; node: LaidOutNode }) {
  const parent = nodes.find((n) => n.id === node.parentId);
  if (!parent) return null;
  return <TreeEdge parent={parent} child={node} />;
}

export function MinimaxTree3D({
  nodes,
  revealCount,
  bestMove,
}: {
  /** The complete trace (used as the stable layout basis) - only the first `revealCount` are drawn. */
  nodes: MinimaxNode[];
  revealCount: number;
  bestMove: number | null;
}) {
  const layout = useMemo(() => layoutTree(nodes), [nodes]);
  const laidOut = useMemo(
    () => nodes.slice(0, revealCount).map((n) => layout.get(n.id)!).filter(Boolean),
    [nodes, revealCount, layout]
  );
  const root = nodes.find((n) => n.parentId === null);
  const bestMoveChildId = root && bestMove !== null ? nodes.find((n) => n.parentId === root.id && n.moveApplied === bestMove)?.id ?? null : null;

  const depth = Math.max(1, ...nodes.map((n) => n.depth));
  const dist = depth * DEPTH_SPACING * 0.85 + 2.2;

  return (
    <Canvas
      camera={{ position: [dist * 0.35, dist * 0.55, dist * 0.75], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Scene laidOut={laidOut} bestMoveChildId={bestMoveChildId} />
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={dist * 0.3}
        maxDistance={dist * 2.2}
        rotateSpeed={0.6}
        mouseButtons={{ LEFT: undefined, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
      />
    </Canvas>
  );
}
