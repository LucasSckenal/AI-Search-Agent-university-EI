import { AlgorithmId, SearchResult } from "./search";
import { effectiveBranchingFactor } from "./metrics";

export interface Stat {
  mean: number;
  std: number;
  min: number;
  max: number;
}

function summarize(values: number[]): Stat | null {
  if (values.length === 0) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean, std: Math.sqrt(variance), min: Math.min(...values), max: Math.max(...values) };
}

export interface AlgorithmBatchSummary {
  algorithm: AlgorithmId;
  trials: number;
  successes: number;
  successRate: number;
  cost: Stat | null;
  nodesExpanded: Stat | null;
  nodesGenerated: Stat | null;
  effectiveBranching: Stat | null;
  timeMs: Stat | null;
}

/**
 * Aggregates one algorithm's SearchResult across N independent problem instances into
 * mean/std/min/max per metric - a single random instance is anecdotal (a different maze/scramble
 * could easily flip which algorithm "looks better"), so this is what actually backs a claim like
 * "A* expands fewer nodes than BFS" with more than one data point.
 */
export function summarizeBatch<S, A>(algorithm: AlgorithmId, results: SearchResult<S, A>[]): AlgorithmBatchSummary {
  const successes = results.filter((r) => r.found);
  return {
    algorithm,
    trials: results.length,
    successes: successes.length,
    successRate: results.length > 0 ? successes.length / results.length : 0,
    cost: summarize(successes.map((r) => r.cost)),
    nodesExpanded: summarize(results.map((r) => r.nodesExpanded)),
    nodesGenerated: summarize(results.map((r) => r.nodesGenerated)),
    effectiveBranching: summarize(
      successes
        .map((r) => effectiveBranchingFactor(r.nodesGenerated, r.actions.length))
        .filter((b): b is number => b !== null)
    ),
    timeMs: summarize(results.map((r) => r.timeMs)),
  };
}
