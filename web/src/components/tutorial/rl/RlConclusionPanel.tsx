"use client";

import { Icon } from "@/components/shared/Panel";
import { RlPresetPicker } from "@/components/tutorial/rl/RlPresetPicker";
import { RL_PRESETS, RlPreset } from "@/lib/tutorial/rl-presets";

export function RlConclusionPanel({ chosenId, onChooseAnother }: { chosenId: string; onChooseAnother: (id: string) => void }) {
  const chosen = RL_PRESETS.find((p) => p.id === chosenId) as RlPreset;
  const items = [
    `Previu se o Q-learning empataria, chegaria pior ou falharia frente à Iteração de Valor em "${chosen?.label ?? chosenId}", e comparou com o resultado real.`,
    "Viu, episódio a episódio, como a política gulosa aprendida evolui enquanto ε decai de exploração para exploração do que já foi aprendido.",
    "Comparou a mesma tarefa com orçamentos de treino diferentes, e viu a recompensa alcançada se aproximar (ou não) do ótimo garantido pela Iteração de Valor.",
    "Ajustou o próprio orçamento de episódios no desafio, e descobriu na prática quanta experiência esse mapa específico realmente precisa.",
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        {items.map((text) => (
          <div key={text} className="lab-checklist-item">
            <span className="lab-checklist-check">
              <Icon name="check" className="text-[13px]" />
            </span>
            {text}
          </div>
        ))}
      </div>
      <div>
        <p className="mb-2 text-[12px] font-medium text-on-surface-variant">Continue com outro mapa:</p>
        <RlPresetPicker presets={RL_PRESETS.filter((p) => p.id !== chosenId)} value={null} onChange={onChooseAnother} />
      </div>
    </div>
  );
}
