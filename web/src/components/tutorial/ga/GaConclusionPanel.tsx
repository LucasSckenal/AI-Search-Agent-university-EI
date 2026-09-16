"use client";

import { Icon } from "@/components/shared/Panel";
import { ConfigPresetPicker } from "@/components/tutorial/ga/ConfigPresetPicker";
import { GA_PRESETS, GaPreset } from "@/lib/tutorial/ga-presets";

export function GaConclusionPanel({ chosenId, onChooseAnother }: { chosenId: string; onChooseAnother: (id: string) => void }) {
  const chosen = GA_PRESETS.find((p) => p.id === chosenId) as GaPreset;
  const items = [
    `Previu qual configuração convergiria primeiro antes de rodar, e comparou com o resultado real de "${chosen?.label ?? chosenId}".`,
    "Viu, geração a geração, por que o fitness melhorou, estagnou ou ficou mais uniforme.",
    "Comparou 4 configurações de parâmetros reais - a mesma seed, um parâmetro diferente por vez.",
    "Ajustou população, mutação, cruzamento e elite para resolver um desafio com orçamento apertado de gerações.",
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
        <p className="mb-2 text-[12px] font-medium text-on-surface-variant">Continue com outra configuração:</p>
        <ConfigPresetPicker presets={GA_PRESETS.filter((p) => p.id !== chosenId)} value={null} onChange={onChooseAnother} />
      </div>
    </div>
  );
}
