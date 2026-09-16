import { seededRng } from "@/lib/core/rng";

/**
 * A small multi-class classifier for handwritten digits - still trained by real gradient descent
 * (backpropagation, same family as the Classificador Linear), but the jump from "2 classes in a 2D
 * plane" to "10 classes in an 8x8 image drawn by hand" needs softmax + cross-entropy instead of a
 * single sigmoid. Trained on procedurally-varied versions of 10 hand-authored templates - the same
 * 8x8 resolution as the classic small digit datasets - rather than any downloaded dataset, so the
 * whole module stays as local as the rest of the site.
 */

export const GRID = 8;
export const N = GRID * GRID;
export const CLASSES = 10;

function parseTemplate(rows: string[]): number[] {
  const values: number[] = [];
  for (const row of rows) {
    for (const ch of row) values.push(ch === "#" ? 1 : 0);
  }
  return values;
}

/** Hand-authored 8x8 pixel-font glyphs, one per digit - the canonical shape every training sample
 *  is a noisy variation of. */
export const DIGIT_TEMPLATES: number[][] = [
  parseTemplate(["..####..", ".#....#.", "#......#", "#......#", "#......#", "#......#", ".#....#.", "..####.."]), // 0
  parseTemplate(["...#....", "..##....", "...#....", "...#....", "...#....", "...#....", "...#....", ".#####.."]), // 1
  parseTemplate([".#####..", "#.....#.", "......#.", ".....#..", "....#...", "...#....", "..#.....", "#######."]), // 2
  parseTemplate([".#####..", "#.....#.", "......#.", "...###..", "......#.", "......#.", "#.....#.", ".#####.."]), // 3
  parseTemplate(["....##..", "...##...", "..#.#...", ".#..#...", "#...#...", "########", "....#...", "....#..."]), // 4
  parseTemplate(["#######.", "#.......", "#.......", "######..", ".....#..", "......#.", "#.....#.", ".#####.."]), // 5
  parseTemplate(["..####..", ".#......", "#.......", "#.####..", "##....#.", "#.....#.", "#.....#.", ".#####.."]), // 6
  parseTemplate(["#######.", "......#.", ".....#..", "....#...", "...#....", "..#.....", "..#.....", "..#....."]), // 7
  parseTemplate([".#####..", "#.....#.", "#.....#.", ".#####..", "#.....#.", "#.....#.", "#.....#.", ".#####.."]), // 8
  parseTemplate([".#####..", "#.....#.", "#.....#.", ".######.", "......#.", ".....#..", "....#...", "..##...."]), // 9
];

export interface DigitSample {
  pixels: number[]; // length N, values in [0, 1]
  label: number; // 0-9
}

/** One sample per (digit, replica) - the canonical template plus per-pixel noise, clamped to
 *  [0, 1], simulating the messiness of real handwriting without needing any external dataset. */
export function generateDataset(samplesPerDigit: number, noise: number, seed: number): DigitSample[] {
  const rng = seededRng(seed);
  const samples: DigitSample[] = [];
  for (let label = 0; label < CLASSES; label++) {
    const template = DIGIT_TEMPLATES[label];
    for (let r = 0; r < samplesPerDigit; r++) {
      const pixels = template.map((v) => Math.min(1, Math.max(0, v + (rng() * 2 - 1) * noise)));
      samples.push({ pixels, label });
    }
  }
  return samples;
}

export interface Network {
  hiddenSize: number;
  w1: number[][]; // hiddenSize x N
  b1: number[]; // hiddenSize
  w2: number[][]; // CLASSES x hiddenSize
  b2: number[]; // CLASSES
}

function randWeight(rng: () => number, scale: number): number {
  return (rng() * 2 - 1) * scale;
}

export function initNetwork(hiddenSize: number, seed: number): Network {
  const rng = seededRng(seed);
  const scale1 = 1 / Math.sqrt(N);
  const scale2 = 1 / Math.sqrt(hiddenSize);
  const w1: number[][] = [];
  const b1: number[] = [];
  for (let j = 0; j < hiddenSize; j++) {
    w1.push(Array.from({ length: N }, () => randWeight(rng, scale1)));
    b1.push(0);
  }
  const w2: number[][] = [];
  const b2: number[] = [];
  for (let k = 0; k < CLASSES; k++) {
    w2.push(Array.from({ length: hiddenSize }, () => randWeight(rng, scale2)));
    b2.push(0);
  }
  return { hiddenSize, w1, b1, w2, b2 };
}

function softmax(z: number[]): number[] {
  const max = Math.max(...z);
  const exps = z.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

/** Forward pass, returning the hidden activations and output probabilities - the same single
 *  implementation feeds both training and every live prediction shown in the UI. */
export function forward(net: Network, pixels: number[]): { hidden: number[]; probs: number[] } {
  const hidden = net.w1.map((row, j) => {
    let sum = net.b1[j];
    for (let i = 0; i < N; i++) sum += row[i] * pixels[i];
    return Math.tanh(sum);
  });
  const logits = net.w2.map((row, k) => {
    let sum = net.b2[k];
    for (let j = 0; j < net.hiddenSize; j++) sum += row[j] * hidden[j];
    return sum;
  });
  return { hidden, probs: softmax(logits) };
}

export function predict(net: Network, pixels: number[]): number {
  const { probs } = forward(net, pixels);
  let best = 0;
  for (let k = 1; k < probs.length; k++) if (probs[k] > probs[best]) best = k;
  return best;
}

export function evaluate(net: Network, samples: DigitSample[]): { loss: number; accuracy: number } {
  const EPS = 1e-7;
  let loss = 0;
  let correct = 0;
  for (const s of samples) {
    const { probs } = forward(net, s.pixels);
    loss += -Math.log(Math.min(1, Math.max(EPS, probs[s.label])));
    let best = 0;
    for (let k = 1; k < probs.length; k++) if (probs[k] > probs[best]) best = k;
    if (best === s.label) correct++;
  }
  return { loss: loss / samples.length, accuracy: correct / samples.length };
}

function cloneNetwork(net: Network): Network {
  return {
    hiddenSize: net.hiddenSize,
    w1: net.w1.map((r) => [...r]),
    b1: [...net.b1],
    w2: net.w2.map((r) => [...r]),
    b2: [...net.b2],
  };
}

/** One batch-gradient-descent step. `dL/dz_k = softmax_k - onehot_k` is the same clean identity as
 *  the Classificador Linear's binary case (sigmoid+BCE), generalized to softmax+cross-entropy. */
function trainOneEpoch(net: Network, samples: DigitSample[], learningRate: number): Network {
  const next = cloneNetwork(net);
  const n = samples.length;
  const gw1 = net.w1.map((row) => row.map(() => 0));
  const gb1 = net.b1.map(() => 0);
  const gw2 = net.w2.map((row) => row.map(() => 0));
  const gb2 = net.b2.map(() => 0);

  for (const s of samples) {
    const { hidden, probs } = forward(net, s.pixels);
    const dz = probs.map((p, k) => p - (k === s.label ? 1 : 0));

    for (let k = 0; k < CLASSES; k++) {
      for (let j = 0; j < net.hiddenSize; j++) gw2[k][j] += dz[k] * hidden[j];
      gb2[k] += dz[k];
    }

    const dHidden = new Array(net.hiddenSize).fill(0);
    for (let j = 0; j < net.hiddenSize; j++) {
      let sum = 0;
      for (let k = 0; k < CLASSES; k++) sum += dz[k] * net.w2[k][j];
      dHidden[j] = sum * (1 - hidden[j] * hidden[j]);
    }
    for (let j = 0; j < net.hiddenSize; j++) {
      for (let i = 0; i < N; i++) gw1[j][i] += dHidden[j] * s.pixels[i];
      gb1[j] += dHidden[j];
    }
  }

  for (let j = 0; j < net.hiddenSize; j++) {
    for (let i = 0; i < N; i++) next.w1[j][i] -= learningRate * (gw1[j][i] / n);
    next.b1[j] -= learningRate * (gb1[j] / n);
  }
  for (let k = 0; k < CLASSES; k++) {
    for (let j = 0; j < net.hiddenSize; j++) next.w2[k][j] -= learningRate * (gw2[k][j] / n);
    next.b2[k] -= learningRate * (gb2[k] / n);
  }
  return next;
}

export interface EpochSnapshot {
  epoch: number;
  network: Network;
  loss: number;
  accuracy: number;
}

export interface TrainConfig {
  dataset: DigitSample[];
  hiddenSize: number;
  learningRate: number;
  epochs: number;
  seed: number;
}

export interface TrainResult {
  snapshots: EpochSnapshot[];
  finalNetwork: Network;
}

/** Same generator shape as the Classificador Linear's trainGradientDescent - one snapshot per
 *  epoch, epoch 0 being the untrained network - so LossChart works unmodified. */
export function* trainGradientDescent(config: TrainConfig): Generator<EpochSnapshot, TrainResult, void> {
  let net = initNetwork(config.hiddenSize, config.seed);
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
