import { seededRng } from "@/lib/core/rng";
import { CAT_PHOTOS, DOG_PHOTOS, PHOTO_SIZE } from "./photos-data";

/**
 * A small convolutional network (conv -> ReLU -> max-pool -> dense -> dense) trained by real
 * backpropagation - the first module on the site to actually learn convolutional filters, rather
 * than treating the image as one flat vector like Dígitos does. Training images are 156 real cat and
 * dog photographs (78 each, openly licensed - see public/gatos-cachorros/ATTRIBUTIONS.md), not
 * procedurally generated shapes: each photo was center-cropped, downscaled to PHOTO_SIZE x
 * PHOTO_SIZE and converted to grayscale once (see photos-data.ts's header for how to regenerate),
 * so training and testing here need no image-decoding dependency - just these plain number arrays.
 */

export const SIZE = PHOTO_SIZE;
export const N = SIZE * SIZE;
export const CONV = SIZE - 2; // valid (no padding) 3x3 convolution, stride 1
export const POOL = CONV / 2; // non-overlapping 2x2 max-pool
export const NUM_FILTERS = 4;
export const HIDDEN = 16;
export const FLAT = POOL * POOL * NUM_FILTERS;

// ---------------------------------------------------------------------------
// Dataset: real photos, split into a fixed train/test set (no procedural generation)
// ---------------------------------------------------------------------------

export interface CreatureSample {
  pixels: number[]; // length N, values in [0, 1]
  label: number; // 0 = gato, 1 = cachorro
  photoUrl: string; // the real photo this sample's pixels were derived from
}

export const CREATURE_LABELS = ["gato", "cachorro"];

const PHOTO_COUNT = 78;
const TEST_COUNT = 16; // per class, held out of training entirely (~20%, same ratio as before)

function photoUrl(cls: "gato" | "cachorro", i: number): string {
  return `/gatos-cachorros/${cls}/${cls}-${String(i + 1).padStart(3, "0")}.jpg`;
}

function mirrorHorizontal(pixels: number[]): number[] {
  const out = new Array(N);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) out[y * SIZE + x] = pixels[y * SIZE + (SIZE - 1 - x)];
  return out;
}

// Which photos of each class are held out isn't arbitrary: shuffled once with a fixed seed, not
// "always the last N by curation order". The photos were added to public/gatos-cachorros/ in
// whatever order they were found on Wikimedia Commons, not by difficulty - taking a literal tail
// slice previously risked baking in whatever happened to get curated last (with the original
// 15-per-class set, two atypical dog photos landing in the test set together produced a real,
// reproducible "predicts gato" skew on held-out dogs, not a fluke of one seed). The shuffle is
// deterministic (fixed seeds below) so the split itself is still reproducible.
function shuffledIndices(count: number, seed: number): number[] {
  const idx = Array.from({ length: count }, (_, i) => i);
  const rng = seededRng(seed);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}
const CAT_ORDER = shuffledIndices(PHOTO_COUNT, 7);
const DOG_ORDER = shuffledIndices(PHOTO_COUNT, 13);

function classSamples(cls: "gato" | "cachorro", label: number, photos: number[][], indices: number[]): CreatureSample[] {
  return indices.map((i) => ({ pixels: photos[i], label, photoUrl: photoUrl(cls, i) }));
}

/**
 * Fixed training set: 62 of each class's 78 photos (see CAT_ORDER/DOG_ORDER above for why they're
 * shuffled rather than a literal index range), mirrored horizontally as well - a real, standard
 * augmentation (same photo, reflected) rather than synthetic data, doubling 124 raw photos to 248
 * training samples. Real photos are fixed, unlike the old procedural generator's infinite supply, so
 * this doubling meaningfully helps a network with thousands of weights avoid just memorizing them.
 */
export function trainingSet(): CreatureSample[] {
  const cats = classSamples("gato", 0, CAT_PHOTOS, CAT_ORDER.slice(0, PHOTO_COUNT - TEST_COUNT));
  const dogs = classSamples("cachorro", 1, DOG_PHOTOS, DOG_ORDER.slice(0, PHOTO_COUNT - TEST_COUNT));
  const raw = [...cats, ...dogs];
  const mirrored = raw.map((s) => ({ ...s, pixels: mirrorHorizontal(s.pixels) }));
  return [...raw, ...mirrored];
}

/** The 3 held-out photos of each class - never seen during training, the real measure of generalization. */
export function testSet(): CreatureSample[] {
  const cats = classSamples("gato", 0, CAT_PHOTOS, CAT_ORDER.slice(PHOTO_COUNT - TEST_COUNT));
  const dogs = classSamples("cachorro", 1, DOG_PHOTOS, DOG_ORDER.slice(PHOTO_COUNT - TEST_COUNT));
  return [...cats, ...dogs];
}

/** A random held-out photo, e.g. for the page's "Nova imagem" button - real generalization, since
 *  none of these 6 photos were part of training. */
export function randomTestSample(): CreatureSample {
  const pool = testSet();
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------------------------------------------------------------------------
// Network: conv(3x3x4) -> ReLU -> maxpool(2x2) -> flatten -> dense(16, tanh) -> dense(1, sigmoid)
// ---------------------------------------------------------------------------

export interface Network {
  convW: number[][][]; // [NUM_FILTERS][3][3]
  convB: number[]; // [NUM_FILTERS]
  denseW: number[][]; // [HIDDEN][FLAT]
  denseB: number[]; // [HIDDEN]
  outW: number[]; // [HIDDEN]
  outB: number;
}

function randWeight(rng: () => number, scale: number): number {
  return (rng() * 2 - 1) * scale;
}

export function initNetwork(seed: number): Network {
  const rng = seededRng(seed);
  const convScale = 1 / Math.sqrt(9);
  const denseScale = 1 / Math.sqrt(FLAT);
  const outScale = 1 / Math.sqrt(HIDDEN);
  const convW = Array.from({ length: NUM_FILTERS }, () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => randWeight(rng, convScale))));
  // Small random init, not exactly 0: most of a silhouette image is background (all-zero) pixels, so
  // an all-zero 3x3 window is common - with convB starting at exactly 0 that puts hundreds of
  // pre-activations exactly on the ReLU kink at once, which is fine for training but makes the
  // gradient-check test's finite difference genuinely discontinuous right at initialization.
  const convB = Array.from({ length: NUM_FILTERS }, () => randWeight(rng, 0.01));
  const denseW = Array.from({ length: HIDDEN }, () => Array.from({ length: FLAT }, () => randWeight(rng, denseScale)));
  const denseB = new Array(HIDDEN).fill(0);
  const outW = Array.from({ length: HIDDEN }, () => randWeight(rng, outScale));
  return { convW, convB, denseW, denseB, outW, outB: 0 };
}

// Leaky, not plain ReLU: with only 4 filters and a tiny dataset, a filter that goes negative on
// every training example gets exactly zero gradient under plain ReLU (dead(x>0)=0 everywhere) and
// can never recover - in practice 3 of the 4 filters died this way within a few dozen epochs. The
// small negative slope keeps a trickle of gradient flowing through a "dead" filter so it can climb
// back to positive territory instead of getting stuck there permanently. Raised from 0.1 to 0.5 once
// WEIGHT_DECAY (below) was added - decay alone was enough to push 2-3 of the 4 filters back into
// dead territory, and a bigger leak keeps all 4 alive even while decay pulls weights down.
const LEAKY_ALPHA = 0.5;

function leakyRelu(x: number): number {
  return x > 0 ? x : LEAKY_ALPHA * x;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export interface ForwardResult {
  convOut: number[][][]; // [NUM_FILTERS][CONV][CONV], post-ReLU
  pooled: number[][][]; // [NUM_FILTERS][POOL][POOL]
  hidden: number[]; // [HIDDEN]
  output: number; // sigmoid probability of "cachorro"
}

interface ForwardCache extends ForwardResult {
  convPre: number[][][];
  poolArgmax: [number, number][][][]; // [NUM_FILTERS][POOL][POOL] -> winning (dy, dx) within its 2x2 window
  flatten: number[];
}

function toGrid(pixels: number[]): number[][] {
  const input: number[][] = [];
  for (let y = 0; y < SIZE; y++) {
    const row: number[] = [];
    for (let x = 0; x < SIZE; x++) row.push(pixels[y * SIZE + x]);
    input.push(row);
  }
  return input;
}

/** Full forward pass with every intermediate activation needed for backprop - the single
 *  implementation both training and `forward()` (for live predictions/feature maps) build on. */
function forwardFull(net: Network, pixels: number[]): ForwardCache {
  const input = toGrid(pixels);

  const convPre: number[][][] = [];
  const convOut: number[][][] = [];
  for (let f = 0; f < NUM_FILTERS; f++) {
    const pre: number[][] = [];
    const post: number[][] = [];
    for (let oy = 0; oy < CONV; oy++) {
      const preRow: number[] = [];
      const postRow: number[] = [];
      for (let ox = 0; ox < CONV; ox++) {
        let sum = net.convB[f];
        for (let ky = 0; ky < 3; ky++) for (let kx = 0; kx < 3; kx++) sum += net.convW[f][ky][kx] * input[oy + ky][ox + kx];
        preRow.push(sum);
        postRow.push(leakyRelu(sum));
      }
      pre.push(preRow);
      post.push(postRow);
    }
    convPre.push(pre);
    convOut.push(post);
  }

  const pooled: number[][][] = [];
  const poolArgmax: [number, number][][][] = [];
  for (let f = 0; f < NUM_FILTERS; f++) {
    const pRow: number[][] = [];
    const aRow: [number, number][][] = [];
    for (let py = 0; py < POOL; py++) {
      const pr: number[] = [];
      const ar: [number, number][] = [];
      for (let px = 0; px < POOL; px++) {
        let best = -Infinity;
        let bestDy = 0;
        let bestDx = 0;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const v = convOut[f][py * 2 + dy][px * 2 + dx];
            if (v > best) {
              best = v;
              bestDy = dy;
              bestDx = dx;
            }
          }
        }
        pr.push(best);
        ar.push([bestDy, bestDx]);
      }
      pRow.push(pr);
      aRow.push(ar);
    }
    pooled.push(pRow);
    poolArgmax.push(aRow);
  }

  const flatten: number[] = new Array(FLAT);
  for (let f = 0; f < NUM_FILTERS; f++)
    for (let py = 0; py < POOL; py++) for (let px = 0; px < POOL; px++) flatten[f * POOL * POOL + py * POOL + px] = pooled[f][py][px];

  const hidden: number[] = net.denseW.map((row, j) => {
    let sum = net.denseB[j];
    for (let i = 0; i < FLAT; i++) sum += row[i] * flatten[i];
    return Math.tanh(sum);
  });

  let outPre = net.outB;
  for (let j = 0; j < HIDDEN; j++) outPre += net.outW[j] * hidden[j];
  const output = sigmoid(outPre);

  return { convPre, convOut, pooled, poolArgmax, flatten, hidden, output };
}

export function forward(net: Network, pixels: number[]): ForwardResult {
  const { convOut, pooled, hidden, output } = forwardFull(net, pixels);
  return { convOut, pooled, hidden, output };
}

export function predict(net: Network, pixels: number[]): number {
  return forward(net, pixels).output >= 0.5 ? 1 : 0;
}

export function evaluate(net: Network, samples: CreatureSample[]): { loss: number; accuracy: number } {
  const EPS = 1e-7;
  let loss = 0;
  let correct = 0;
  for (const s of samples) {
    const { output } = forward(net, s.pixels);
    const p = Math.min(1 - EPS, Math.max(EPS, output));
    loss += -(s.label * Math.log(p) + (1 - s.label) * Math.log(1 - p));
    if ((output >= 0.5 ? 1 : 0) === s.label) correct++;
  }
  return { loss: loss / samples.length, accuracy: correct / samples.length };
}

function cloneNetwork(net: Network): Network {
  return {
    convW: net.convW.map((f) => f.map((r) => [...r])),
    convB: [...net.convB],
    denseW: net.denseW.map((r) => [...r]),
    denseB: [...net.denseB],
    outW: [...net.outW],
    outB: net.outB,
  };
}

interface Gradients {
  convW: number[][][];
  convB: number[];
  denseW: number[][];
  denseB: number[];
  outW: number[];
  outB: number;
}

function zeroGradients(): Gradients {
  return {
    convW: Array.from({ length: NUM_FILTERS }, () => Array.from({ length: 3 }, () => new Array(3).fill(0))),
    convB: new Array(NUM_FILTERS).fill(0),
    denseW: Array.from({ length: HIDDEN }, () => new Array(FLAT).fill(0)),
    denseB: new Array(HIDDEN).fill(0),
    outW: new Array(HIDDEN).fill(0),
    outB: 0,
  };
}

/**
 * Backprop for one sample, hand-derived layer by layer: the sigmoid+BCE identity at the output
 * (same as every other module's binary case), then dense-hidden backprop (identical shape to
 * Dígitos), then maxpool backward (route the gradient only to the position that won the max - every
 * other position in the 2x2 window gets zero), then ReLU backward (zero out where the pre-activation
 * wasn't positive), then conv backward (the weight gradient is a correlation between the input patch
 * and the output gradient - the same sliding-window shape as the forward pass, just accumulating
 * instead of producing one value per position). Exported so the gradient-check test can compare it
 * directly against a finite-difference numerical gradient before anything is trusted to train on it.
 */
export function computeGradients(net: Network, sample: CreatureSample): Gradients {
  const cache = forwardFull(net, sample.pixels);
  const input = toGrid(sample.pixels);
  const g = zeroGradients();

  const dOutPre = cache.output - sample.label;
  for (let j = 0; j < HIDDEN; j++) g.outW[j] = dOutPre * cache.hidden[j];
  g.outB = dOutPre;

  const dHidden = new Array(HIDDEN);
  for (let j = 0; j < HIDDEN; j++) dHidden[j] = dOutPre * net.outW[j] * (1 - cache.hidden[j] * cache.hidden[j]);

  for (let j = 0; j < HIDDEN; j++) {
    for (let i = 0; i < FLAT; i++) g.denseW[j][i] = dHidden[j] * cache.flatten[i];
    g.denseB[j] = dHidden[j];
  }

  const dFlatten = new Array(FLAT).fill(0);
  for (let i = 0; i < FLAT; i++) {
    let sum = 0;
    for (let j = 0; j < HIDDEN; j++) sum += dHidden[j] * net.denseW[j][i];
    dFlatten[i] = sum;
  }

  const dConvPre: number[][][] = Array.from({ length: NUM_FILTERS }, () => Array.from({ length: CONV }, () => new Array(CONV).fill(0)));
  for (let f = 0; f < NUM_FILTERS; f++) {
    for (let py = 0; py < POOL; py++) {
      for (let px = 0; px < POOL; px++) {
        const dPool = dFlatten[f * POOL * POOL + py * POOL + px];
        const [dy, dx] = cache.poolArgmax[f][py][px];
        const oy = py * 2 + dy;
        const ox = px * 2 + dx;
        dConvPre[f][oy][ox] += dPool * (cache.convPre[f][oy][ox] > 0 ? 1 : LEAKY_ALPHA);
      }
    }
  }

  for (let f = 0; f < NUM_FILTERS; f++) {
    for (let oy = 0; oy < CONV; oy++) {
      for (let ox = 0; ox < CONV; ox++) {
        const d = dConvPre[f][oy][ox];
        if (d === 0) continue;
        g.convB[f] += d;
        for (let ky = 0; ky < 3; ky++) for (let kx = 0; kx < 3; kx++) g.convW[f][ky][kx] += d * input[oy + ky][ox + kx];
      }
    }
  }

  return g;
}

// L2 weight decay: with a network this large (thousands of weights), plain gradient descent happily
// grows weights to whatever size perfectly fits the training examples, which pushes the final sigmoid
// into saturation - confident near 0 or 1 - regardless of whether the underlying prediction is even
// right. Shrinking every weight a little on each update (proportional to the weight itself, not tied
// to any one sample) caps how hard any layer can commit. Only applied to weights (convW/denseW/outW),
// not biases - a bias doesn't multiply an input, so shrinking it doesn't fight overfitting the same
// way. Lowered from 0.05 (tuned for the original 24-photo training set) to 0.02 after growing the
// dataset to 124 photos per class: at 0.05 the decay term dominated the much noisier, more diverse
// gradient signal and regularly collapsed training to a constant-output network (50% accuracy,
// rising loss) instead of just curbing overconfidence.
const WEIGHT_DECAY = 0.02;

function trainOneEpoch(net: Network, samples: CreatureSample[], learningRate: number): Network {
  const next = cloneNetwork(net);
  const n = samples.length;
  const g = zeroGradients();

  for (const s of samples) {
    const sg = computeGradients(net, s);
    for (let f = 0; f < NUM_FILTERS; f++) {
      for (let ky = 0; ky < 3; ky++) for (let kx = 0; kx < 3; kx++) g.convW[f][ky][kx] += sg.convW[f][ky][kx];
      g.convB[f] += sg.convB[f];
    }
    for (let j = 0; j < HIDDEN; j++) {
      for (let i = 0; i < FLAT; i++) g.denseW[j][i] += sg.denseW[j][i];
      g.denseB[j] += sg.denseB[j];
      g.outW[j] += sg.outW[j];
    }
    g.outB += sg.outB;
  }

  for (let f = 0; f < NUM_FILTERS; f++) {
    for (let ky = 0; ky < 3; ky++)
      for (let kx = 0; kx < 3; kx++) next.convW[f][ky][kx] -= learningRate * (g.convW[f][ky][kx] / n + WEIGHT_DECAY * net.convW[f][ky][kx]);
    next.convB[f] -= learningRate * (g.convB[f] / n);
  }
  for (let j = 0; j < HIDDEN; j++) {
    for (let i = 0; i < FLAT; i++) next.denseW[j][i] -= learningRate * (g.denseW[j][i] / n + WEIGHT_DECAY * net.denseW[j][i]);
    next.denseB[j] -= learningRate * (g.denseB[j] / n);
    next.outW[j] -= learningRate * (g.outW[j] / n + WEIGHT_DECAY * net.outW[j]);
  }
  next.outB -= learningRate * (g.outB / n);

  return next;
}

export interface EpochSnapshot {
  epoch: number;
  network: Network;
  loss: number;
  accuracy: number;
}

export interface TrainConfig {
  dataset: CreatureSample[];
  learningRate: number;
  epochs: number;
  seed: number;
}

export interface TrainResult {
  snapshots: EpochSnapshot[];
  finalNetwork: Network;
}

/** Same generator shape as every other module's trainGradientDescent - one snapshot per epoch,
 *  epoch 0 being the untrained network - so LossChart works unmodified. */
export function* trainGradientDescent(config: TrainConfig): Generator<EpochSnapshot, TrainResult, void> {
  let net = initNetwork(config.seed);
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
