import {
  createInitialState,
  stepPendulo,
  heuristicDecide,
  PenduloState,
  PenduloAction,
  PENDULO_DT,
  THETA_LIMIT_RAD,
  TRACK_LIMIT,
} from "../src/lib/pendulo/model";
import { GENOME_LENGTH } from "../src/lib/pendulo/agent";
import { buildPenduloGaOps } from "../src/lib/pendulo/genetic";
import { evolve, GaConfig } from "../src/lib/core/genetic";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function freshState(overrides: Partial<PenduloState>): PenduloState {
  return { x: 0, xDot: 0, theta: 0, thetaDot: 0, elapsed: 0, steps: 0, alive: true, ...overrides };
}

// --- Hand-verified physics step ---
// Independent reimplementation of the same classic cart-pole equations (Barto/Sutton/Anderson
// 1983, same model as OpenAI Gym's CartPole-v1), transcribed separately from model.ts so this
// actually catches a transcription bug there instead of just re-running the same code.
function referenceStep(state: PenduloState, action: PenduloAction, dt: number): PenduloState {
  const GRAVITY = 9.8;
  const CART_MASS = 1.0;
  const POLE_MASS = 0.1;
  const TOTAL_MASS = CART_MASS + POLE_MASS;
  const POLE_HALF_LENGTH = 0.5;
  const POLE_MASS_LENGTH = POLE_MASS * POLE_HALF_LENGTH;
  const FORCE_MAG = 10;

  const force = action === "right" ? FORCE_MAG : -FORCE_MAG;
  const cosTheta = Math.cos(state.theta);
  const sinTheta = Math.sin(state.theta);
  const temp = (force + POLE_MASS_LENGTH * state.thetaDot ** 2 * sinTheta) / TOTAL_MASS;
  const thetaAcc =
    (GRAVITY * sinTheta - cosTheta * temp) / (POLE_HALF_LENGTH * (4 / 3 - (POLE_MASS * cosTheta ** 2) / TOTAL_MASS));
  const xAcc = temp - (POLE_MASS_LENGTH * thetaAcc * cosTheta) / TOTAL_MASS;

  return {
    x: state.x + dt * state.xDot,
    xDot: state.xDot + dt * xAcc,
    theta: state.theta + dt * state.thetaDot,
    thetaDot: state.thetaDot + dt * thetaAcc,
    elapsed: state.elapsed + dt,
    steps: state.steps + 1,
    alive: true,
  };
}

{
  const s0 = freshState({ theta: 0.05 });
  const expected = referenceStep(s0, "right", 0.02);
  const actual = stepPendulo(s0, "right", 0.02);
  assert(Math.abs(actual.x - expected.x) < 1e-9, `hand-verified step: x matches independent reimplementation (${actual.x} vs ${expected.x})`);
  assert(Math.abs(actual.xDot - expected.xDot) < 1e-9, `hand-verified step: xDot matches independent reimplementation (${actual.xDot} vs ${expected.xDot})`);
  assert(Math.abs(actual.theta - expected.theta) < 1e-9, `hand-verified step: theta matches independent reimplementation (${actual.theta} vs ${expected.theta})`);
  assert(Math.abs(actual.thetaDot - expected.thetaDot) < 1e-9, `hand-verified step: thetaDot matches independent reimplementation (${actual.thetaDot} vs ${expected.thetaDot})`);

  // Worked by hand for x=0, xDot=0, theta=0.05, thetaDot=0, action="right", dt=0.02:
  //   temp = 10/1.1 = 9.0909; thetaAcc = (9.8*sin(0.05) - cos(0.05)*9.0909) / (0.5*(4/3 - 0.1*cos(0.05)^2/1.1)) ~= -13.82
  //   xAcc = 9.0909 - 0.05*(-13.82)*cos(0.05)/1.1 ~= 9.72
  //   -> x stays 0 (old xDot was 0), theta stays 0.05 (old thetaDot was 0), xDot ~= 0.194, thetaDot ~= -0.276
  assert(actual.x === 0, "hand-verified step: x unchanged this step (old xDot was 0)");
  assert(actual.theta === 0.05, "hand-verified step: theta unchanged this step (old thetaDot was 0)");
  assert(actual.xDot > 0.15 && actual.xDot < 0.25, `hand-verified step: xDot in expected band (${actual.xDot})`);
  assert(actual.thetaDot > -0.35 && actual.thetaDot < -0.2, `hand-verified step: thetaDot in expected band (${actual.thetaDot})`);
}

// --- Termination correctness ---
{
  const nearThetaLimit = freshState({ theta: THETA_LIMIT_RAD - 0.001, thetaDot: 10 });
  const fellByAngle = stepPendulo(nearThetaLimit, "right", PENDULO_DT);
  assert(!fellByAngle.alive, "stepPendulo marks alive=false the instant |theta| crosses THETA_LIMIT_RAD");

  const nearTrackLimit = freshState({ x: TRACK_LIMIT - 0.001, xDot: 100 });
  const fellByPosition = stepPendulo(nearTrackLimit, "right", PENDULO_DT);
  assert(!fellByPosition.alive, "stepPendulo marks alive=false the instant |x| crosses TRACK_LIMIT");

  const safe = freshState({ theta: 0.01, thetaDot: 0.1, x: 0.1, xDot: 0.1 });
  const stillSafe = stepPendulo(safe, "right", PENDULO_DT);
  assert(stillSafe.alive, "stepPendulo keeps alive=true when comfortably within both limits");

  const dead = freshState({ alive: false, x: 5, theta: 5 });
  const stillDead = stepPendulo(dead, "right", PENDULO_DT);
  assert(stillDead === dead, "stepPendulo is a no-op (returns the same state) once alive is false");
}

// --- Heuristic controller fuzz (seeds 1..30) ---
{
  const MAX_STEPS = 1000;
  const MIN_SANE_STEPS = 100; // sanity floor - a controller that falls in well under 2 seconds is broken, not just imperfect
  let allSurvivedFull = true;
  for (let seed = 1; seed <= 30; seed++) {
    let state = createInitialState(seed);
    let steps = 0;
    let sawOutOfBoundsWhileAlive = false;
    while (state.alive && steps < MAX_STEPS) {
      state = stepPendulo(state, heuristicDecide(state), PENDULO_DT);
      steps++;
      if (state.alive && (Math.abs(state.theta) > THETA_LIMIT_RAD || Math.abs(state.x) > TRACK_LIMIT)) {
        sawOutOfBoundsWhileAlive = true;
      }
    }
    assert(steps >= MIN_SANE_STEPS, `heuristicDecide survives at least ${MIN_SANE_STEPS} steps for seed ${seed} (got ${steps})`);
    assert(!sawOutOfBoundsWhileAlive, `heuristicDecide never reports alive=true while out of bounds, seed ${seed}`);
    if (steps < MAX_STEPS) allSurvivedFull = false;
  }
  // Not a hard requirement (the controller only needs to be "good enough", not perfect), but with
  // the tuned gains it does in fact solve every one of these 30 seeds - recorded here as the
  // measured empirical result, matching the site's convention of asserting the real outcome rather
  // than an assumed one. If this ever regresses, it's worth investigating (a gain change likely
  // weakened the controller) before just loosening the assertion.
  assert(allSurvivedFull, "heuristicDecide reaches the full 1000-step cap on every one of seeds 1..30");
}

// --- GaOps validity fuzz (200 trials) ---
{
  const ops = buildPenduloGaOps({ runSeed: 1, maxSteps: 50, dt: PENDULO_DT });
  const rng = seeded(9);
  function isValidGenome(g: Float64Array): boolean {
    return g.length === GENOME_LENGTH && Array.from(g).every((v) => Number.isFinite(v));
  }
  for (let trial = 0; trial < 200; trial++) {
    const a = ops.randomGenome(rng);
    const b = ops.randomGenome(rng);
    assert(isValidGenome(a) && isValidGenome(b), `randomGenome produces finite genomes of length ${GENOME_LENGTH} [trial ${trial}]`);
    const child = ops.crossover(a, b, rng);
    assert(isValidGenome(child), `crossover always produces a finite genome of the right length [trial ${trial}]`);
    const mutated = ops.mutate(child, rng, 1);
    assert(isValidGenome(mutated), `mutate always produces a finite genome of the right length [trial ${trial}]`);
  }
}

// --- Empirical claim: the GA actually learns ---
// Not presuming the direction - measured directly (see scratch runs during development, consistent
// across 5 different seeds): a small, cheap evolution run reliably improves from a mediocre
// generation 0 to a near-perfect final generation. If this direction ever flips, update this
// assertion and the module's UI copy together, same convention as the other comparison modules.
{
  const config: GaConfig = {
    populationSize: 30,
    generations: 15,
    eliteCount: 3,
    mutationRate: 0.15,
    crossoverRate: 0.7,
    tournamentSize: 4,
    seed: 42,
  };
  const ops = buildPenduloGaOps({ runSeed: 456, maxSteps: 300, dt: PENDULO_DT });
  const iterator = evolve(config, ops);
  let next = iterator.next();
  const summaries = [];
  while (!next.done) {
    summaries.push(next.value);
    next = iterator.next();
  }
  const first = summaries[0];
  const last = summaries[summaries.length - 1];
  assert(summaries.length === config.generations, `evolve() yields exactly ${config.generations} generation summaries`);
  assert(last.bestFitness > first.bestFitness * 1.5, `best fitness improves substantially from gen 0 (${first.bestFitness.toFixed(1)}) to the final generation (${last.bestFitness.toFixed(1)})`);
  assert(last.bestFitness > 250, `final generation's best genome nearly solves the 300-step episode (${last.bestFitness.toFixed(1)})`);
  assert(next.value.bestEverFitness >= last.bestFitness, "bestEverFitness is at least as good as the final generation's best");
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll Pendulo tests passed.");
}
