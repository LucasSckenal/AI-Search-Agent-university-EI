"use client";

import { useState } from "react";
import { Field } from "@/components/shared/Panel";
import { RlPresetPicker } from "@/components/tutorial/rl/RlPresetPicker";
import { RealSimulationStage } from "@/components/tutorial/rl/RealSimulationStage";
import { RL_PRESETS } from "@/lib/tutorial/rl-presets";
import { RlRun } from "@/lib/tutorial/rl-run";
import { explainChallengeResult } from "@/lib/tutorial/rl-explain";

/** Episode-budget challenge: same real training run, but the user picks how many episodes to spend
 *  and can watch the gap versus Value Iteration close (or not) as they raise the budget - the RL
 *  analog of GaChallengeStage's parameter sliders, except here the "parameter" IS the thing steps
 *  04/07 already established as the source of the whole lesson's gap. */
export function RlChallengeStage() {
  const [presetId, setPresetId] = useState(RL_PRESETS[RL_PRESETS.length - 1].id);
  const [episodes, setEpisodes] = useState(20);
  const [run, setRun] = useState<RlRun | null>(null);

  const preset = RL_PRESETS.find((p) => p.id === presetId) ?? RL_PRESETS[0];

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[65ch] text-[12.5px] leading-relaxed text-on-surface-variant">
        Escolha um mapa e um orçamento de episódios, execute, e veja se o Q-learning consegue alcançar a recompensa ótima da Iteração de Valor antes
        de ε cair demais.
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <RlPresetPicker presets={RL_PRESETS} value={presetId} onChange={setPresetId} />
        <Field label={`Episódios: ${episodes}`}>
          <input type="range" min={10} max={400} step={10} value={episodes} onChange={(e) => setEpisodes(Number(e.target.value))} className="w-48" />
        </Field>
      </div>

      <RealSimulationStage preset={preset} episodes={episodes} onResult={setRun} />
      {run && (
        <div className="glass rounded-2xl p-4 text-[13px] leading-relaxed text-on-surface">
          {explainChallengeResult(run.qRollout, run.viRollout, episodes)}
        </div>
      )}
    </div>
  );
}
