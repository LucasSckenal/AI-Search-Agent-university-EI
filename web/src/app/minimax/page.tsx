"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Select } from "@/components/shared/Select";
import { Toggle } from "@/components/shared/Toggle";
import { StageHint } from "@/components/shared/Stage";
import { Timeline } from "@/components/shared/Timeline";
import { WebGLGate } from "@/components/shared/WebGLGate";
import { Board, GameConfig, Player } from "@/lib/game/model";
import { traceMinimax, MinimaxNode, MinimaxTraceResult } from "@/lib/minimax/trace";

const MinimaxTree3D = dynamic(() => import("@/components/minimax/MinimaxTree3D").then((m) => m.MinimaxTree3D), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">
      Carregando árvore 3D…
    </div>
  ),
});

interface Preset {
  id: string;
  label: string;
  board: Board;
  player: Player;
}

// Two small near-endgame positions (few empty cells) - small enough that a full, unheuristicized
// tree fits legibly in one 3D view. Neither is already won/drawn (verified by hand), so there's a
// real search to watch either way.
const PRESETS: Preset[] = [
  { id: "a", label: "Posição A — 3 casas vazias", board: [1, -1, 1, -1, 1, -1, 0, 0, 0], player: 1 },
  { id: "b", label: "Posição B — 5 casas vazias", board: [1, -1, 0, 0, 1, 0, 0, 0, -1], player: 1 },
];

const GAME_CONFIG: GameConfig = { size: 3, winLength: 3, maxDepth: 9 };

const CELL_LABEL: Record<number, string> = { 1: "X", [-1]: "O", 0: "" };
const X_COLOR = "#7ea8f5";
const O_COLOR = "#ff6bd6";

function MiniBoard({ board }: { board: Board }) {
  return (
    <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-white/5 p-1.5">
      {board.map((cell, i) => (
        <div
          key={i}
          className="flex h-5 w-5 items-center justify-center rounded-[3px] bg-white/5 font-mono text-[11px] font-bold"
          style={{ color: cell === 1 ? X_COLOR : cell === -1 ? O_COLOR : "transparent" }}
        >
          {CELL_LABEL[cell] || "·"}
        </div>
      ))}
    </div>
  );
}

export default function MinimaxPage() {
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [useAlphaBeta, setUseAlphaBeta] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];

  const trace = useMemo(() => {
    const gen = traceMinimax(preset.board, preset.player, GAME_CONFIG, useAlphaBeta);
    const nodes: MinimaxNode[] = [];
    let next = gen.next();
    while (!next.done) {
      nodes.push(next.value);
      next = gen.next();
    }
    return { nodes, result: next.value as MinimaxTraceResult };
  }, [preset, useAlphaBeta]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new position/pruning combo needs a fresh trace from step 0, not a sync with external state
    setStepIndex(0);
    setPlaying(false);
  }, [trace]);

  useEffect(() => {
    if (!playing) return;
    if (stepIndex >= trace.nodes.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStepIndex((i) => Math.min(i + Math.max(1, speed), trace.nodes.length - 1)), 90);
    return () => clearTimeout(t);
  }, [playing, stepIndex, speed, trace]);

  const current = trace.nodes[Math.min(stepIndex, trace.nodes.length - 1)] as MinimaxNode | undefined;
  const done = stepIndex >= trace.nodes.length - 1;
  const revealCount = stepIndex + 1;

  const playerLabel = (p: Player) => (p === 1 ? "X (maximizando)" : "O (minimizando)");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Minimax</span>
            <span>/</span>
            <span className="accent">Busca Adversária</span>
          </div>
          <h1 className="content-title">Minimax</h1>
          <p className="content-sub">
            A cada nó, o jogador MAX (X) escolhe o filho de maior valor e o jogador MIN (O) escolhe o
            de menor valor - os valores só existem nas folhas (vitória, derrota ou empate) e sobem
            pela árvore, um nível de cada vez. Com poda Alfa-Beta ligada, ramos que já não podem
            mudar a decisão do nó acima são cortados sem serem visitados - mesma resposta final, bem
            menos trabalho. Veja a árvore real de um fim de jogo do velha crescendo nó a nó.
          </p>
        </div>
      </div>

      <div className="workspace-card">
        <div className="workspace-head">
          <Select
            value={presetId}
            onChange={setPresetId}
            className="!w-auto shrink-0"
            options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
          />
          <div className="workspace-links">
            <Toggle checked={useAlphaBeta} onChange={setUseAlphaBeta} label="Poda Alfa-Beta" />
          </div>
        </div>

        <div className="canvas-body">
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(126,168,245,0.06),transparent_60%)]">
            <StageHint>
              NÓ <b className="readout-glow font-semibold text-primary">{revealCount}</b>
              {" / "}
              {trace.nodes.length}
              {current && !current.pruned && (
                <>
                  {" · PROFUNDIDADE "}
                  <b className="readout-glow font-semibold text-primary">{current.depth}</b>
                  {current.score !== null && (
                    <>
                      {" · VALOR "}
                      <b className="readout-glow font-semibold text-primary">{current.score}</b>
                    </>
                  )}
                </>
              )}
              {current?.pruned && (
                <>
                  {" · "}
                  <b className="readout-glow font-semibold text-primary">RAMO PODADO</b>
                </>
              )}
              {done && (
                <>
                  {" · "}
                  <b className="readout-glow font-semibold text-primary">
                    {trace.result.nodesExplored} NÓS · {trace.result.prunedCount} PODADOS
                  </b>
                </>
              )}
            </StageHint>

            {current && (
              <div className="pointer-events-none absolute left-3 top-3 z-[1] flex flex-col items-start gap-1.5">
                <MiniBoard board={current.board} />
                {!current.terminal && !current.pruned && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-on-surface-variant">
                    vez de {playerLabel(current.toMove)}
                  </span>
                )}
              </div>
            )}

            <WebGLGate>
              <MinimaxTree3D nodes={trace.nodes} revealCount={revealCount} bestMove={done ? trace.result.move : null} />
            </WebGLGate>
          </div>

          <Timeline
            status={playing ? "EXPANDINDO" : done ? "CONCLUÍDO" : "PRONTO"}
            pulsing={playing}
            playing={playing}
            onTogglePlay={() => setPlaying((p) => !p)}
            onSkipEnd={() => {
              setStepIndex(trace.nodes.length - 1);
              setPlaying(false);
            }}
            current={stepIndex}
            total={Math.max(trace.nodes.length - 1, 0)}
            unitLabel="nós"
            disabled={trace.nodes.length === 0}
            speed={speed}
            onSpeedChange={setSpeed}
            speedLabel="Velocidade"
            speedMax={8}
          />
        </div>
      </div>
    </div>
  );
}
