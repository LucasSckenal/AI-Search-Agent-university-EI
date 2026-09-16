"use client";

import { CSSProperties } from "react";
import { AlgorithmId } from "@/lib/core/search";

const fmt = (n: number | undefined): string => (n === undefined ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1));

function Piece({
  id,
  label,
  value,
  accent,
  active,
  onSelect,
}: {
  id: "g" | "h" | "f";
  label: string;
  value: number | undefined;
  accent: string;
  active: boolean;
  onSelect?: (piece: "g" | "h" | "f") => void;
}) {
  return (
    <button
      type="button"
      disabled={!onSelect}
      className={`lab-formula-piece ${active ? "active" : ""}`}
      style={{ "--accent": accent } as CSSProperties}
      onClick={onSelect ? () => onSelect(id) : undefined}
    >
      <span className="lab-formula-piece-label">{label}</span>
      <span className="lab-formula-piece-value">{fmt(value)}</span>
    </button>
  );
}

/**
 * Per-algorithm visual of what actually drives node selection - A* shows g+h=f with each piece
 * clickable to highlight it, Gulosa/UCS show their single driving number, BFS/DFS show their
 * queue discipline instead (they don't rank by a number at all). When `g`/`h`/`f` are omitted this
 * renders the conceptual shape with placeholder dashes (step 02); passing real values from a
 * `TraceStep` (step 06) turns the same component into a live readout.
 */
export function FormulaBreakdown({
  algorithm,
  g,
  h,
  f,
  activePiece,
  onSelectPiece,
}: {
  algorithm: AlgorithmId;
  g?: number;
  h?: number;
  f?: number;
  activePiece?: "g" | "h" | "f" | null;
  onSelectPiece?: (piece: "g" | "h" | "f") => void;
}) {
  if (algorithm === "bfs") {
    return (
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#afc6ff" } as CSSProperties}>
          <span className="lab-formula-piece-label">Fila FIFO</span>
          <span className="lab-formula-piece-value" style={{ fontSize: 13 }}>
            entra→sai
          </span>
        </div>
        <p className="lab-formula-explain">
          Sem número nenhum guiando a escolha: o próximo nó expandido é sempre o primeiro que entrou na fila e ainda não saiu.
        </p>
      </div>
    );
  }

  if (algorithm === "dfs") {
    return (
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#cebdff" } as CSSProperties}>
          <span className="lab-formula-piece-label">Pilha LIFO</span>
          <span className="lab-formula-piece-value" style={{ fontSize: 13 }}>
            topo→base
          </span>
        </div>
        <p className="lab-formula-explain">
          Também sem número: o próximo nó expandido é sempre o último que foi empilhado (o topo da pilha).
        </p>
      </div>
    );
  }

  if (algorithm === "ucs") {
    return (
      <div className="lab-formula">
        <Piece id="g" label="g(n) custo percorrido" value={g} accent="#ffb77b" active={activePiece === "g"} onSelect={onSelectPiece} />
        <p className="lab-formula-explain">Menor g(n) na fronteira vence — o custo já percorrido, sem olhar para o objetivo.</p>
      </div>
    );
  }

  if (algorithm === "greedy") {
    return (
      <div className="lab-formula">
        <Piece id="h" label="h(n) estimativa" value={h} accent="#7ee0a8" active={activePiece === "h"} onSelect={onSelectPiece} />
        <p className="lab-formula-explain">Menor h(n) na fronteira vence — a estimativa até o objetivo, sem olhar para o custo já percorrido.</p>
      </div>
    );
  }

  // astar
  return (
    <div className="lab-formula">
      <Piece id="g" label="g(n) percorrido" value={g} accent="#afc6ff" active={activePiece === "g"} onSelect={onSelectPiece} />
      <span className="lab-formula-op">+</span>
      <Piece id="h" label="h(n) estimativa" value={h} accent="#7ee0a8" active={activePiece === "h"} onSelect={onSelectPiece} />
      <span className="lab-formula-op">=</span>
      <Piece id="f" label="f(n) total" value={f} accent="#ff9b9b" active={activePiece === "f"} onSelect={onSelectPiece} />
      <p className="lab-formula-explain">Menor f(n) na fronteira vence — soma do custo já percorrido com a estimativa até o objetivo.</p>
    </div>
  );
}
