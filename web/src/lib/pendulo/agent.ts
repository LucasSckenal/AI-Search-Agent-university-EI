import { PenduloAction, PenduloState, THETA_LIMIT_RAD, TRACK_LIMIT } from "./model";

/**
 * Feedforward NN "brain" for the pole-balancing agent - two hidden layers (not just one wider
 * layer), which is what actually reads as "a real network" instead of "a rule with some weights"
 * once you look at the live diagram (NetworkViz.tsx) rather than just the site copy. Chromosome =
 * flat weights+biases vector, evolved by the generic GA engine (core/genetic.ts).
 */
export const NN_INPUTS = 4;
export const NN_HIDDEN1 = 8;
export const NN_HIDDEN2 = 6;
export const NN_OUTPUTS = 1;
/** Layer sizes including the input layer - the single source of truth for both the forward pass
 *  and NetworkViz's node layout, so the two can never disagree about the network's shape. */
export const LAYER_SIZES = [NN_INPUTS, NN_HIDDEN1, NN_HIDDEN2, NN_OUTPUTS] as const;

function totalParams(sizes: readonly number[]): number {
  let total = 0;
  for (let i = 1; i < sizes.length; i++) total += sizes[i - 1] * sizes[i] + sizes[i];
  return total;
}
export const GENOME_LENGTH = totalParams(LAYER_SIZES);

// Normalization scales - inputs are clamped to [-1, 1] so no single reading can saturate the
// sigmoid regardless of how far the cart/pole has drifted before the episode ends.
const MAX_X_DOT_NORM = 3;
const MAX_THETA_DOT_NORM = 3;

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Normalized [x, xDot, theta, thetaDot], each scaled to roughly [-1, 1]. */
export function extractInputs(state: PenduloState): number[] {
  return [
    clamp(state.x / TRACK_LIMIT, -1, 1),
    clamp(state.xDot / MAX_X_DOT_NORM, -1, 1),
    clamp(state.theta / THETA_LIMIT_RAD, -1, 1),
    clamp(state.thetaDot / MAX_THETA_DOT_NORM, -1, 1),
  ];
}

export interface NetworkWeights {
  /** weights[layer][toNeuron][fromNeuron], one entry per layer transition (length = LAYER_SIZES.length - 1). */
  weights: number[][][];
  /** biases[layer][neuron], same indexing as weights. */
  biases: number[][];
}

/** Slices a flat genome into per-layer weight matrices and bias vectors - the one place that knows
 *  how the chromosome is laid out. Both `forward` (computation) and NetworkViz (drawing the edges)
 *  read the network through this, so there's exactly one interpretation of what a genome means. */
export function extractWeights(genome: Float64Array): NetworkWeights {
  const weights: number[][][] = [];
  const biases: number[][] = [];
  let cursor = 0;
  for (let l = 1; l < LAYER_SIZES.length; l++) {
    const prevSize = LAYER_SIZES[l - 1];
    const size = LAYER_SIZES[l];
    const w = genome.subarray(cursor, (cursor += prevSize * size));
    const b = genome.subarray(cursor, (cursor += size));
    const layerWeights: number[][] = [];
    for (let n = 0; n < size; n++) {
      layerWeights.push(Array.from(w.subarray(n * prevSize, (n + 1) * prevSize)));
    }
    weights.push(layerWeights);
    biases.push(Array.from(b));
  }
  return { weights, biases };
}

/** Full forward pass, returning every layer's activations - including the raw input layer at index
 *  0 - so a caller can see what every unit is doing, not just the final output. Both `decide` and
 *  NetworkViz's live node brightness are built on this one implementation. */
export function forward(genome: Float64Array, inputs: number[]): number[][] {
  const { weights, biases } = extractWeights(genome);
  const layers: number[][] = [inputs];
  let prev = inputs;
  for (let l = 0; l < weights.length; l++) {
    const layerWeights = weights[l];
    const layerBiases = biases[l];
    const next = layerWeights.map((row, n) => {
      let sum = layerBiases[n];
      for (let p = 0; p < row.length; p++) sum += prev[p] * row[p];
      return sigmoid(sum);
    });
    layers.push(next);
    prev = next;
  }
  return layers;
}

/** Runs the network and thresholds its single output neuron at 0.5 - >0.5 means "right". */
export function decide(genome: Float64Array, inputs: number[]): PenduloAction {
  const layers = forward(genome, inputs);
  return layers[layers.length - 1][0] > 0.5 ? "right" : "left";
}
