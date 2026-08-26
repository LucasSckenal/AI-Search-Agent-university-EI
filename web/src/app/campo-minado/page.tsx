"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, Icon } from "@/components/shared/Panel";
import { Modal } from "@/components/shared/Modal";
import { Select } from "@/components/shared/Select";
import { StageHint } from "@/components/shared/Stage";
import { StatGrid } from "@/components/shared/StatGrid";
import { Timeline } from "@/components/shared/Timeline";
import { MinesweeperGrid } from "@/components/campo-minado/MinesweeperGrid";
import { randomSeed, seededRng } from "@/lib/core/rng";
import {
  BoardConfig,
  centerIndex,
  colOf,
  Difficulty,
  DIFFICULTY_CONFIG,
  DIFFICULTY_LABELS,
  floodReveal,
  Instance,
  isWon,
  logicaSteps,
  makeShell,
  MinesweeperStep,
  placeMines,
  probabilidadeSteps,
  remainingMines,
  rowOf,
  toggleFlag,
} from "@/lib/campo-minado/model";

type MinesweeperMode = "play" | "logica" | "probabilidade";

const MODE_LABELS: Record<MinesweeperMode, string> = {
  play: "Jogar você mesmo",
  logica: "Dedução Lógica",
  probabilidade: "Inferência Probabilística",
};

function emptyArray(board: BoardConfig): boolean[] {
  return new Array(board.width * board.height).fill(false);
}

export default function CampoMinadoPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>("iniciante");
  const board = DIFFICULTY_CONFIG[difficulty];

  // Deterministic placeholder for SSR (same precedent as every other page's own seed placeholder);
  // the mount effect below immediately swaps it for a real random seed.
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState<MinesweeperMode>("play");

  const [paramsOpen, setParamsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  // --- manual play state: mines are placed lazily on the first real reveal (first-click-safe rule),
  // so `instance` starts as an unplaced shell every time the board/seed changes.
  const [instance, setInstance] = useState<Instance>(() => makeShell(board));
  const [revealed, setRevealed] = useState<boolean[]>(() => emptyArray(board));
  const [flagged, setFlagged] = useState<boolean[]>(() => emptyArray(board));
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [explodedIndex, setExplodedIndex] = useState<number | null>(null);
  const [flagMode, setFlagMode] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time swap from the SSR placeholder seed to a real random one
    setSeed(randomSeed());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting to a fresh game whenever difficulty or seed changes, not syncing external state
    setInstance(makeShell(board));
    setRevealed(emptyArray(board));
    setFlagged(emptyArray(board));
    setFocusedIndex(null);
    setExplodedIndex(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- board is derived from difficulty; keying on difficulty+seed is exactly what should trigger a fresh game
  }, [difficulty, seed]);

  const won = instance.minesPlaced && !explodedIndex && isWon(instance, revealed);
  const lost = explodedIndex !== null;

  const handleReveal = (idx: number) => {
    if (lost || won || flagged[idx]) return;
    let inst = instance;
    if (!inst.minesPlaced) {
      inst = placeMines(inst, idx, seededRng(seed));
      setInstance(inst);
    }
    const { revealed: nextRevealed, exploded } = floodReveal(inst, revealed, flagged, idx);
    setRevealed(nextRevealed);
    if (exploded) setExplodedIndex(idx);
  };
  const handleFlag = (idx: number) => {
    if (lost || won || revealed[idx]) return;
    setFlagged((prev) => toggleFlag(prev, revealed, idx));
  };
  const handleCellClick = (idx: number) => {
    setFocusedIndex(idx);
    if (flagMode) handleFlag(idx);
    else handleReveal(idx);
  };

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (focusedIndex === null) return;
    if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      handleFlag(focusedIndex);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (flagMode) handleFlag(focusedIndex);
      else handleReveal(focusedIndex);
      return;
    }
    const row = rowOf(board, focusedIndex);
    const col = colOf(board, focusedIndex);
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        if (col > 0) setFocusedIndex(focusedIndex - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (col < board.width - 1) setFocusedIndex(focusedIndex + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (row > 0) setFocusedIndex(focusedIndex - board.width);
        break;
      case "ArrowDown":
        e.preventDefault();
        if (row < board.height - 1) setFocusedIndex(focusedIndex + board.width);
        break;
    }
  };

  // --- AI modes: both always open the same deterministic center cell first, on the SAME seed, so
  // logica/probabilidade (and Comparar) are directly comparable on an identical mine layout.
  const aiInstance = useMemo(() => placeMines(makeShell(board), centerIndex(board), seededRng(seed)), [board, seed]);
  const aiOpening = useMemo(() => floodReveal(aiInstance, emptyArray(board), emptyArray(board), centerIndex(board)), [aiInstance, board]);

  const [logicaRun, setLogicaRun] = useState<MinesweeperStep[] | null>(null);
  const [logicaElapsedMs, setLogicaElapsedMs] = useState<number | null>(null);
  const [probRun, setProbRun] = useState<MinesweeperStep[] | null>(null);
  const [probElapsedMs, setProbElapsedMs] = useState<number | null>(null);
  const [compare, setCompare] = useState<{ logica: MinesweeperStep[]; prob: MinesweeperStep[]; logicaMs: number; probMs: number } | null>(null);

  const [stepFrame, setStepFrame] = useState(0);
  const [stepPlaying, setStepPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale per-instance runs whenever the AI-mode board changes
    setLogicaRun(null);
    setProbRun(null);
    setCompare(null);
    setStepFrame(0);
    setStepPlaying(false);
  }, [aiInstance]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the shared scrubber when the visible mode changes
    setStepFrame(0);
    setStepPlaying(false);
  }, [mode]);

  const activeSteps: MinesweeperStep[] | null = mode === "logica" ? logicaRun : mode === "probabilidade" ? probRun : null;

  useEffect(() => {
    if (!stepPlaying || !activeSteps) return;
    if (stepFrame >= activeSteps.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setStepPlaying(false);
      return;
    }
    const t = setTimeout(() => setStepFrame((f) => Math.min(f + playbackSpeed, activeSteps.length - 1)), 140);
    return () => clearTimeout(t);
  }, [stepPlaying, stepFrame, activeSteps, playbackSpeed]);

  const activeStep: MinesweeperStep | null = activeSteps ? activeSteps[Math.min(stepFrame, activeSteps.length - 1)] : null;
  const onLastFrame = activeSteps ? stepFrame >= activeSteps.length - 1 : false;

  const runLogica = () => {
    const start = performance.now();
    const steps = logicaSteps(aiInstance, aiOpening.revealed, emptyArray(board));
    setLogicaRun(steps);
    setStepFrame(0);
    setStepPlaying(false);
    setLogicaElapsedMs(performance.now() - start);
  };
  const runProbabilidade = () => {
    const start = performance.now();
    const steps = probabilidadeSteps(aiInstance, aiOpening.revealed, emptyArray(board));
    setProbRun(steps);
    setStepFrame(0);
    setStepPlaying(false);
    setProbElapsedMs(performance.now() - start);
  };
  const runActive = () => {
    if (mode === "logica") runLogica();
    else if (mode === "probabilidade") runProbabilidade();
  };

  const runComparison = () => {
    // Times each solver itself rather than reusing logicaElapsedMs/probElapsedMs - those only get
    // set by the individual "Rodar X" button for the currently-selected mode, so relying on them here
    // would show "-" for whichever algorithm the user hasn't run standalone yet (the same fix Sudoku's
    // own Comparar modal needed).
    let start = performance.now();
    const logica = logicaSteps(aiInstance, aiOpening.revealed, emptyArray(board));
    const logicaMs = performance.now() - start;

    start = performance.now();
    const prob = probabilidadeSteps(aiInstance, aiOpening.revealed, emptyArray(board));
    const probMs = performance.now() - start;

    setCompare({ logica, prob, logicaMs, probMs });
    setCompareOpen(true);
  };

  const activeRevealed = mode === "play" ? revealed : (activeStep?.revealed ?? aiOpening.revealed);
  const activeFlagged = mode === "play" ? flagged : (activeStep?.flagged ?? emptyArray(board));
  const activeInstance = mode === "play" ? instance : aiInstance;
  const activeAdjacent = activeInstance.minesPlaced ? activeInstance.adjacent : new Array(board.width * board.height).fill(0);

  const showAllMines = mode === "play" ? won || lost : onLastFrame && (activeStep?.action === "solved" || activeStep?.action === "exploded");
  const explodedAt = mode === "play" ? explodedIndex : onLastFrame && activeStep?.action === "exploded" ? (activeStep.indices[0] ?? null) : null;

  const overlay =
    mode === "play"
      ? won
        ? { title: "VOCÊ VENCEU", subtitle: "Todas as células seguras reveladas" }
        : lost
          ? { title: "BOOM!", subtitle: "Você clicou numa mina" }
          : null
      : onLastFrame && activeStep
        ? activeStep.action === "solved"
          ? { title: "RESOLVIDO", subtitle: "Todas as células seguras foram deduzidas" }
          : activeStep.action === "exploded"
            ? { title: "BOOM!", subtitle: "O palpite acertou uma mina" }
            : activeStep.action === "stuck"
              ? { title: "TRAVOU", subtitle: "Nenhuma dedução lógica disponível" }
              : null
        : null;

  const probabilities = mode === "probabilidade" && activeStep?.probabilities ? mapFromSparse(activeStep.probabilities) : null;

  const remainingCount = mode === "play" ? remainingMines(instance, flagged) : board.mineCount - (activeStep?.cellsFlagged ?? 0);
  const revealedCount = mode === "play" ? revealed.filter(Boolean).length : (activeStep?.cellsRevealed ?? 0);

  const status = mode === "play" ? (won ? "VITÓRIA" : lost ? "DERROTA" : "JOGANDO") : stepPlaying ? "EXPLORANDO" : !activeSteps ? "AGUARDANDO EXECUÇÃO" : onLastFrame ? (activeStep?.action ?? "").toUpperCase() : "PRONTO";

  const currentStats: [string, string][] | null = useMemo(() => {
    if (mode === "play") return null;
    const run = mode === "logica" ? logicaRun : probRun;
    if (!run) return null;
    const elapsedMs = mode === "logica" ? logicaElapsedMs : probElapsedMs;
    const final = run[run.length - 1];
    const rows: [string, string][] = [
      ["Resultado", final.action === "solved" ? "Resolvido" : final.action === "exploded" ? "Explodiu" : "Travou"],
      ["Passos", String(run.length)],
      ["Células reveladas", String(final.cellsRevealed)],
      ["Células marcadas", String(final.cellsFlagged)],
    ];
    if (mode === "probabilidade") rows.push(["Palpites", String(run.filter((s) => s.action === "guess").length)]);
    rows.push(["Tempo", elapsedMs !== null ? `${elapsedMs.toFixed(2)}ms` : "—"]);
    return rows;
  }, [mode, logicaRun, probRun, logicaElapsedMs, probElapsedMs]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Campo Minado</span>
            <span>/</span>
            <span className="accent">{MODE_LABELS[mode]}</span>
          </div>
          <h1 className="content-title">Campo Minado</h1>
          <p className="content-sub">
            Revele todas as células sem mina. Compare Dedução Lógica — que só age quando tem certeza
            absoluta e às vezes trava — com Inferência Probabilística, que calcula a chance exata de
            cada célula ser mina e arrisca o palpite mais seguro quando a lógica pura não basta.
          </p>
        </div>
        <div className="content-actions">
          {mode !== "play" && (
            <>
              <button className="btn-pill" onClick={runComparison}>
                <Icon name="compare_arrows" className="text-[15px]" /> Comparar
              </button>
              <button className="btn-pill btn-pill-primary" onClick={runActive}>
                <Icon name="play_arrow" className="text-[15px]" /> {mode === "logica" ? "Rodar dedução lógica" : "Rodar inferência probabilística"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="workspace-card">
        <div className="workspace-head">
          <Select
            value={mode}
            onChange={(v) => setMode(v as MinesweeperMode)}
            options={(Object.keys(MODE_LABELS) as MinesweeperMode[]).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
            className="!w-auto shrink-0"
          />
          <div className="workspace-links">
            <button className="workspace-link" onClick={() => setParamsOpen(true)}>
              <Icon name="tune" className="text-[13px]" /> Parâmetros
            </button>
            <button className="workspace-link" onClick={() => setStatsOpen(true)} disabled={mode === "play" || !currentStats}>
              <Icon name="query_stats" className="text-[13px]" /> Última execução
            </button>
          </div>
        </div>

        <div className="canvas-body">
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(224,85,95,0.06),transparent_60%)]">
            <StageHint>
              MINAS <b className="readout-glow font-semibold text-primary">{remainingCount}</b> · REVELADAS{" "}
              <b className="readout-glow font-semibold text-primary">{revealedCount}</b> · DIFICULDADE{" "}
              <b className="readout-glow font-semibold text-primary">{DIFFICULTY_LABELS[difficulty]}</b>
            </StageHint>

            <div
              className="flex h-full w-full items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70"
              tabIndex={mode === "play" ? 0 : -1}
              role="application"
              aria-label="Campo Minado. Clique para revelar, F ou clique direito para marcar uma bandeira, setas para mover o cursor."
              onKeyDown={mode === "play" ? handleGridKeyDown : undefined}
              onFocus={() => mode === "play" && setFocusedIndex((i) => i ?? centerIndex(board))}
            >
              <MinesweeperGrid
                board={board}
                revealed={activeRevealed}
                flagged={activeFlagged}
                adjacent={activeAdjacent}
                mines={showAllMines ? activeInstance.mines : undefined}
                exploded={explodedAt}
                focusedIndex={mode === "play" ? focusedIndex : null}
                probabilities={probabilities}
                interactive={mode === "play"}
                onCellClick={mode === "play" ? handleCellClick : undefined}
                onCellFlag={mode === "play" ? handleFlag : undefined}
                overlay={overlay}
              />
            </div>

            {mode === "play" && (
              <button
                className={`minesweeper-flagmode-toggle pointer-events-auto absolute bottom-4 right-4 z-[1] ${flagMode ? "active" : ""}`}
                onClick={() => setFlagMode((f) => !f)}
                aria-pressed={flagMode}
              >
                <Icon name="flag" className="text-[13px]" /> {flagMode ? "Marcando" : "Revelando"}
              </button>
            )}
          </div>

          {mode === "play" ? (
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 bg-background px-4 sm:px-5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${won || lost ? "" : "animate-pulse"}`} style={{ background: "var(--tertiary)" }} />
                {won ? "VOCÊ VENCEU — TODAS AS CÉLULAS SEGURAS REVELADAS" : lost ? "VOCÊ CLICOU NUMA MINA" : "CLIQUE PARA REVELAR · F OU CLIQUE DIREITO MARCA UMA BANDEIRA"}
              </span>
              <button className="btn-pill" onClick={() => setSeed(randomSeed())}>
                <Icon name="refresh" className="text-[15px]" /> Novo jogo
              </button>
            </div>
          ) : (
            <Timeline
              status={status}
              pulsing={stepPlaying}
              playing={stepPlaying}
              onTogglePlay={() => setStepPlaying((p) => !p)}
              onSkipEnd={() => {
                if (!activeSteps) return;
                setStepFrame(activeSteps.length - 1);
                setStepPlaying(false);
              }}
              current={stepFrame}
              total={activeSteps?.length ?? 0}
              unitLabel="passos"
              disabled={!activeSteps}
              speed={playbackSpeed}
              onSpeedChange={setPlaybackSpeed}
              speedLabel="Velocidade"
              speedMin={1}
              speedMax={20}
            />
          )}
        </div>
      </div>

      <Modal open={statsOpen} onClose={() => setStatsOpen(false)} title="Última execução">
        {currentStats && <StatGrid cols={2} items={currentStats} />}
      </Modal>

      <Modal open={compareOpen} onClose={() => setCompareOpen(false)} title="Dedução Lógica vs. Inferência Probabilística" subtitle="Mesmo tabuleiro para as duas — a comparação isola o efeito de arriscar um palpite" wide>
        {!compare ? (
          <p className="text-xs text-on-surface-variant">Clique em &ldquo;Comparar&rdquo; para ver a diferença.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-on-surface-variant">
                  <th className="px-2 py-2 text-left font-medium">Algoritmo</th>
                  <th className="px-2 py-2 text-right font-medium">Resultado</th>
                  <th className="px-2 py-2 text-right font-medium">Reveladas</th>
                  <th className="px-2 py-2 text-right font-medium">Palpites</th>
                  <th className="px-2 py-2 text-right font-medium">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    { label: MODE_LABELS.logica, steps: compare.logica, ms: compare.logicaMs },
                    { label: MODE_LABELS.probabilidade, steps: compare.prob, ms: compare.probMs },
                  ] satisfies { label: string; steps: MinesweeperStep[]; ms: number }[]
                ).map(({ label, steps, ms }) => {
                  const final = steps[steps.length - 1];
                  const guesses = steps.filter((s) => s.action === "guess").length;
                  return (
                    <tr key={label} className="border-b border-white/5">
                      <td className="px-2 py-2">{label}</td>
                      <td className="px-2 py-2 text-right font-mono">{final.action === "solved" ? "Resolvido" : final.action === "exploded" ? "Explodiu" : "Travou"}</td>
                      <td className="px-2 py-2 text-right font-mono">{final.cellsRevealed.toLocaleString("pt-BR")}</td>
                      <td className="px-2 py-2 text-right font-mono">{guesses}</td>
                      <td className="px-2 py-2 text-right font-mono">{ms.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal open={paramsOpen} onClose={() => setParamsOpen(false)} title="Parâmetros" subtitle="Dificuldade e seed do tabuleiro">
        <Field label="Dificuldade">
          <Select
            value={difficulty}
            onChange={(v) => setDifficulty(v as Difficulty)}
            options={(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => ({
              value: d,
              label: `${DIFFICULTY_LABELS[d]} (${DIFFICULTY_CONFIG[d].width}×${DIFFICULTY_CONFIG[d].height}, ${DIFFICULTY_CONFIG[d].mineCount} minas)`,
            }))}
          />
        </Field>
        <div className="border-t border-outline-variant pt-4">
          <Field label="Seed">
            <div className="flex items-center gap-2">
              <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="w-full" />
              <button className="btn btn-secondary !px-2.5" onClick={() => setSeed(randomSeed())} title="Novo tabuleiro aleatório">
                <Icon name="casino" className="text-[16px]" />
              </button>
            </div>
          </Field>
        </div>
        <p className="text-[11px] leading-relaxed text-on-surface-variant">
          A seed decide onde as minas caem (a primeira célula clicada, e suas vizinhas, nunca são
          minadas). Dedução Lógica e Inferência Probabilística sempre partem da célula central.
        </p>
      </Modal>
    </div>
  );
}

function mapFromSparse(sparse: (number | null)[]): Map<number, number> {
  const map = new Map<number, number>();
  sparse.forEach((v, i) => {
    if (v !== null) map.set(i, v);
  });
  return map;
}
