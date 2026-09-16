"use client";

import { Icon } from "@/components/shared/Panel";
import { AlgorithmPicker } from "@/components/tutorial/AlgorithmPicker";
import { AlgorithmId, ALGORITHM_LABELS } from "@/lib/core/search";

const ALL: AlgorithmId[] = ["bfs", "dfs", "ucs", "greedy", "astar"];

export function ConclusionPanel({ algorithm, onChooseAnother }: { algorithm: AlgorithmId; onChooseAnother: (a: AlgorithmId) => void }) {
  const items = [
    `Previu um caminho antes de rodar e comparou com o que o ${ALGORITHM_LABELS[algorithm]} realmente escolheu.`,
    "Viu, nó a nó, o que o algoritmo realmente usa para decidir quem expandir a seguir.",
    `Comparou ${ALGORITHM_LABELS[algorithm]} contra os outros 4 algoritmos com números de uma execução real.`,
    "Testou um cenário onde o caminho mais curto e o caminho mais barato não são o mesmo.",
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
        <p className="mb-2 text-[12px] font-medium text-on-surface-variant">Continue com outro algoritmo:</p>
        <AlgorithmPicker value={null} onChange={onChooseAnother} options={ALL.filter((a) => a !== algorithm)} />
      </div>
    </div>
  );
}
