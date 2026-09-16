"use client";

import { Icon } from "@/components/shared/Panel";
import { PositionPicker } from "@/components/tutorial/am/PositionPicker";
import { AM_PRESETS, AmPreset } from "@/lib/tutorial/am-presets";

export function AmConclusionPanel({ chosenId, onChooseAnother }: { chosenId: string; onChooseAnother: (id: string) => void }) {
  const chosen = AM_PRESETS.find((p) => p.id === chosenId) as AmPreset;
  const items = [
    `Previu qual jogada o minimax escolheria na posição "${chosen?.label ?? chosenId}" antes de rodar, e comparou com o resultado real.`,
    "Viu, nó a nó, como os valores de vitória, derrota e empate sobem da folha até a raiz, e onde exatamente a poda Alfa-Beta corta ramos inteiros.",
    "Acompanhou a sequência real de jogadas que o minimax escolheria se os dois lados jogassem de forma ótima a partir daqui.",
    "Comparou minimax puro com poda Alfa-Beta em posições cada vez maiores, e viu a economia de nós crescer junto com a árvore.",
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
        <p className="mb-2 text-[12px] font-medium text-on-surface-variant">Continue com outra posição:</p>
        <PositionPicker presets={AM_PRESETS.filter((p) => p.id !== chosenId)} value={null} onChange={onChooseAnother} />
      </div>
    </div>
  );
}
