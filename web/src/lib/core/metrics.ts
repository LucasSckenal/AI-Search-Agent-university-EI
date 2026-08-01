/**
 * Effective branching factor b* (Russell & Norvig, "Artificial Intelligence: A Modern Approach",
 * eq. 3.14): the branching factor a *uniform* tree of depth `depth` would need in order to contain
 * exactly `nodesGenerated` nodes. It's the standard way to quantify "how much did the heuristic
 * actually prune the search" as a single number - b* close to 1 means the search was nearly a
 * straight line to the goal (a great heuristic); b* close to the problem's true branching factor
 * means the heuristic barely helped at all.
 *
 * Solves 1 + b + b^2 + ... + b^depth = nodesGenerated + 1 for b > 1 via bisection (the left side is
 * strictly increasing in b for b > 1, so bisection converges reliably without needing calculus).
 */
export function effectiveBranchingFactor(nodesGenerated: number, depth: number): number | null {
  if (depth <= 0 || nodesGenerated <= 1) return null;

  const target = nodesGenerated + 1;
  const sumAtB = (b: number): number => {
    let sum = 0;
    let term = 1;
    for (let i = 0; i <= depth; i++) {
      sum += term;
      term *= b;
    }
    return sum;
  };

  let lo = 1;
  let hi = 2;
  while (sumAtB(hi) < target) hi *= 2;

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (sumAtB(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
