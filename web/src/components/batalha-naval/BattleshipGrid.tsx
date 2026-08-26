"use client";

import { BOARD_SIZE, CellState, Placement, cellIndex } from "@/lib/batalha-naval/model";

export interface BattleshipGridProps {
  shots: CellState[];
  /**
   * Sempre passado (não é um "reveal" - o jogo nunca esconde onde os acertos caem). Usado só pra saber
   * se uma célula de acerto pertence a um navio já totalmente afundado, pra estilizar diferente de um
   * acerto ainda em aberto - a mesma informação que um Batalha Naval real anuncia ("afundou!").
   */
  ships: Placement[];
  /** Célula disparada mais recentemente - destaque de "splash". */
  lastShot?: number | null;
  /** Cursor de teclado, modo play. */
  focusedIndex?: number | null;
  /** Sombreamento de densidade, modo probabilistico. */
  heatmap?: number[] | null;
  /** Célula que o algoritmo ativo está prestes a disparar - crosshair pulsante. */
  bestIndex?: number | null;
  interactive?: boolean;
  onCellClick?: (index: number) => void;
  className?: string;
  overlay?: { title: string; subtitle: string } | null;
}

/**
 * Tabuleiro sempre 10x10 fixo (diferente do Campo Minado, que varia por dificuldade), então
 * grid-template-columns/rows e aspect-ratio vão direto no CSS - nada de inline style aqui.
 */
export function BattleshipGrid({ shots, ships, lastShot = null, focusedIndex = null, heatmap, bestIndex = null, interactive = false, onCellClick, className = "", overlay }: BattleshipGridProps) {
  const sunkCells = new Set(ships.filter((p) => p.cells.every((c) => shots[c] === "hit")).flatMap((p) => p.cells));
  const maxHeat = heatmap ? Math.max(1, ...heatmap) : 1;

  return (
    <div className={`battleship-grid ${className}`}>
      {Array.from({ length: BOARD_SIZE }, (_, r) =>
        Array.from({ length: BOARD_SIZE }, (_, c) => {
          const i = cellIndex(BOARD_SIZE, r, c);
          const state = shots[i];
          const heat = heatmap ? heatmap[i] : 0;

          let cls = "battleship-cell";
          if (state === "hit") cls += sunkCells.has(i) ? " battleship-cell-sunk" : " battleship-cell-hit";
          else if (state === "miss") cls += " battleship-cell-miss";
          else cls += " battleship-cell-hidden";
          if (lastShot === i) cls += " battleship-cell-lastshot";
          if (focusedIndex === i) cls += " battleship-cell-focused";
          if (bestIndex === i) cls += " battleship-crosshair";

          const style = heatmap && state === "unknown" ? ({ "--heat": heat / maxHeat } as React.CSSProperties) : undefined;

          return (
            <div key={i} className={cls} style={style} onClick={interactive && onCellClick ? () => onCellClick(i) : undefined}>
              {state === "hit" ? (
                <span className="material-symbols-outlined battleship-hit-icon">{sunkCells.has(i) ? "local_fire_department" : "close"}</span>
              ) : state === "miss" ? (
                <span className="battleship-miss-dot" />
              ) : heatmap && heat > 0 ? (
                <span className="battleship-heat-value">{heat}</span>
              ) : null}
            </div>
          );
        })
      )}
      {overlay && (
        <div className="board-overlay">
          <span className="board-overlay-title">{overlay.title}</span>
          <span className="board-overlay-subtitle">{overlay.subtitle}</span>
        </div>
      )}
    </div>
  );
}
