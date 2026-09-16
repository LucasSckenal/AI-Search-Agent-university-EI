"use client";

import { Icon } from "@/components/shared/Panel";
import { CmPresetPicker } from "@/components/tutorial/cm/CmPresetPicker";
import { CM_PRESETS, CmPreset } from "@/lib/tutorial/cm-presets";

export function CmConclusionPanel({ chosenId, onChooseAnother }: { chosenId: string; onChooseAnother: (id: string) => void }) {
  const chosen = CM_PRESETS.find((p) => p.id === chosenId) as CmPreset;
  const items = [
    `Previu o que aconteceria quando a lógica travasse em "${chosen?.label ?? chosenId}" - certeza disfarçada, risco calculado que acerta, ou risco que explode - e comparou com o resultado real.`,
    "Viu, passo a passo, como as regras de ponto único e subconjunto deduzem cada célula segura ou minada com certeza absoluta, e travam quando não sobra nenhuma dedução local.",
    "Acompanhou como a inferência probabilística particiona a fronteira em componentes e enumera exatamente toda atribuição de minas possível para calcular uma probabilidade exata, não uma estimativa.",
    "Comparou dedução lógica com inferência probabilística em tabuleiros cada vez maiores, e viu que a melhor decisão possível sob incerteza ainda pode, honestamente, dar errado.",
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
        <p className="mb-2 text-[12px] font-medium text-on-surface-variant">Continue com outro tabuleiro:</p>
        <CmPresetPicker presets={CM_PRESETS.filter((p) => p.id !== chosenId)} value={null} onChange={onChooseAnother} />
      </div>
    </div>
  );
}
