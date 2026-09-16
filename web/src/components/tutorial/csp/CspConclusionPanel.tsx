"use client";

import { Icon } from "@/components/shared/Panel";
import { CspPresetPicker } from "@/components/tutorial/csp/CspPresetPicker";
import { CSP_PRESETS, CspPreset } from "@/lib/tutorial/csp-presets";

export function CspConclusionPanel({ chosenId, onChooseAnother }: { chosenId: string; onChooseAnother: (id: string) => void }) {
  const chosen = CSP_PRESETS.find((p) => p.id === chosenId) as CspPreset;
  const items = [
    `Previu qual técnica precisaria de menos retrocessos em "${chosen?.label ?? chosenId}" antes de rodar, e comparou com o resultado real.`,
    "Viu, passo a passo, como cada coluna recebe uma rainha e por que o algoritmo retrocede quando nenhuma linha resta.",
    "Acompanhou como o Forward Checking elimina candidatos das colunas seguintes assim que uma rainha é colocada.",
    "Comparou backtracking puro com Forward Checking em tabuleiros cada vez maiores, e viu a economia de nós crescer junto com N.",
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
        <p className="mb-2 text-[12px] font-medium text-on-surface-variant">Continue com outro tamanho:</p>
        <CspPresetPicker presets={CSP_PRESETS.filter((p) => p.id !== chosenId)} value={null} onChange={onChooseAnother} />
      </div>
    </div>
  );
}
