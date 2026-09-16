/**
 * The step-08 challenge is purely about parameter tuning, not a new problem instance: the same
 * explorer problem (lib/algoritmo-genetico/model.ts) but under a tight generation budget, forcing
 * the user to actually pick population/mutation/crossover that converges in time rather than
 * leaning on generous defaults. "Solved" is computed for real from the run (see
 * lib/tutorial/ga-explain.ts's generationSolved), never asserted.
 */
export const CHALLENGE_MAX_GENERATIONS = 10;
