"use client";

import { CSSProperties } from "react";

/** The building blocks of the solver - same `.lab-formula-piece` visual language as the other four
 *  labs' breakdowns. The last piece varies with `useProbability`, the same shape as CspBreakdown's
 *  `useForwardChecking` prop. */
export function CmBreakdown({ useProbability }: { useProbability: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#afc6ff" } as CSSProperties}>
          <span className="lab-formula-piece-label">Restrição</span>
          <span className="lab-formula-piece-value">número da célula = minas nas vizinhas ocultas</span>
        </div>
        <p className="lab-formula-explain">Cada célula revelada com um número é uma restrição: exatamente esse tanto de minas está entre suas vizinhas ainda ocultas (descontando as já marcadas com bandeira).</p>
      </div>
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#7ee0a8" } as CSSProperties}>
          <span className="lab-formula-piece-label">Regra do ponto único</span>
          <span className="lab-formula-piece-value">necessidade = vizinhas ocultas → todas minas ou todas seguras</span>
        </div>
        <p className="lab-formula-explain">Se uma célula precisa de N minas e tem exatamente N vizinhas ocultas, todas são minas. Se já tem N bandeiras e ainda sobram vizinhas ocultas, essas sobras são seguras.</p>
      </div>
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#ff9b9b" } as CSSProperties}>
          <span className="lab-formula-piece-label">Regra do subconjunto</span>
          <span className="lab-formula-piece-value">diferença entre duas restrições</span>
        </div>
        <p className="lab-formula-explain">Quando as vizinhas ocultas de uma célula A estão totalmente contidas nas de uma célula B, a diferença entre os dois conjuntos revela quantas minas exatamente ela contém - às vezes 0 (seguras), às vezes todas.</p>
      </div>
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#ffb77b" } as CSSProperties}>
          <span className="lab-formula-piece-label">Componente da fronteira</span>
          <span className="lab-formula-piece-value">grupos de células conectadas por restrições compartilhadas</span>
        </div>
        <p className="lab-formula-explain">As células ocultas adjacentes a algum número são particionadas em grupos independentes - duas células só se conectam se aparecem juntas na mesma restrição. Cada grupo pode ser resolvido separadamente.</p>
      </div>
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#cebdff" } as CSSProperties}>
          <span className="lab-formula-piece-label">Inferência probabilística</span>
          <span className="lab-formula-piece-value">enumeração exata + combinatória sobre as minas restantes</span>
        </div>
        <p className="lab-formula-explain">
          {useProbability
            ? "Quando as duas regras acima não decidem mais nada, cada componente é enumerado por busca exaustiva (toda atribuição de minas consistente com suas restrições), e o resultado é pesado pelo número de formas de distribuir o resto das minas entre as células livres do tabuleiro inteiro - uma probabilidade exata, não uma estimativa. O palpite escolhido é sempre a célula de menor probabilidade."
            : "Desligada: quando as duas regras acima não decidem mais nada, a dedução simplesmente para - mesmo que ainda exista informação suficiente (a contagem total de minas restantes) para calcular um risco exato em vez de travar."}
        </p>
      </div>
    </div>
  );
}
