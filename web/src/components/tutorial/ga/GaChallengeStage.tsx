"use client";

import { useMemo, useState } from "react";
import { Field } from "@/components/shared/Panel";
import { RealSimulationStage } from "@/components/tutorial/ga/RealSimulationStage";
import { GaConfig, GaRunResult } from "@/lib/core/genetic";
import { Genome } from "@/lib/algoritmo-genetico/model";
import { GA_TUTORIAL_SEED } from "@/lib/tutorial/ga-presets";
import { CHALLENGE_MAX_GENERATIONS } from "@/lib/tutorial/ga-challenge";
import { explainChallengeResult, generationSolved } from "@/lib/tutorial/ga-explain";

/**
 * Parameter-tuning challenge: same explorer problem, but only CHALLENGE_MAX_GENERATIONS to work
 * with - generous defaults from earlier steps won't necessarily fit, so the user has to actually
 * reason about the knobs instead of leaning on presets. See lib/tutorial/ga-challenge.ts.
 */
export function GaChallengeStage() {
  const [populationSize, setPopulationSize] = useState(20);
  const [mutationRate, setMutationRate] = useState(0.15);
  const [crossoverRate, setCrossoverRate] = useState(0.7);
  const [eliteCount, setEliteCount] = useState(2);
  const [tournamentSize, setTournamentSize] = useState(3);
  const [result, setResult] = useState<GaRunResult<Genome> | null>(null);

  const config: GaConfig = useMemo(
    () => ({
      populationSize,
      generations: CHALLENGE_MAX_GENERATIONS,
      eliteCount,
      mutationRate,
      crossoverRate,
      tournamentSize,
      seed: GA_TUTORIAL_SEED,
    }),
    [populationSize, mutationRate, crossoverRate, eliteCount, tournamentSize]
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[65ch] text-[12.5px] leading-relaxed text-on-surface-variant">
        Desta vez só há {CHALLENGE_MAX_GENERATIONS} gerações de orçamento - os padrões generosos dos passos anteriores podem não caber. Ajuste os
        parâmetros, execute, e veja se a população chega perto do alvo a tempo.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label={`População: ${populationSize}`}>
          <input type="range" min={4} max={80} value={populationSize} onChange={(e) => setPopulationSize(Number(e.target.value))} />
        </Field>
        <Field label={`Mutação: ${(mutationRate * 100).toFixed(0)}%`}>
          <input type="range" min={0} max={1} step={0.01} value={mutationRate} onChange={(e) => setMutationRate(Number(e.target.value))} />
        </Field>
        <Field label={`Cruzamento: ${(crossoverRate * 100).toFixed(0)}%`}>
          <input type="range" min={0} max={1} step={0.01} value={crossoverRate} onChange={(e) => setCrossoverRate(Number(e.target.value))} />
        </Field>
        <Field label={`Elite: ${eliteCount}`}>
          <input type="range" min={0} max={10} value={eliteCount} onChange={(e) => setEliteCount(Number(e.target.value))} />
        </Field>
        <Field label={`Torneio: ${tournamentSize}`}>
          <input type="range" min={2} max={8} value={tournamentSize} onChange={(e) => setTournamentSize(Number(e.target.value))} />
        </Field>
      </div>

      <RealSimulationStage config={config} onResult={setResult} />
      {result && (
        <div className="glass rounded-2xl p-4 text-[13px] leading-relaxed text-on-surface">
          {explainChallengeResult(generationSolved(result), CHALLENGE_MAX_GENERATIONS)}
        </div>
      )}
    </div>
  );
}
