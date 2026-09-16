import { seededRng } from "@/lib/core/rng";

/**
 * A Hopfield network (1982): associative memory built by Hebbian learning - a single pass over the
 * stored patterns, no epochs, no gradient at all. Recall is asynchronous energy minimization: pick
 * one unit at random, flip it toward what its neighbors "vote" for, repeat - and a classical result
 * (Cohen & Grossberg / Hopfield's own proof) guarantees the network's energy never increases under
 * this rule, so it always settles into a stable state. Storing too many patterns at once collides
 * with that same mechanism - the interference between patterns overwhelms it and recall degrades
 * into a spurious state, this network's own version of the Minsky-Papert limit the Perceptron shows.
 */

export const GRID = 10;
export const N = GRID * GRID;

export interface StoredPattern {
  id: string;
  label: string;
  values: number[]; // length N, each -1 or +1
}

function parsePattern(rows: string[]): number[] {
  const values: number[] = [];
  for (const row of rows) {
    for (const ch of row) values.push(ch === "#" ? 1 : -1);
  }
  return values;
}

export const PATTERN_LIBRARY: StoredPattern[] = [
  {
    id: "cruz",
    label: "Cruz",
    values: parsePattern([
      "....##....",
      "....##....",
      "....##....",
      "....##....",
      "##########",
      "##########",
      "....##....",
      "....##....",
      "....##....",
      "....##....",
    ].map((r) => r.slice(0, GRID))),
  },
  {
    id: "x",
    label: "X",
    values: parsePattern([
      "##......##",
      "##......##",
      "..##..##..",
      "..##..##..",
      "....##....",
      "....##....",
      "..##..##..",
      "..##..##..",
      "##......##",
      "##......##",
    ].map((r) => r.slice(0, GRID))),
  },
  {
    id: "quadrado",
    label: "Quadrado",
    values: parsePattern([
      "##########",
      "##########",
      "##......##",
      "##......##",
      "##......##",
      "##......##",
      "##......##",
      "##......##",
      "##########",
      "##########",
    ]),
  },
  {
    id: "diamante",
    label: "Diamante",
    values: parsePattern([
      "....##....",
      "...####...",
      "..######..",
      ".########.",
      "##########",
      "##########",
      ".########.",
      "..######..",
      "...####...",
      "....##....",
    ]),
  },
  {
    id: "seta",
    label: "Seta",
    values: parsePattern([
      "....##....",
      "...####...",
      "..######..",
      ".########.",
      "....##....",
      "....##....",
      "....##....",
      "....##....",
      "....##....",
      "....##....",
    ]),
  },
  {
    id: "coracao",
    label: "Coração",
    values: parsePattern([
      ".##....##.",
      "####..####",
      "##########",
      "##########",
      ".########.",
      "..######..",
      "...####...",
      "....##....",
      "....##....",
      "..........",
    ]),
  },
];

/** Hebbian learning: one pass over the stored patterns, W_ij = (1/N) * sum_p pattern_p[i]*pattern_p[j],
 *  diagonal zeroed so a unit never "votes" on itself. */
export function buildWeights(patterns: number[][]): number[][] {
  const W: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  for (const p of patterns) {
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (i === j) continue;
        W[i][j] += (p[i] * p[j]) / N;
      }
    }
  }
  return W;
}

export function energy(W: number[][], state: number[]): number {
  let e = 0;
  for (let i = 0; i < N; i++) {
    let sum = 0;
    for (let j = 0; j < N; j++) sum += W[i][j] * state[j];
    e += sum * state[i];
  }
  return -0.5 * e;
}

/** Flips a random `fraction` of bits - the corrupted starting point recall has to climb back out of. */
export function corrupt(pattern: number[], fraction: number, seed: number): number[] {
  const rng = seededRng(seed);
  const result = [...pattern];
  const flipCount = Math.round(fraction * N);
  const indices = shuffledIndices(N, rng);
  for (let k = 0; k < flipCount; k++) result[indices[k]] *= -1;
  return result;
}

function shuffledIndices(count: number, rng: () => number): number[] {
  const arr = Array.from({ length: count }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Fraction of matching bits between two states, in [0, 1] - 1 means identical. */
export function overlap(a: number[], b: number[]): number {
  let matches = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) matches++;
  return matches / a.length;
}

export interface RecallStep {
  step: number;
  state: number[];
  changedIndex: number | null;
  energy: number;
}

export interface RecallResult {
  finalState: number[];
  steps: number;
  converged: boolean;
}

const MAX_SWEEPS = 12;

/** Asynchronous recall: one randomly-chosen unit updates per step, yielding after every single
 *  visit (changed or not) so playback shows the real, uneven pace of convergence - most units settle
 *  immediately, a shrinking few keep flipping until the whole sweep passes with zero changes. */
export function* recall(W: number[][], initialState: number[], seed: number): Generator<RecallStep, RecallResult, void> {
  const rng = seededRng(seed);
  const state = [...initialState];
  let step = 0;
  yield { step, state: [...state], changedIndex: null, energy: energy(W, state) };

  for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
    const order = shuffledIndices(N, rng);
    let anyChange = false;
    for (const i of order) {
      step++;
      let sum = 0;
      for (let j = 0; j < N; j++) sum += W[i][j] * state[j];
      const next = sum >= 0 ? 1 : -1;
      const changed = next !== state[i];
      if (changed) {
        state[i] = next;
        anyChange = true;
      }
      yield { step, state: [...state], changedIndex: changed ? i : null, energy: energy(W, state) };
    }
    if (!anyChange) return { finalState: state, steps: step, converged: true };
  }
  return { finalState: state, steps: step, converged: false };
}
