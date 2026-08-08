import { GooseAction, GooseRunState, GOOSE_X } from "./model";

/**
 * Small feedforward NN "brain" for a goose agent - a single fixed threshold rule can't express how
 * the jump/duck decision boundary should shift as game speed increases over a run, but a tiny
 * network can learn that relationship. Chromosome = flat weights+biases vector, evolved by the
 * generic GA engine exactly like the maze's Direction[] genomes, just a different genome type.
 */
export const NN_INPUTS = 5;
export const NN_HIDDEN = 8;
export const NN_OUTPUTS = 2; // [jumpSignal, duckSignal]
export const GENOME_LENGTH = NN_INPUTS * NN_HIDDEN + NN_HIDDEN + NN_HIDDEN * NN_OUTPUTS + NN_OUTPUTS;

const MAX_DISTANCE = 14;
const MAX_WIDTH = 1.0;
const MAX_HEIGHT = 1.6;
const MAX_SPEED_NORM = 14;

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Normalized [distance, width, height, isBird, speed] for the nearest obstacle still ahead of the goose. */
export function extractInputs(state: GooseRunState): number[] {
  const ahead = state.obstacles.filter((o) => o.x + o.width / 2 >= GOOSE_X).sort((a, b) => a.x - b.x)[0];

  if (!ahead) {
    return [1, 0, 0, 0, state.speed / MAX_SPEED_NORM];
  }

  return [
    Math.max(0, Math.min(1, ahead.x / MAX_DISTANCE)),
    Math.min(1, ahead.width / MAX_WIDTH),
    Math.min(1, ahead.height / MAX_HEIGHT),
    ahead.type === "bird" ? 1 : 0,
    state.speed / MAX_SPEED_NORM,
  ];
}

/** One hidden layer, sigmoid activations, both outputs thresholded at 0.5 - jump takes priority
 *  over duck if both fire (jumping is the "safer" universal response between the two). */
export function decide(genome: Float64Array, inputs: number[]): GooseAction {
  let cursor = 0;
  const w1 = genome.subarray(cursor, (cursor += NN_INPUTS * NN_HIDDEN));
  const b1 = genome.subarray(cursor, (cursor += NN_HIDDEN));
  const w2 = genome.subarray(cursor, (cursor += NN_HIDDEN * NN_OUTPUTS));
  const b2 = genome.subarray(cursor, (cursor += NN_OUTPUTS));

  const hidden = new Array<number>(NN_HIDDEN);
  for (let h = 0; h < NN_HIDDEN; h++) {
    let sum = b1[h];
    for (let i = 0; i < NN_INPUTS; i++) sum += inputs[i] * w1[h * NN_INPUTS + i];
    hidden[h] = sigmoid(sum);
  }

  const outputs = new Array<number>(NN_OUTPUTS);
  for (let o = 0; o < NN_OUTPUTS; o++) {
    let sum = b2[o];
    for (let h = 0; h < NN_HIDDEN; h++) sum += hidden[h] * w2[o * NN_HIDDEN + h];
    outputs[o] = sigmoid(sum);
  }

  if (outputs[0] > 0.5) return "jump";
  if (outputs[1] > 0.5) return "duck";
  return "none";
}
