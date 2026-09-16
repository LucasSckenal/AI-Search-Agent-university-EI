import { evolve, GaConfig, GaRunResult } from "@/lib/core/genetic";
import { buildExplorerGaOps, Genome } from "@/lib/algoritmo-genetico/model";

/** Drains `evolve()` to completion for the explorer problem - the one place every tutorial step
 *  that needs a full real run (prediction candidates, comparison, challenge, simulation stage)
 *  goes through, so none of them duplicate the drain loop. `topK` defaults to 1 (cheaper) - pass
 *  `populationSize` when a caller needs every genome of every generation (RealSimulationStage's 3D
 *  population arena). */
export function runGaFull(config: GaConfig, topK = 1): GaRunResult<Genome> {
  const ops = buildExplorerGaOps();
  const gen = evolve({ ...config, topK }, ops);
  let next = gen.next();
  while (!next.done) next = gen.next();
  return next.value;
}
