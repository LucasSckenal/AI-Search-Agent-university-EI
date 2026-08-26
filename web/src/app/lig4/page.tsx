"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Field, Icon } from "@/components/shared/Panel";
import { Select } from "@/components/shared/Select";
import { Modal } from "@/components/shared/Modal";
import { StageHint } from "@/components/shared/Stage";
import { StatGrid } from "@/components/shared/StatGrid";
import { StatusBar } from "@/components/shared/StatusBar";
import { FallingDisc, Lig4Grid } from "@/components/lig4/Lig4Grid";
import {
  applyDrop,
  Board,
  checkWinner,
  COLS,
  dropRow,
  emptyBoard,
  getWinningLine,
  isDraw,
  mcts,
  MctsResult,
  minimax,
  MinimaxResult,
  Player,
} from "@/lib/lig4/model";

type Mode = "human" | "aiVsAi";
type AiAlgo = "alphabeta" | "minimax" | "mcts";

const MODE_LABELS: Record<Mode, string> = {
  human: "Jogar contra o agente",
  aiVsAi: "Alfa-Beta vs. MCTS",
};
const ALGO_LABELS: Record<AiAlgo, string> = {
  alphabeta: "Minimax com poda Alfa-Beta",
  minimax: "Minimax puro",
  mcts: "Busca em Árvore de Monte Carlo (MCTS)",
};

const HUMAN: Player = 1; // vermelho
const AI: Player = -1; // amarelo

// Measured via a throwaway probe script (same discipline as 2048/Tetris's own tuned defaults):
// depth 8 alpha-beta runs 17-120ms across representative positions (empty/midgame/endgame), depth 9
// spikes to ~660ms in the midgame - too slow for a responsive UI. 5000 MCTS simulations run in
// 50-65ms/move and are competitive with depth-8 alpha-beta in self-play, while staying an order of
// magnitude faster than what the time budget allows.
const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_SIMULATIONS = 5000;

const AI_THINK_MS = 250; // human-mode AI pause, same UX delay Jogo da Velha already uses
const AI_RACE_TICK_MS = 700; // aiVsAi pacing between moves, in the spirit of Tetris's AI_RACE_TICK_MS

// Scales the disc's fall transition by how far it actually drops (6 rows max), clamped to stay
// comfortably inside both AI_THINK_MS and AI_RACE_TICK_MS.
function fallDurationMs(row: number): number {
  return Math.min(380, Math.max(150, 150 + row * 55));
}

interface TaggedResult {
  algo: AiAlgo;
  result: MinimaxResult | MctsResult;
}

export default function Lig4Page() {
  const [mode, setMode] = useState<Mode>("human");
  const [aiAlgo, setAiAlgo] = useState<AiAlgo>("alphabeta");
  const [maxDepth, setMaxDepth] = useState(DEFAULT_MAX_DEPTH);
  const [simulations, setSimulations] = useState(DEFAULT_SIMULATIONS);

  const [paramsOpen, setParamsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const [board, setBoard] = useState<Board>(() => emptyBoard());
  const [current, setCurrent] = useState<Player>(HUMAN);
  const [thinking, setThinking] = useState(false);
  const [lastStats, setLastStats] = useState<TaggedResult | null>(null);
  const [compare, setCompare] = useState<{ minimax: MinimaxResult; alphabeta: MinimaxResult; mcts: MctsResult } | null>(null);

  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [focusCol, setFocusCol] = useState<number | null>(null);
  // The ring/hover preview should only show for actual keyboard navigation, not every mouse click -
  // same :focus-visible-style heuristic Jogo da Velha already uses for its own cursor ring.
  const [keyboardNav, setKeyboardNav] = useState(false);

  const [fallingDisc, setFallingDisc] = useState<FallingDisc | null>(null);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<[number, number]>([0, 0]);

  useEffect(
    () => () => {
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
      cancelAnimationFrame(rafRef.current[0]);
      cancelAnimationFrame(rafRef.current[1]);
    },
    []
  );

  const winner = checkWinner(board);
  const draw = winner === 0 && isDraw(board);
  const over = winner !== 0 || draw;
  const winLine = useMemo(() => getWinningLine(board), [board]);
  const movesPlayed = useMemo(() => board.filter((c) => c !== 0).length, [board]);

  const resetGame = () => {
    if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    cancelAnimationFrame(rafRef.current[0]);
    cancelAnimationFrame(rafRef.current[1]);
    setBoard(emptyBoard());
    setCurrent(HUMAN);
    setLastStats(null);
    setCompare(null);
    setThinking(false);
    setFallingDisc(null);
    setHoverCol(null);
    setFocusCol(null);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- switching modes starts a fresh game, not a sync with external state
    resetGame();
  }, [mode]);

  // Commits a column drop: animates the disc falling to its landing row (double-rAF mount-then-
  // update, same trick as Tetris's fallingPiece falling animation), then applies the real board
  // update once the animation finishes - the board stays "old" for the animation's duration, same
  // preLock/lockedBoard tradeoff Tetris's own scrub makes.
  const commitMove = (col: number, player: Player) => {
    const row = dropRow(board, col);
    if (row === -1) return;
    const fallMs = fallDurationMs(row);
    setFallingDisc({ col, toRow: 0, player, fallMs: 1 });
    rafRef.current[0] = requestAnimationFrame(() => {
      rafRef.current[1] = requestAnimationFrame(() => {
        setFallingDisc((prev) => (prev ? { ...prev, toRow: row, fallMs } : prev));
      });
    });
    if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    animTimeoutRef.current = setTimeout(() => {
      const dropped = applyDrop(board, col, player);
      if (dropped) setBoard(dropped.board);
      setCurrent((-player) as Player);
      setFallingDisc(null);
    }, fallMs + 40);
  };

  const canInteract = mode === "human" && !over && current === HUMAN && !thinking && !fallingDisc;

  const handleColumnClick = (col: number) => {
    if (!canInteract) return;
    commitMove(col, HUMAN);
  };

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    setKeyboardNav(true);
    const col = focusCol ?? 3;
    let next = col;
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        if (col > 0) next = col - 1;
        break;
      case "ArrowRight":
        e.preventDefault();
        if (col < COLS - 1) next = col + 1;
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        handleColumnClick(col);
        return;
      default:
        return;
    }
    setFocusCol(next);
  };

  // Human mode's AI-turn driver: fires whenever it's the AI's move and the game isn't over/mid-animation.
  useEffect(() => {
    if (mode !== "human" || over || current !== AI || fallingDisc) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- flips a "computing" flag before the timed AI move below
    setThinking(true);
    const t = setTimeout(() => {
      const res: MinimaxResult | MctsResult =
        aiAlgo === "mcts" ? mcts(board, current, { simulations }) : minimax(board, current, { maxDepth }, aiAlgo === "alphabeta");
      setLastStats({ algo: aiAlgo, result: res });
      setThinking(false);
      if (res.move >= 0) commitMove(res.move, current);
    }, AI_THINK_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, board, current, over, aiAlgo, maxDepth, simulations, fallingDisc]);

  // aiVsAi mode: a full automated game, red always played by Alfa-Beta and yellow always by MCTS -
  // paced on a fixed tick (AI_RACE_TICK_MS) instead of instantly, so a human audience can actually
  // follow the game move by move.
  useEffect(() => {
    if (mode !== "aiVsAi" || over || fallingDisc) return;
    const t = setTimeout(() => {
      const algo: AiAlgo = current === HUMAN ? "alphabeta" : "mcts";
      const res: MinimaxResult | MctsResult = algo === "mcts" ? mcts(board, current, { simulations }) : minimax(board, current, { maxDepth }, true);
      setLastStats({ algo, result: res });
      if (res.move >= 0) commitMove(res.move, current);
    }, AI_RACE_TICK_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, board, current, over, maxDepth, simulations, fallingDisc]);

  const runComparison = () => {
    if (over || thinking) return;
    setThinking(true);
    setTimeout(() => {
      const plain = minimax(board, current, { maxDepth }, false);
      const pruned = minimax(board, current, { maxDepth }, true);
      const mc = mcts(board, current, { simulations });
      setCompare({ minimax: plain, alphabeta: pruned, mcts: mc });
      setThinking(false);
      setCompareOpen(true);
    }, 20);
  };

  const status = thinking
    ? "PENSANDO"
    : over
      ? winner !== 0
        ? "FIM DE JOGO"
        : "EMPATE"
      : mode === "aiVsAi"
        ? current === HUMAN
          ? "VEZ DO VERMELHO"
          : "VEZ DO AMARELO"
        : current === HUMAN
          ? "SUA VEZ"
          : "VEZ DA IA";

  const message = thinking ? (
    "Agente pensando…"
  ) : winner !== 0 ? (
    <span className="font-medium text-primary">{winner === 1 ? "Vermelho venceu!" : "Amarelo venceu!"}</span>
  ) : draw ? (
    "Empate — o tabuleiro encheu sem 4 em linha."
  ) : mode === "aiVsAi" ? (
    `Vez de: ${current === 1 ? "Vermelho (Alfa-Beta)" : "Amarelo (MCTS)"}`
  ) : current === HUMAN ? (
    "Sua vez — você é o vermelho."
  ) : (
    "Vez da IA (amarelo)."
  );

  const overlay = !over
    ? null
    : mode === "human"
      ? winner !== 0
        ? { title: winner === HUMAN ? "VOCÊ VENCEU!" : "VOCÊ PERDEU", subtitle: winner === HUMAN ? "Quatro em linha primeiro" : "A IA fez 4 em linha antes de você" }
        : { title: "EMPATE", subtitle: "O tabuleiro encheu sem um vencedor" }
      : winner !== 0
        ? { title: winner === 1 ? "VERMELHO VENCEU" : "AMARELO VENCEU", subtitle: winner === 1 ? "Alfa-Beta fez 4 em linha primeiro" : "MCTS fez 4 em linha primeiro" }
        : { title: "EMPATE", subtitle: "O tabuleiro encheu sem um vencedor" };

  function formatScoreCell(algo: AiAlgo, r: MinimaxResult | MctsResult): string {
    if (algo === "mcts") return `${((r as MctsResult).score * 100).toFixed(1)}% vitória`;
    return String(r.score);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Lig 4</span>
            <span>/</span>
            <span className="accent">{mode === "human" ? ALGO_LABELS[aiAlgo] : "Alfa-Beta vs. MCTS"}</span>
          </div>
          <h1 className="content-title">Lig 4</h1>
          <p className="content-sub">
            Solte peças numa coluna e alinhe quatro antes do adversário. Estende a busca adversária
            do Jogo da Velha para um tabuleiro bem maior (Minimax e Alfa-Beta) e apresenta a Busca em
            Árvore de Monte Carlo (MCTS), que simula partidas aleatórias em vez de explorar a árvore
            por completo.
          </p>
        </div>
        <div className="content-actions">
          <button className="btn-pill" onClick={runComparison} disabled={over || thinking}>
            <Icon name="compare_arrows" className="text-[15px]" /> Comparar
          </button>
          <button className="btn-pill btn-pill-primary" onClick={resetGame}>
            <Icon name="refresh" className="text-[15px]" /> Reiniciar partida
          </button>
        </div>
      </div>

      <div className="workspace-card">
        <div className="workspace-head">
          <Select
            value={mode}
            onChange={(v) => setMode(v as Mode)}
            options={(Object.keys(MODE_LABELS) as Mode[]).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
            className="!w-auto shrink-0"
          />
          <div className="workspace-links">
            <button className="workspace-link" onClick={() => setParamsOpen(true)}>
              <Icon name="tune" className="text-[13px]" /> Parâmetros
            </button>
            <button className="workspace-link" onClick={() => setStatsOpen(true)} disabled={!lastStats}>
              <Icon name="query_stats" className="text-[13px]" /> Última jogada
            </button>
          </div>
        </div>

        <div className="canvas-body">
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(242,201,76,0.06),transparent_60%)]">
            <StageHint>
              {mode === "aiVsAi" ? (
                <>
                  JOGADAS <b className="readout-glow font-semibold text-primary">{movesPlayed}</b> · VERMELHO{" "}
                  <b className="readout-glow font-semibold text-primary">Alfa-Beta</b> · AMARELO{" "}
                  <b className="readout-glow font-semibold text-primary">MCTS</b>
                </>
              ) : (
                <>
                  TABULEIRO <b className="readout-glow font-semibold text-primary">7×6</b> · AGENTE{" "}
                  <b className="readout-glow font-semibold text-primary">{ALGO_LABELS[aiAlgo]}</b>
                </>
              )}
            </StageHint>
            <div
              className="flex h-full w-full items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70"
              tabIndex={0}
              role="application"
              aria-label="Tabuleiro de Lig 4. Use as setas para mover o cursor de coluna e Enter ou espaço para soltar a peça."
              onKeyDown={handleGridKeyDown}
              onFocus={() => setFocusCol((c) => c ?? 3)}
              onMouseDown={() => setKeyboardNav(false)}
            >
              <Lig4Grid
                board={board}
                winLine={winLine}
                interactive={canInteract}
                onColumnClick={handleColumnClick}
                hoverCol={canInteract ? hoverCol : null}
                onHoverColumn={canInteract ? setHoverCol : undefined}
                ghostPlayer={HUMAN}
                fallingDisc={fallingDisc}
                focusCol={keyboardNav ? focusCol : null}
                overlay={overlay}
              />
            </div>
          </div>

          <StatusBar status={status} pulsing={thinking} message={message} onReset={resetGame} resetLabel="Reiniciar" />
        </div>
      </div>

      <Modal open={statsOpen} onClose={() => setStatsOpen(false)} title="Última jogada do agente">
        {lastStats &&
          (lastStats.algo === "mcts" ? (
            <StatGrid
              cols={2}
              items={[
                ["Algoritmo", "MCTS"],
                ["Jogada (coluna)", String(lastStats.result.move)],
                ["Taxa de vitória", `${((lastStats.result as MctsResult).score * 100).toFixed(1)}%`],
                ["Simulações", lastStats.result.nodesExplored.toLocaleString("pt-BR")],
                ["Tempo", `${lastStats.result.timeMs.toFixed(2)}ms`],
                ["Truncado?", lastStats.result.truncated ? "Sim" : "Não"],
              ]}
            />
          ) : (
            <StatGrid
              cols={2}
              items={[
                ["Algoritmo", ALGO_LABELS[lastStats.algo]],
                ["Jogada (coluna)", String(lastStats.result.move)],
                ["Status", lastStats.result.truncated ? <span key="t" className="text-error">parcial</span> : "completo"],
                ["Nós explorados", lastStats.result.nodesExplored.toLocaleString("pt-BR")],
                ["Ramos podados", (lastStats.result as MinimaxResult).prunedBranches.toLocaleString("pt-BR")],
                ["Tempo", `${lastStats.result.timeMs.toFixed(2)}ms`],
                ["Avaliação", String(lastStats.result.score)],
              ]}
            />
          ))}
      </Modal>

      <Modal
        open={paramsOpen}
        onClose={() => setParamsOpen(false)}
        title="Parâmetros"
        subtitle="Algoritmo do agente (modo humano) e força de busca dos três algoritmos"
      >
        <Field label="Algoritmo do agente (modo &ldquo;Jogar contra o agente&rdquo;)">
          <Select
            value={aiAlgo}
            onChange={(v) => setAiAlgo(v as AiAlgo)}
            options={(Object.keys(ALGO_LABELS) as AiAlgo[]).map((a) => ({ value: a, label: ALGO_LABELS[a] }))}
          />
        </Field>
        <Field label={`Profundidade do Minimax/Alfa-Beta: ${maxDepth}`}>
          <input type="range" min={4} max={10} value={maxDepth} onChange={(e) => setMaxDepth(Number(e.target.value))} />
        </Field>
        <Field label={`Simulações do MCTS: ${simulations.toLocaleString("pt-BR")}`}>
          <input
            type="range"
            min={500}
            max={10000}
            step={500}
            value={simulations}
            onChange={(e) => setSimulations(Number(e.target.value))}
          />
        </Field>
        <p className="text-[11px] leading-relaxed text-on-surface-variant">
          Medido: profundidade 8 do Minimax/Alfa-Beta responde em 17-120ms na maioria das posições,
          mas a profundidade 9 já passa de 600ms no meio de jogo — por isso o padrão é 8. 5.000
          simulações do MCTS respondem em 50-65ms por jogada e já competem de igual para igual com o
          Alfa-Beta em profundidade 8 em partidas de auto-jogo. Valores maiores exploram mais a fundo
          (ou simulam mais partidas), mas demoram mais para responder.
        </p>
      </Modal>

      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Minimax vs. Alfa-Beta vs. MCTS"
        subtitle="Mesma posição, três formas diferentes de escolher a próxima jogada"
        wide
      >
        {!compare ? (
          <p className="text-xs text-on-surface-variant">Clique em &ldquo;Comparar&rdquo; para ver a diferença.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-on-surface-variant">
                  <th className="px-2 py-2 text-left font-medium">Algoritmo</th>
                  <th className="px-2 py-2 text-right font-medium">Coluna</th>
                  <th className="px-2 py-2 text-right font-medium">Pontuação / Taxa</th>
                  <th className="px-2 py-2 text-right font-medium">Nós / Simulações</th>
                  <th className="px-2 py-2 text-right font-medium">Podados</th>
                  <th className="px-2 py-2 text-right font-medium">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    { label: "Minimax puro", algo: "minimax" as AiAlgo, r: compare.minimax },
                    { label: "+ Alfa-Beta", algo: "alphabeta" as AiAlgo, r: compare.alphabeta },
                    { label: "MCTS", algo: "mcts" as AiAlgo, r: compare.mcts },
                  ] satisfies { label: string; algo: AiAlgo; r: MinimaxResult | MctsResult }[]
                ).map(({ label, algo, r }) => (
                  <tr key={label} className="border-b border-white/5">
                    <td className="px-2 py-2">{label}</td>
                    <td className="px-2 py-2 text-right font-mono">{r.move}</td>
                    <td className="px-2 py-2 text-right font-mono">{formatScoreCell(algo, r)}</td>
                    <td className="px-2 py-2 text-right font-mono">{r.nodesExplored.toLocaleString("pt-BR")}</td>
                    <td className="px-2 py-2 text-right font-mono">
                      {algo === "mcts" ? "—" : (r as MinimaxResult).prunedBranches.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">{r.timeMs.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] leading-relaxed text-on-surface-variant">
              A pontuação do Minimax/Alfa-Beta é uma avaliação em torno de ±10.000 (vitória/derrota
              próxima), enquanto a taxa de vitória do MCTS é a fração de simulações que terminaram em
              vitória para quem está jogando — unidades diferentes, não comparáveis diretamente.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
