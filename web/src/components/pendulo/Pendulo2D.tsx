import { TRACK_LIMIT } from "@/lib/pendulo/model";

const VIEW_W = 640;
const VIEW_H = 260;
const GROUND_Y = 180;
const PX_PER_M = 110;
const POLE_LENGTH_PX = 110; // full pole length (2 * POLE_HALF_LENGTH), scaled by PX_PER_M
const CENTER_X = VIEW_W / 2;

// Kenney "Robot Pack" (CC0) side-view robot-on-treads sprite, native 158x150px - drawn at this
// height with the source aspect ratio preserved, its own tracks standing in for the cart's wheels
// instead of a separate SVG shape. Roughly matches the footprint of the rectangle it replaces.
const ROBOT_SRC = "/sprites/robot/robot.png";
const ROBOT_NATIVE_W = 158;
const ROBOT_NATIVE_H = 150;
const ROBOT_H = 64;
const ROBOT_W = (ROBOT_NATIVE_W / ROBOT_NATIVE_H) * ROBOT_H;
const CART_H = ROBOT_H; // pole pivots from the top of the robot, same role the cart rect used to play

/**
 * Inline SVG scene for the cart-pole: a track, a robot-on-treads sprite standing in for the cart,
 * and a pole line+bob rotated by `theta`. Kept independent of `PenduloState` (only the fields it
 * actually draws) so callers - live play, headless-replay scrubbing, and the split-screen "vs" mode
 * - can all feed it the same small props shape regardless of where the state comes from.
 */
export function Pendulo2D({
  x,
  theta,
  alive,
  label,
  accentColor = "var(--primary)",
}: {
  x: number;
  theta: number;
  alive: boolean;
  label?: string;
  accentColor?: string;
}) {
  const cartCx = CENTER_X + x * PX_PER_M;
  const pivotY = GROUND_Y - CART_H;
  const thetaDeg = (theta * 180) / Math.PI;
  const trackHalfPx = TRACK_LIMIT * PX_PER_M;

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      {label && (
        <text x={CENTER_X} y={22} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--on-surface-variant)">
          {label}
        </text>
      )}

      {/* Track + boundary markers at ±TRACK_LIMIT */}
      <line x1={CENTER_X - trackHalfPx - 24} y1={GROUND_Y} x2={CENTER_X + trackHalfPx + 24} y2={GROUND_Y} stroke="rgba(255,255,255,0.14)" strokeWidth={2} />
      <line x1={CENTER_X - trackHalfPx} y1={GROUND_Y - 10} x2={CENTER_X - trackHalfPx} y2={GROUND_Y + 10} stroke="rgba(255,255,255,0.25)" strokeWidth={2} strokeDasharray="3 3" />
      <line x1={CENTER_X + trackHalfPx} y1={GROUND_Y - 10} x2={CENTER_X + trackHalfPx} y2={GROUND_Y + 10} stroke="rgba(255,255,255,0.25)" strokeWidth={2} strokeDasharray="3 3" />
      <line x1={CENTER_X} y1={GROUND_Y - 6} x2={CENTER_X} y2={GROUND_Y + 6} stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} />

      {/* Soft ground shadow in accentColor - grounds the sprite visually and, in split-screen "vs"
          mode, is now the only cue distinguishing the NN and PD panels' robots, since both use the
          same fixed-color sprite regardless of accentColor. */}
      <ellipse cx={cartCx} cy={GROUND_Y + 3} rx={ROBOT_W * 0.4} ry={5} fill={accentColor} opacity={alive ? 0.3 : 0.12} />

      {/* Cart, drawn as a small robot on treads instead of a plain rectangle */}
      <image
        href={ROBOT_SRC}
        x={cartCx - ROBOT_W / 2}
        y={GROUND_Y - ROBOT_H}
        width={ROBOT_W}
        height={ROBOT_H}
        opacity={alive ? 1 : 0.55}
        style={{ imageRendering: "pixelated", filter: alive ? undefined : "grayscale(1)" }}
      />

      {/* Pole, rotated around the cart's top-center pivot */}
      <g transform={`translate(${cartCx}, ${pivotY}) rotate(${thetaDeg})`} opacity={alive ? 1 : 0.4}>
        <line x1={0} y1={0} x2={0} y2={-POLE_LENGTH_PX} stroke={alive ? "#e8c25a" : "#8a8a94"} strokeWidth={5} strokeLinecap="round" />
        <circle cx={0} cy={-POLE_LENGTH_PX} r={8} fill={alive ? "#ff6bd6" : "#8a8a94"} />
      </g>
    </svg>
  );
}
