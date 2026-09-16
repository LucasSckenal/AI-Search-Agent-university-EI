import { seededRng } from "@/lib/core/rng";

/**
 * A small 2D binary classifier trained by real gradient descent (backpropagation), not evolution -
 * the direct counterpart to Pêndulo's neuroevolved network. With the hidden layer switched off this
 * is a plain single-layer perceptron (Rosenblatt, 1958): it can only ever draw a straight decision
 * boundary, so it's mathematically unable to solve "círculo" or "xor" (the exact limitation Minsky
 * & Papert used in 1969 to argue against perceptrons, and the reason multi-layer networks exist at
 * all). Switching the hidden layer on turns it into a tiny MLP that curves the boundary and solves
 * both - the toggle is the whole lesson.
 */

export type DatasetKind = "linear" | "circle" | "xor";

export interface Point {
  x: number;
  y: number;
  label: 0 | 1;
}

const MARGIN = {
  linear: 0.04,
  circle: 0.02,
  xor: 0.08,
} as const;

/** Rejection-samples points at least MARGIN away from the true boundary, so the dataset always has
 *  a clean margin - a point sitting exactly on the boundary would make "correctly classified" and
 *  the rendered boundary itself ambiguous for no pedagogical benefit. */
export function generateDataset(kind: DatasetKind, count: number, seed: number): Point[] {
  const rng = seededRng(seed);
  const points: Point[] = [];

  // Fixed random separating line for "linear", drawn once per dataset so every point is judged
  // against the same line.
  const lineAngle = rng() * Math.PI;
  const lineCos = Math.cos(lineAngle);
  const lineSin = Math.sin(lineAngle);

  let guard = 0;
  while (points.length < count && guard < count * 400) {
    guard++;
    const x = rng() * 2 - 1;
    const y = rng() * 2 - 1;

    if (kind === "linear") {
      const value = x * lineCos + y * lineSin;
      if (Math.abs(value) < MARGIN.linear) continue;
      points.push({ x, y, label: value > 0 ? 1 : 0 });
    } else if (kind === "circle") {
      const r2 = x * x + y * y;
      const threshold = 0.36; // radius 0.6, tuned so both classes get a reasonable share of the square
      if (Math.abs(r2 - threshold) < MARGIN.circle) continue;
      points.push({ x, y, label: r2 < threshold ? 1 : 0 });
    } else {
      if (Math.abs(x) < MARGIN.xor || Math.abs(y) < MARGIN.xor) continue;
      points.push({ x, y, label: Math.sign(x) === Math.sign(y) ? 1 : 0 });
    }
  }
  return points;
}

export interface Network {
  useHidden: boolean;
  hiddenSize: number;
  /** hiddenSize x 2, unused (empty) when useHidden is false. */
  w1: number[][];
  /** length hiddenSize, unused (empty) when useHidden is false. */
  b1: number[];
  /** length hiddenSize when useHidden, else length 2 (direct weights on x and y). */
  w2: number[];
  b2: number;
}

function randWeight(rng: () => number): number {
  return (rng() * 2 - 1) * 0.9;
}

export function initNetwork(useHidden: boolean, hiddenSize: number, seed: number): Network {
  const rng = seededRng(seed);
  if (!useHidden) {
    return { useHidden, hiddenSize, w1: [], b1: [], w2: [randWeight(rng), randWeight(rng)], b2: randWeight(rng) };
  }
  const w1: number[][] = [];
  const b1: number[] = [];
  for (let j = 0; j < hiddenSize; j++) {
    w1.push([randWeight(rng), randWeight(rng)]);
    b1.push(randWeight(rng));
  }
  const w2: number[] = [];
  for (let j = 0; j < hiddenSize; j++) w2.push(randWeight(rng));
  return { useHidden, hiddenSize, w1, b1, w2, b2: randWeight(rng) };
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/** Forward pass. Returns the hidden activations (empty if !useHidden) and the final probability -
 *  both NetworkViz (live weights/activations) and evaluate/predict are built on this single
 *  implementation, so the diagram can never show something other than what's actually running. */
export function forward(net: Network, x: number, y: number): { hidden: number[]; output: number } {
  if (!net.useHidden) {
    const z = net.w2[0] * x + net.w2[1] * y + net.b2;
    return { hidden: [], output: sigmoid(z) };
  }
  const hidden = net.w1.map(([wx, wy], j) => Math.tanh(wx * x + wy * y + net.b1[j]));
  let z = net.b2;
  for (let j = 0; j < hidden.length; j++) z += net.w2[j] * hidden[j];
  return { hidden, output: sigmoid(z) };
}

export function predict(net: Network, x: number, y: number): 0 | 1 {
  return forward(net, x, y).output > 0.5 ? 1 : 0;
}

export function evaluate(net: Network, points: Point[]): { loss: number; accuracy: number } {
  const EPS = 1e-7;
  let loss = 0;
  let correct = 0;
  for (const p of points) {
    const { output } = forward(net, p.x, p.y);
    const clamped = Math.min(1 - EPS, Math.max(EPS, output));
    loss += -(p.label * Math.log(clamped) + (1 - p.label) * Math.log(1 - clamped));
    if ((output > 0.5 ? 1 : 0) === p.label) correct++;
  }
  return { loss: loss / points.length, accuracy: correct / points.length };
}

function cloneNetwork(net: Network): Network {
  return {
    useHidden: net.useHidden,
    hiddenSize: net.hiddenSize,
    w1: net.w1.map((row) => [...row]),
    b1: [...net.b1],
    w2: [...net.w2],
    b2: net.b2,
  };
}

/** One full batch-gradient-descent step over the whole dataset. Derived by hand for this exact
 *  tiny network (sigmoid output + binary cross-entropy loss, optional single tanh hidden layer) -
 *  small enough that an autodiff library would be pure overhead. */
function trainOneEpoch(net: Network, points: Point[], learningRate: number): Network {
  const next = cloneNetwork(net);
  const n = points.length;

  if (!net.useHidden) {
    let gw0 = 0, gw1 = 0, gb = 0;
    for (const p of points) {
      const { output } = forward(net, p.x, p.y);
      const err = output - p.label; // dL/dz for sigmoid+BCE
      gw0 += err * p.x;
      gw1 += err * p.y;
      gb += err;
    }
    next.w2[0] -= learningRate * (gw0 / n);
    next.w2[1] -= learningRate * (gw1 / n);
    next.b2 -= learningRate * (gb / n);
    return next;
  }

  const gw1 = net.w1.map(() => [0, 0]);
  const gb1 = net.b1.map(() => 0);
  const gw2 = net.w2.map(() => 0);
  let gb2 = 0;

  for (const p of points) {
    const { hidden, output } = forward(net, p.x, p.y);
    const err = output - p.label; // dL/dz_output
    for (let j = 0; j < hidden.length; j++) {
      gw2[j] += err * hidden[j];
      const dHidden = err * net.w2[j] * (1 - hidden[j] * hidden[j]); // dL/d(pre-activation of hidden j)
      gw1[j][0] += dHidden * p.x;
      gw1[j][1] += dHidden * p.y;
      gb1[j] += dHidden;
    }
    gb2 += err;
  }

  for (let j = 0; j < next.w1.length; j++) {
    next.w1[j][0] -= learningRate * (gw1[j][0] / n);
    next.w1[j][1] -= learningRate * (gw1[j][1] / n);
    next.b1[j] -= learningRate * (gb1[j] / n);
    next.w2[j] -= learningRate * (gw2[j] / n);
  }
  next.b2 -= learningRate * (gb2 / n);
  return next;
}

export interface EpochSnapshot {
  epoch: number;
  network: Network;
  loss: number;
  accuracy: number;
}

export interface TrainConfig {
  dataset: Point[];
  useHidden: boolean;
  hiddenSize: number;
  learningRate: number;
  epochs: number;
  seed: number;
}

export interface TrainResult {
  snapshots: EpochSnapshot[];
  finalNetwork: Network;
}

/** Trains by full-batch gradient descent, yielding one snapshot per epoch (epoch 0 = the untrained,
 *  randomly-initialized network) so a caller can scrub playback exactly like the site's GA modules
 *  scrub by generation - same shape, different algorithm underneath. */
export function* trainGradientDescent(config: TrainConfig): Generator<EpochSnapshot, TrainResult, void> {
  let net = initNetwork(config.useHidden, config.hiddenSize, config.seed);
  const snapshots: EpochSnapshot[] = [];

  const initial = evaluate(net, config.dataset);
  const snap0: EpochSnapshot = { epoch: 0, network: cloneNetwork(net), loss: initial.loss, accuracy: initial.accuracy };
  snapshots.push(snap0);
  yield snap0;

  for (let epoch = 1; epoch <= config.epochs; epoch++) {
    net = trainOneEpoch(net, config.dataset, config.learningRate);
    const { loss, accuracy } = evaluate(net, config.dataset);
    const snap: EpochSnapshot = { epoch, network: cloneNetwork(net), loss, accuracy };
    snapshots.push(snap);
    yield snap;
  }

  return { snapshots, finalNetwork: net };
}
