/**
 * Classic cart-pole physics (Barto/Sutton/Anderson 1983 - the same model OpenAI Gym's
 * `CartPole-v1` reference environment uses), pure functions only (mirrors src/lib/goose/model.ts's
 * convention) - stepPendulo is a deterministic, replayable transition function so a genetic
 * algorithm can compare many agents against an identical starting tilt, and so a finished
 * generation can be re-simulated on demand for playback instead of having to record every frame.
 */

import { seededRng } from "../core/rng";

export type PenduloAction = "left" | "right";

export interface PenduloState {
  /** Cart position along the track, meters from center. */
  x: number;
  xDot: number;
  /** Pole angle from vertical, radians. 0 = upright. */
  theta: number;
  thetaDot: number;
  elapsed: number;
  steps: number;
  alive: boolean;
}

export const GRAVITY = 9.8;
export const CART_MASS = 1.0;
export const POLE_MASS = 0.1;
export const TOTAL_MASS = CART_MASS + POLE_MASS;
/** Half the pole's length - the classic formulation tracks the half-length, not the full length. */
export const POLE_HALF_LENGTH = 0.5;
export const POLE_MASS_LENGTH = POLE_MASS * POLE_HALF_LENGTH;
export const FORCE_MAG = 10;
export const PENDULO_DT = 0.02;
export const THETA_LIMIT_RAD = (12 * Math.PI) / 180;
export const TRACK_LIMIT = 2.4;
/** Max |theta0| when an episode starts - a small random tilt, never dead-on vertical (which would
 *  give every controller/genome a trivially symmetric start with zero information to react to). */
export const INITIAL_THETA_RANGE = 0.05;

export function createInitialState(seed: number): PenduloState {
  const rng = seededRng(seed);
  const theta0 = (rng() * 2 - 1) * INITIAL_THETA_RANGE;
  return { x: 0, xDot: 0, theta: theta0, thetaDot: 0, elapsed: 0, steps: 0, alive: true };
}

/**
 * One physics step. `dt` defaults to PENDULO_DT (matches Gym's `tau`). Semi-implicit (symplectic)
 * Euler integration, same order as Gym's reference implementation: position advances on the OLD
 * velocity before the velocity itself is updated - swapping this order changes the numbers.
 */
export function stepPendulo(state: PenduloState, action: PenduloAction, dt: number = PENDULO_DT): PenduloState {
  if (!state.alive) return state;

  const force = action === "right" ? FORCE_MAG : -FORCE_MAG;
  const { x, xDot, theta, thetaDot } = state;
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);

  const temp = (force + POLE_MASS_LENGTH * thetaDot * thetaDot * sinTheta) / TOTAL_MASS;
  const thetaAcc =
    (GRAVITY * sinTheta - cosTheta * temp) /
    (POLE_HALF_LENGTH * (4 / 3 - (POLE_MASS * cosTheta * cosTheta) / TOTAL_MASS));
  const xAcc = temp - (POLE_MASS_LENGTH * thetaAcc * cosTheta) / TOTAL_MASS;

  const nextX = x + dt * xDot;
  const nextXDot = xDot + dt * xAcc;
  const nextTheta = theta + dt * thetaDot;
  const nextThetaDot = thetaDot + dt * thetaAcc;

  const alive = Math.abs(nextTheta) <= THETA_LIMIT_RAD && Math.abs(nextX) <= TRACK_LIMIT;

  return {
    x: nextX,
    xDot: nextXDot,
    theta: nextTheta,
    thetaDot: nextThetaDot,
    elapsed: state.elapsed + dt,
    steps: state.steps + 1,
    alive,
  };
}

const PD_KP = 20; // rad -> signal: pushes toward the side that reduces the angle error
const PD_KD = 3; // rad/s -> signal: damps angular velocity, prevents overshoot past vertical
// A flat linear combination of all four state variables (angle terms plus raw x/xDot terms) was
// tried first and failed badly (about half of 30 seeds crashed into the track limit): x/xDot are
// two orders of magnitude smaller in their effect on the bang-bang sign than theta/thetaDot, so
// they got drowned out by ordinary angle-correction chatter and never asserted themselves until
// the cart was already at the edge. The fix is cascaded control instead: recentering doesn't vote
// directly on left/right - it nudges the angle *target* the inner loop tracks. A cart that has
// drifted off-center gets asked to lean ever so slightly back toward center (a few thousandths of
// a radian, well inside the fall threshold), and the already-tight angle stabilizer does the rest.
const TILT_PER_X = 0.03; // rad of target tilt per meter of drift
const TILT_PER_X_DOT = 0.05; // rad of target tilt per m/s of cart velocity

/**
 * Hand-coded controller, no learning involved: bang-bang PD tracking a small drift-dependent tilt
 * target instead of pure vertical (see cascaded-control note above).
 */
export function heuristicDecide(state: PenduloState): PenduloAction {
  const thetaTarget = -TILT_PER_X * state.x - TILT_PER_X_DOT * state.xDot;
  const angleError = state.theta - thetaTarget;
  const signal = PD_KP * angleError + PD_KD * state.thetaDot;
  return signal > 0 ? "right" : "left";
}
