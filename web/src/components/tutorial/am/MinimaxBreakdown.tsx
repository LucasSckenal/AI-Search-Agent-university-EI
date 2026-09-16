"use client";

import { CSSProperties } from "react";

/** The four quantities that decide how the search moves - the adversarial-search equivalent of
 *  FormulaBreakdown's g+h=f pieces and OperatorBreakdown's GA operators. Reuses the same
 *  `.lab-formula-piece` visual language since the shape - "a labeled quantity you can click to
 *  highlight" - is identical. */
export function MinimaxBreakdown({ useAlphaBeta }: { useAlphaBeta: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#7ea8f5" } as CSSProperties}>
          <span className="lab-formula-piece-label">MAX (X)</span>
          <span className="lab-formula-piece-value">maior valor</span>
        </div>
        <p className="lab-formula-explain">Entre os filhos disponíveis, X sempre escolhe o de maior valor - supõe que X está jogando para vencer.</p>
      </div>
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#ff6bd6" } as CSSProperties}>
          <span className="lab-formula-piece-label">MIN (O)</span>
          <span className="lab-formula-piece-value">menor valor</span>
        </div>
        <p className="lab-formula-explain">
          Na vez de O, o papel se inverte: entre os filhos, O escolhe o de menor valor - supõe que O também está jogando para vencer, não para ajudar X.
        </p>
      </div>
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#7ee0a8" } as CSSProperties}>
          <span className="lab-formula-piece-label">α (alfa)</span>
          <span className="lab-formula-piece-value">melhor garantia de MAX</span>
        </div>
        <p className="lab-formula-explain">O maior valor que MAX já garantiu conseguir em algum lugar da árvore até agora, considerando só o caminho percorrido.</p>
      </div>
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#ffb77b" } as CSSProperties}>
          <span className="lab-formula-piece-label">β (beta)</span>
          <span className="lab-formula-piece-value">melhor garantia de MIN</span>
        </div>
        <p className="lab-formula-explain">
          O menor valor que MIN já garantiu conseguir.{" "}
          {useAlphaBeta
            ? "Assim que α ≥ β, o ramo restante é podado - nenhum valor ali poderia mudar a decisão de quem escolheu por último."
            : "Com a poda desligada, nenhum ramo é cortado: cada folha da árvore é visitada, mesmo as que não poderiam mudar o resultado."}
        </p>
      </div>
    </div>
  );
}
