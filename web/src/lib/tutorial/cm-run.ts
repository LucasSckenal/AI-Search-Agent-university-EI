import { Instance, MinesweeperStep, logicaSteps, probabilidadeSteps } from "@/lib/campo-minado/model";

export interface CmRun {
  logica: MinesweeperStep[];
  probabilidade: MinesweeperStep[];
}

/** Runs both real solvers on the same opening - the one place every tutorial step that needs a
 *  full comparison (prediction, simulation, inspection, comparison, challenge) goes through, so
 *  none of them duplicate the two calls. */
export function runCmComparison(instance: Instance, revealed: boolean[], flagged: boolean[]): CmRun {
  return {
    logica: logicaSteps(instance, revealed, flagged),
    probabilidade: probabilidadeSteps(instance, revealed, flagged),
  };
}

/** Sparse per-cell probability array (probabilidade-mode steps only) as a Map, the shape
 *  MinesweeperGrid's `probabilities` prop expects - same conversion the live /campo-minado page
 *  does with its own mapFromSparse helper. */
export function mapFromSparse(sparse: (number | null)[]): Map<number, number> {
  const map = new Map<number, number>();
  sparse.forEach((v, i) => {
    if (v !== null) map.set(i, v);
  });
  return map;
}
