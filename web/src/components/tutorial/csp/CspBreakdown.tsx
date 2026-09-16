"use client";

import { CSSProperties } from "react";

/** The building blocks of a CSP - the N-Queens equivalent of FormulaBreakdown's g+h=f pieces,
 *  OperatorBreakdown's GA operators, and MinimaxBreakdown's MAX/MIN/α/β pieces. Reuses the same
 *  `.lab-formula-piece` visual language since the shape - "a labeled quantity you can click to
 *  highlight" - is identical. */
export function CspBreakdown({ useForwardChecking }: { useForwardChecking: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#afc6ff" } as CSSProperties}>
          <span className="lab-formula-piece-label">Variável</span>
          <span className="lab-formula-piece-value">coluna</span>
        </div>
        <p className="lab-formula-explain">Cada coluna do tabuleiro é uma variável que precisa receber exatamente um valor: a linha onde sua rainha fica.</p>
      </div>
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#7ee0a8" } as CSSProperties}>
          <span className="lab-formula-piece-label">Domínio</span>
          <span className="lab-formula-piece-value">linhas candidatas</span>
        </div>
        <p className="lab-formula-explain">O conjunto de linhas ainda possíveis para uma coluna - no início, todas; conforme rainhas são colocadas, esse conjunto encolhe.</p>
      </div>
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#ff9b9b" } as CSSProperties}>
          <span className="lab-formula-piece-label">Restrição</span>
          <span className="lab-formula-piece-value">mesma linha ou diagonal</span>
        </div>
        <p className="lab-formula-explain">Duas rainhas não podem compartilhar linha nem diagonal (a estrutura de colunas já garante que nunca compartilham coluna).</p>
      </div>
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#ffb77b" } as CSSProperties}>
          <span className="lab-formula-piece-label">Forward Checking</span>
          <span className="lab-formula-piece-value">poda antecipada</span>
        </div>
        <p className="lab-formula-explain">
          {useForwardChecking
            ? "Ligado: a cada rainha colocada, as linhas que ela invalida são removidas na hora dos domínios das colunas seguintes - se alguma ficar sem nenhuma candidata, o ramo é abandonado ali mesmo, sem tentar preenchê-la."
            : "Desligado: as restrições só são testadas no momento de tentar uma linha - um beco sem saída só é descoberto quando o algoritmo chega até ele, coluna por coluna."}
        </p>
      </div>
    </div>
  );
}
