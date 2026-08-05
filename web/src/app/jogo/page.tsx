"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Field, Icon } from "@/components/shared/Panel";
import { Select } from "@/components/shared/Select";
import { Modal } from "@/components/shared/Modal";
import { Sidebar } from "@/components/shared/Sidebar";
import { CanvasStage, CanvasBox } from "@/components/shared/CanvasStage";
import { StatsPanel } from "@/components/shared/StatsPanel";
import { StatusFooter } from "@/components/shared/StatusFooter";
import { WebGLGate } from "@/components/shared/WebGLGate";
import {
  Board,
  Player,
  GameConfig,
  createBoard,
  applyMove,
  checkWinner,
  isDraw,
  minimax,
  MinimaxResult,
  getWinningLine,
} from "@/lib/game/model";

// WebGL only exists in the browser; loading it as a dynamic, SSR-disabled component keeps the
// three.js/react-three-fiber bundle out of the server render entirely.
const BoardCanvas = dynamic(() => import("@/components/game/Game3D").then((m) => m.BoardCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">
      Carregando tabuleiro 3D…
    </div>
  ),
});

type Mode = "human" | "auto";
type AiAlgo = "minimax" | "alphabeta";

const HUMAN: Player = 1;
const AI: Player = -1;

export default function JogoPage() {
  const [size, setSize] = useState(3);
  const [winLength, setWinLength] = useState(3);
  const [maxDepth, setMaxDepth] = useState(9);
  const [mode, setMode] = useState<Mode>("human");
  const [aiAlgo, setAiAlgo] = useState<AiAlgo>("alphabeta");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const [board, setBoard] = useState<Board>(() => createBoard(3));
  const [current, setCurrent] = useState<Player>(HUMAN);
  const [thinking, setThinking] = useState(false);
  const [lastStats, setLastStats] = useState<MinimaxResult | null>(null);
  const [compare, setCompare] = useState<{ plain: MinimaxResult; pruned: MinimaxResult } | null>(null);

  // Keyboard operability: placing a mark was previously mouse/touch-only (a click on a WebGL
  // canvas has no native keyboard equivalent). Arrow keys move a highlighted "cursor" cell
  // (rendered by Game3D as a ring - see focusIndex), Enter/Space places the mark there.
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  // The ring should only show up for actual keyboard navigation, not every mouse click - a click
  // also moves DOM focus onto the board (tabIndex=0), which would otherwise light up the ring for
  // mouse users too. Mirrors the browser's own :focus-visible heuristic.
  const [keyboardNav, setKeyboardNav] = useState(false);

  // Full-depth minimax is only tractable up to 3x3 (9 cells, ~550k nodes worst case - see README).
  // Past that the branching factor at the root climbs with size^2, so the cap has to shrink hard or
  // a 6x6 board at "depth 9" explores a tree with a branching factor up to 36 and hangs the tab.
  const maxDepthCap = size <= 3 ? 9 : size === 4 ? 6 : size === 5 ? 5 : 4;
  const effectiveMaxDepth = Math.min(maxDepth, maxDepthCap);

  const config: GameConfig = { size, winLength, maxDepth: effectiveMaxDepth };
  const winner = checkWinner(board, size, winLength);
  const draw = !winner && isDraw(board);
  const over = winner !== 0 || draw;
  const winLine = useMemo(() => getWinningLine(board, size, winLength), [board, size, winLength]);

  const resetBoard = () => {
    setBoard(createBoard(size));
    setCurrent(HUMAN);
    setLastStats(null);
    setCompare(null);
    setThinking(false);
    setFocusIndex(null);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the whole game whenever its config changes
    resetBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, winLength, maxDepth]);

  // AI turn driver: fires whenever it's the AI's move (or "auto" mode) and the game isn't over.
  useEffect(() => {
    if (over) return;
    const aiShouldMove = mode === "auto" || current === AI;
    if (!aiShouldMove) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- flips a "computing" flag before the timed AI move below
    setThinking(true);
    const t = setTimeout(() => {
      const res = minimax(board, current, config, aiAlgo === "alphabeta");
      setLastStats(res);
      if (res.move >= 0) {
        setBoard((b) => applyMove(b, res.move, current));
        setCurrent((p) => (-p) as Player);
      }
      setThinking(false);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, current, mode, aiAlgo, over]);

  const handleCellClick = (i: number) => {
    if (over || thinking || mode !== "human" || current !== HUMAN) return;
    if (board[i] !== 0) return;
    setBoard((b) => applyMove(b, i, HUMAN));
    setCurrent(AI);
  };

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    setKeyboardNav(true);
    const i = focusIndex ?? 0;
    const row = Math.floor(i / size);
    const col = i % size;
    let next = i;
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (row > 0) next = i - size;
        break;
      case "ArrowDown":
        e.preventDefault();
        if (row < size - 1) next = i + size;
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (col > 0) next = i - 1;
        break;
      case "ArrowRight":
        e.preventDefault();
        if (col < size - 1) next = i + 1;
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        handleCellClick(i);
        return;
      default:
        return;
    }
    setFocusIndex(next);
  };

  const runComparison = () => {
    if (over) return;
    setThinking(true);
    setTimeout(() => {
      const plain = minimax(board, current, config, false);
      const pruned = minimax(board, current, config, true);
      setCompare({ plain, pruned });
      setThinking(false);
      setCompareOpen(true);
    }, 20);
  };

  const status = thinking ? "PENSANDO" : over ? (winner !== 0 ? "FIM DE JOGO" : "EMPATE") : "SUA VEZ";
  const canInteract = !over && !thinking && mode === "human" && current === HUMAN;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Left floating sidebar */}
      <Sidebar>
        <div>
          <h1 className="text-sm font-semibold tracking-tight">Jogo da Velha N×N</h1>
          <p className="mt-1 text-[11px] leading-relaxed text-on-surface-variant">
            Busca adversária: Minimax e Minimax com poda Alfa-Beta.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={() => setAdvancedOpen(true)}>
          <Icon name="tune" className="text-[16px]" /> Parâmetros ({size}x{size}, K={winLength}, {aiAlgo === "alphabeta" ? "Alfa-Beta" : "Minimax"})
        </button>

        <div className="mt-auto flex flex-col gap-3 border-t border-white/5 pt-4">
          <button className="btn btn-primary" onClick={resetBoard}>
            <Icon name="refresh" className="text-[16px]" /> Reiniciar partida
          </button>
          <button className="btn btn-secondary" onClick={runComparison} disabled={over || thinking}>
            <Icon name="compare_arrows" className="text-[16px]" /> Comparar Minimax vs. Alfa-Beta
          </button>
        </div>
      </Sidebar>

      {/* Center board */}
      <CanvasStage>
        <CanvasBox width={520} height={520}>
          <div
            className="h-full w-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            tabIndex={0}
            role="application"
            aria-label="Tabuleiro da velha. Use as setas para mover o cursor e Enter ou espaço para jogar na célula selecionada."
            onKeyDown={handleGridKeyDown}
            onFocus={() => setFocusIndex((f) => f ?? 0)}
            onMouseDown={() => setKeyboardNav(false)}
          >
            <WebGLGate>
              <BoardCanvas
                board={board}
                size={size}
                winLine={winLine}
                interactive={canInteract}
                onCellClick={handleCellClick}
                focusIndex={keyboardNav ? focusIndex : null}
              />
            </WebGLGate>
          </div>
        </CanvasBox>

        <div className="text-sm">
          {winner !== 0 && (
            <span className="font-medium text-primary">{winner === HUMAN ? "X venceu!" : "O venceu!"}</span>
          )}
          {draw && <span className="font-medium text-on-surface-variant">Empate.</span>}
          {!over && (
            <span className="text-on-surface-variant">
              {thinking ? "Agente pensando…" : `Vez de: ${current === 1 ? "X" : "O"}`}
            </span>
          )}
        </div>
      </CanvasStage>

      {/* Small floating stats panel (bottom-right) */}
      {lastStats && (
        <StatsPanel
          cols={2}
          items={[
            [
              "Status",
              lastStats.truncated ? (
                <span className="text-error">parcial (limite)</span>
              ) : (
                "completo"
              ),
            ],
            ["Nós explorados", lastStats.nodesExplored.toLocaleString("pt-BR")],
            ["Ramos podados", lastStats.prunedBranches.toLocaleString("pt-BR")],
            ["Tempo", `${lastStats.timeMs.toFixed(2)}ms`],
            ["Avaliação", String(lastStats.score)],
          ]}
        />
      )}

      {/* Floating status pill */}
      <StatusFooter
        status={status}
        pulsing={thinking}
        segments={[
          { label: "Agente", value: aiAlgo === "alphabeta" ? "Alfa-Beta" : "Minimax", accent: true },
          { label: "Tabuleiro", value: `${size}×${size} · K=${winLength}` },
        ]}
      />

      <Modal
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        title="Parâmetros avançados"
        subtitle="Modo, algoritmo do agente, forma do tabuleiro e profundidade de busca"
      >
        <Field label="Modo">
          <Select
            value={mode}
            onChange={(v) => setMode(v as Mode)}
            options={[
              { value: "human", label: "Jogar contra o agente (você é X)" },
              { value: "auto", label: "Agente vs. Agente (automático)" },
            ]}
          />
        </Field>
        <Field label="Algoritmo do agente">
          <Select
            value={aiAlgo}
            onChange={(v) => setAiAlgo(v as AiAlgo)}
            options={[
              { value: "alphabeta", label: "Minimax com poda Alfa-Beta" },
              { value: "minimax", label: "Minimax puro" },
            ]}
          />
        </Field>
        <Field label={`Tamanho do tabuleiro: ${size}x${size}`}>
          <input
            type="range"
            min={3}
            max={6}
            value={size}
            onChange={(e) => {
              const s = Number(e.target.value);
              setSize(s);
              setWinLength((w) => Math.min(w, s));
            }}
          />
        </Field>
        <Field label={`Sequência vencedora (K): ${winLength}`}>
          <input
            type="range"
            min={3}
            max={size}
            value={winLength}
            onChange={(e) => setWinLength(Number(e.target.value))}
          />
        </Field>
        <Field label={`Profundidade máxima: ${effectiveMaxDepth === maxDepthCap ? "completa" : effectiveMaxDepth}`}>
          <input
            type="range"
            min={2}
            max={maxDepthCap}
            value={effectiveMaxDepth}
            onChange={(e) => setMaxDepth(Number(e.target.value))}
          />
        </Field>
        <p className="text-[11px] text-on-surface-variant">
          Tabuleiros maiores que 3x3 usam avaliação heurística (linhas abertas) quando o limite de
          profundidade é atingido, pois a árvore completa é grande demais — por isso o limite
          máximo do slider cai conforme o tabuleiro cresce ({size}x{size} → até {maxDepthCap}{" "}
          jogadas), evitando que a busca trave a interface. Alterar qualquer campo reinicia a
          partida.
        </p>
      </Modal>

      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Minimax vs. Alfa-Beta"
        subtitle="Mesma posição, mesma jogada ótima, diferença no esforço de busca"
        wide
      >
        {!compare ? (
          <p className="text-xs text-on-surface-variant">Clique em &ldquo;Comparar&rdquo; para ver a diferença.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-on-surface-variant">
                  <th className="px-2 py-2 text-left font-medium">Algoritmo</th>
                  <th className="px-2 py-2 text-right font-medium">Jogada</th>
                  <th className="px-2 py-2 text-right font-medium">Avaliação</th>
                  <th className="px-2 py-2 text-right font-medium">Nós</th>
                  <th className="px-2 py-2 text-right font-medium">Podados</th>
                  <th className="px-2 py-2 text-right font-medium">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Minimax puro", r: compare.plain },
                  { label: "+ Alfa-Beta", r: compare.pruned },
                ].map(({ label, r }) => (
                  <tr key={label} className="border-b border-white/5">
                    <td className="px-2 py-2">{label}</td>
                    <td className="px-2 py-2 text-right font-mono">{r.move}</td>
                    <td className="px-2 py-2 text-right font-mono">{r.score}</td>
                    <td className="px-2 py-2 text-right font-mono">{r.nodesExplored.toLocaleString("pt-BR")}</td>
                    <td className="px-2 py-2 text-right font-mono">{r.prunedBranches.toLocaleString("pt-BR")}</td>
                    <td className="px-2 py-2 text-right font-mono">{r.timeMs.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
