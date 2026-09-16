"use client";

import { useMemo, useState } from "react";
import { AlgorithmPicker } from "@/components/tutorial/AlgorithmPicker";
import { RealSimulationStage } from "@/components/tutorial/RealSimulationStage";
import { buildChallengeMaze } from "@/lib/tutorial/challenge-maze";
import { explainChallengeChoice } from "@/lib/tutorial/explain";
import { Direction } from "@/lib/maze/model";
import { AlgorithmId, SearchResult } from "@/lib/core/search";

/**
 * Final challenge: a hand-curated maze (see lib/tutorial/challenge-maze.ts) with a short, costly
 * mud shortcut against a longer, cheap detour - real disagreement between step-counting and
 * cost-aware algorithms, confirmed by running search() on it (see the module comment there).
 */
export function ChallengeStage() {
  const maze = useMemo(() => buildChallengeMaze(), []);
  const [algorithm, setAlgorithm] = useState<AlgorithmId>("bfs");
  const [result, setResult] = useState<SearchResult<number, Direction> | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12.5px] leading-relaxed text-on-surface-variant">
        Este labirinto tem dois jeitos de atravessar: um atalho direto pela lama (poucos passos, mas cada célula de lama custa
        5×) e um desvio bem mais longo, mas inteiramente por células baratas. Escolha um algoritmo, execute, e veja qual
        caminho ele realmente escolhe.
      </p>
      <AlgorithmPicker
        value={algorithm}
        onChange={(a) => {
          setAlgorithm(a);
          setResult(null);
        }}
      />
      <RealSimulationStage maze={maze} algorithm={algorithm} heuristic="manhattan" allowDiagonal={false} onResult={setResult} />
      {result && (
        <div className="glass rounded-2xl p-4 text-[13px] leading-relaxed text-on-surface">{explainChallengeChoice(algorithm, result)}</div>
      )}
    </div>
  );
}
