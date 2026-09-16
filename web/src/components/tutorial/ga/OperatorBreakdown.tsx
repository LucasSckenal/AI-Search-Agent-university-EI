"use client";

import { CSSProperties } from "react";

/**
 * The four operators that turn one generation into the next - the GA equivalent of
 * FormulaBreakdown's g+h=f pieces. Reuses the same `.lab-formula-piece` visual language (clickable
 * labeled box) since the shape - "a labeled quantity you can click to highlight" - is identical.
 */
export function OperatorBreakdown({
  eliteCount,
  populationSize,
  mutationRate,
  tournamentSize,
}: {
  eliteCount?: number;
  populationSize?: number;
  mutationRate?: number;
  tournamentSize?: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#7ee0a8" } as CSSProperties}>
          <span className="lab-formula-piece-label">Elitismo</span>
          <span className="lab-formula-piece-value">{eliteCount ?? "—"}</span>
        </div>
        <p className="lab-formula-explain">
          {eliteCount !== undefined ? `Os ${eliteCount} melhores genomas` : "Os melhores genomas"} de cada geração passam direto para a próxima, sem
          nenhuma alteração - o melhor já encontrado nunca é perdido.
        </p>
      </div>
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#afc6ff" } as CSSProperties}>
          <span className="lab-formula-piece-label">Seleção por torneio</span>
          <span className="lab-formula-piece-value">{tournamentSize ?? "—"}</span>
        </div>
        <p className="lab-formula-explain">
          Para escolher um pai, {tournamentSize !== undefined ? tournamentSize : "alguns"} genomas são sorteados da população e o de maior fitness entre
          eles vence - mais apto tem mais chance de ser pai, mas não é garantido.
        </p>
      </div>
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#cebdff" } as CSSProperties}>
          <span className="lab-formula-piece-label">Cruzamento</span>
          <span className="lab-formula-piece-value" style={{ fontSize: 13 }}>
            2 pais → 1 filho
          </span>
        </div>
        <p className="lab-formula-explain">
          Um ponto de corte divide o genoma de dois pais; o filho herda o início de um e o fim do outro - combinando duas soluções parciais boas numa
          terceira.
        </p>
      </div>
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#ffb77b" } as CSSProperties}>
          <span className="lab-formula-piece-label">Mutação</span>
          <span className="lab-formula-piece-value">{mutationRate !== undefined ? `${(mutationRate * 100).toFixed(0)}%` : "—"}</span>
        </div>
        <p className="lab-formula-explain">
          Cada gene do filho tem essa chance de virar um valor aleatório novo - a única fonte de variação que a população não tinha antes, essencial
          para não ficar presa num ótimo local.
          {populationSize !== undefined && ` A população inteira tem ${populationSize} genomas competindo a cada geração.`}
        </p>
      </div>
    </div>
  );
}
