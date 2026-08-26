"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Field, Icon } from "@/components/shared/Panel";
import { Modal } from "@/components/shared/Modal";
import { Select } from "@/components/shared/Select";
import { StageHint } from "@/components/shared/Stage";
import { StatGrid } from "@/components/shared/StatGrid";
import { Timeline } from "@/components/shared/Timeline";
import { WebGLGate } from "@/components/shared/WebGLGate";
import { evolve, GaConfig, GaGenerationSummary, GaRunResult } from "@/lib/core/genetic";
import { randomSeed } from "@/lib/core/rng";
import { backtrackingSteps, forwardCheckingSteps, minConflictsSteps, conflicts, QueensStep, MinConflictsResult } from "@/lib/queens/model";
import { buildQueensGaOps, QueensGenome } from "@/lib/queens/genetic";
import { GeneticModal, QueensGaFormConfig } from "@/components/queens/GeneticModal";

// WebGL only exists in the browser; loading it as a dynamic, SSR-disabled component keeps the
// three.js/react-three-fiber bundle out of the server render entirely (same pattern as tsp/goose/labirinto).
const QueensCanvas = dynamic(() => import("@/components/queens/QueensCanvas").then((m) => m.QueensCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">
      Carregando cenário 3D…
    </div>
  ),
});

type QueensMode = "backtracking" | "forwardchecking" | "minconflicts" | "genetic" | "vs" | "play";

const MODE_LABELS: Record<QueensMode, string> = {
  backtracking: "Backtracking",
  forwardchecking: "Forward Checking",
  minconflicts: "Min-Conflitos",
  genetic: "Algoritmo Genético",
  vs: "IA vs Você",
  play: "Jogar você mesmo",
};

type RaceWinner = "human" | "ai" | "tie";

// How often the AI opponent's board advances one backtracking step in "IA vs Você" - same 90ms
// cadence the regular Backtracking mode's own Timeline scrub already uses, so watching the AI race
// feels identical to watching it scrub normally, just automatic instead of user-driven.
const VS_TICK_MS = 90;

const EMPTY_BOARD = (n: number) => new Array(n).fill(-1);

export default function QueensPage() {
  const [n, setN] = useState(8);
  // Deterministic placeholder for SSR (avoids a hydration mismatch, same precedent as tsp's own
  // seed placeholder); the mount effect below immediately replaces it with a real random seed.
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState<QueensMode>("backtracking");

  const [paramsOpen, setParamsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  // Shared scrub state for the three step-array modes (backtracking/forward checking/min-conflicts)
  // - only one is ever visible at a time depending on `mode`, so one frame/playing pair covers all
  // three instead of tripling the state, the same "repurposed Timeline instance" pattern TSP already
  // uses for twoopt vs genetic.
  const [stepFrame, setStepFrame] = useState(0);
  const [stepPlaying, setStepPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Manual play: one queen per column, board[col]=row / -1, same representation every other mode
  // already uses - clicking a column's own queen removes it, clicking elsewhere in that column
  // moves it there.
  const [liveBoard, setLiveBoard] = useState<number[]>(() => EMPTY_BOARD(n));

  const resetLiveBoard = () => setLiveBoard(EMPTY_BOARD(n));

  const handleCellClick = (col: number, row: number) => {
    setLiveBoard((prev) => {
      const next = prev.slice();
      next[col] = prev[col] === row ? -1 : row;
      return next;
    });
  };

  // IA vs Você: the human places queens manually (reusing Play mode's liveBoard/handleCellClick)
  // while an independently precomputed Backtracking run plays back automatically, one placement/
  // backtrack at a time - first to reach a conflict-free, fully-placed board wins. Backtracking
  // always finds a solution for every N this page's slider allows (N >= 4), so there's no "AI struck
  // out" case to handle here.
  const [vsSteps, setVsSteps] = useState<QueensStep[] | null>(null);
  const [vsFrame, setVsFrame] = useState(0);
  const [raceWinner, setRaceWinner] = useState<RaceWinner | null>(null);

  const resetVsRace = () => {
    setVsSteps(backtrackingSteps(n));
    setVsFrame(0);
    setRaceWinner(null);
    resetLiveBoard();
  };

  const [backtrackingRun, setBacktrackingRun] = useState<QueensStep[] | null>(null);
  const [backtrackingElapsedMs, setBacktrackingElapsedMs] = useState<number | null>(null);
  const [fcRun, setFcRun] = useState<QueensStep[] | null>(null);
  const [fcElapsedMs, setFcElapsedMs] = useState<number | null>(null);
  const [mcRun, setMcRun] = useState<MinConflictsResult | null>(null);
  const [mcElapsedMs, setMcElapsedMs] = useState<number | null>(null);

  const [gaOpen, setGaOpen] = useState(false);
  const [genPickerOpen, setGenPickerOpen] = useState(false);
  const [gaConfig, setGaConfig] = useState<QueensGaFormConfig>({
    populationSize: 120,
    generations: 200,
    mutationRate: 0.15,
    crossoverRate: 0.85,
    eliteCount: 4,
    tournamentSize: 5,
    seed: randomSeed(),
  });
  const [gaRunning, setGaRunning] = useState(false);
  const [gaProgressGen, setGaProgressGen] = useState(0);
  const [gaLiveGenerations, setGaLiveGenerations] = useState<GaGenerationSummary[]>([]);
  const [gaRunResult, setGaRunResult] = useState<GaRunResult<QueensGenome> | null>(null);
  const [gaElapsedMs, setGaElapsedMs] = useState<number | null>(null);
  const [selectedGeneration, setSelectedGeneration] = useState(0);
  const [gaPlaying, setGaPlaying] = useState(false);

  // Replaces the deterministic SSR placeholder seed with a real random one once mounted on the
  // client, so every page load starts on a different min-conflicts/GA instance without risking a
  // hydration mismatch (see the placeholder's own comment above).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time swap from the SSR placeholder seed to a real random one
    setSeed(randomSeed());
  }, []);

  // New instance (N or seed changed): every run mode's result is tied to the previous instance, so
  // all of them go stale together instead of showing a board computed for a different N.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale per-instance results whenever N/seed changes
    setBacktrackingRun(null);
    setFcRun(null);
    setMcRun(null);
    setGaRunResult(null);
    setGaLiveGenerations([]);
    setGaPlaying(false);
    setStepFrame(0);
    setStepPlaying(false);
    setLiveBoard(EMPTY_BOARD(n));
    setVsSteps(null);
    setVsFrame(0);
    setRaceWinner(null);
    setMode("backtracking");
  }, [n, seed]);

  // Switching modes shouldn't carry over a frame index from a differently-sized run.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the shared scrubber when the visible mode changes
    setStepFrame(0);
    setStepPlaying(false);
  }, [mode]);

  // Entering vs mode (or resizing the board while already in it) starts a fresh race.
  useEffect(() => {
    if (mode !== "vs") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a fresh race, not a sync with external state
    resetVsRace();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetVsRace reads `n` fresh via closure each call; including it would refire on every render
  }, [mode, n]);

  // Advances the AI's board one precomputed backtracking step at a time on a fixed clock - see
  // VS_TICK_MS above for why that pace was chosen.
  useEffect(() => {
    if (mode !== "vs" || !vsSteps || raceWinner) return;
    if (vsFrame >= vsSteps.length - 1) return;
    const t = setTimeout(() => setVsFrame((f) => Math.min(f + 1, vsSteps.length - 1)), VS_TICK_MS);
    return () => clearTimeout(t);
  }, [mode, vsSteps, vsFrame, raceWinner]);

  // First side to reach a conflict-free, fully-placed board wins.
  useEffect(() => {
    if (mode !== "vs" || !vsSteps || raceWinner) return;
    const aiSolved = vsSteps[vsFrame].action === "solved";
    const humanSolved = liveBoard.every((r) => r !== -1) && conflicts(liveBoard).length === 0;
    let next: RaceWinner | null = null;
    if (humanSolved && aiSolved) next = "tie";
    else if (humanSolved) next = "human";
    else if (aiSolved) next = "ai";
    if (next) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the race-ending condition just computed above
      setRaceWinner(next);
    }
  }, [mode, vsSteps, vsFrame, liveBoard, raceWinner]);

  const runBacktracking = () => {
    const start = performance.now();
    const steps = backtrackingSteps(n);
    setBacktrackingRun(steps);
    setStepFrame(0);
    setStepPlaying(false);
    setBacktrackingElapsedMs(performance.now() - start);
  };

  const runForwardChecking = () => {
    const start = performance.now();
    const steps = forwardCheckingSteps(n);
    setFcRun(steps);
    setStepFrame(0);
    setStepPlaying(false);
    setFcElapsedMs(performance.now() - start);
  };

  const runMinConflicts = () => {
    const start = performance.now();
    const result = minConflictsSteps(n, seed);
    setMcRun(result);
    setStepFrame(0);
    setStepPlaying(false);
    setMcElapsedMs(performance.now() - start);
  };

  // Evolves gaConfig.generations generations, chunked across setTimeout(0) ticks so a large
  // population×generations run never blocks the main thread in one go - same shape already proven
  // in labirinto/goose/tsp's GA runners.
  const runGenetic = () => {
    setGaRunning(true);
    setGaRunResult(null);
    setGaLiveGenerations([]);
    setGaProgressGen(0);
    setSelectedGeneration(0);
    setGaPlaying(false);
    setMode("genetic");

    const config: GaConfig = {
      populationSize: gaConfig.populationSize,
      generations: gaConfig.generations,
      eliteCount: gaConfig.eliteCount,
      mutationRate: gaConfig.mutationRate,
      crossoverRate: gaConfig.crossoverRate,
      tournamentSize: gaConfig.tournamentSize,
      seed: gaConfig.seed,
    };
    const ops = buildQueensGaOps(n);
    const iterator = evolve(config, ops);
    const startTime = performance.now();
    const CHUNK_SIZE = 4;
    const collected: GaGenerationSummary[] = [];

    const step = () => {
      for (let i = 0; i < CHUNK_SIZE; i++) {
        const next = iterator.next();
        if (next.done) {
          const finalResult = next.value;
          setGaRunResult(finalResult);
          setGaLiveGenerations(finalResult.generations);
          setGaElapsedMs(performance.now() - startTime);
          setGaProgressGen(finalResult.generations.length);
          setGaRunning(false);
          // Land on generation 0, not the final one - pressing play should replay the whole run
          // from scratch, not require rewinding through the picker first.
          setSelectedGeneration(0);
          return;
        }
        collected.push(next.value);
      }
      setGaLiveGenerations([...collected]);
      setGaProgressGen(collected.length);
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
  };

  const runActive = () => {
    if (mode === "backtracking") runBacktracking();
    else if (mode === "forwardchecking") runForwardChecking();
    else if (mode === "minconflicts") runMinConflicts();
    else if (mode === "genetic") runGenetic();
  };

  const activeSteps: QueensStep[] | null = useMemo(() => {
    if (mode === "backtracking") return backtrackingRun;
    if (mode === "forwardchecking") return fcRun;
    if (mode === "minconflicts") return mcRun?.steps ?? null;
    return null;
  }, [mode, backtrackingRun, fcRun, mcRun]);

  // Step-array scrub: advances `playbackSpeed` events per tick, so the board visibly builds up
  // (or repairs itself) event by event, matching TSP's 2-opt scrubbing shape.
  useEffect(() => {
    if (!stepPlaying || !activeSteps) return;
    if (stepFrame >= activeSteps.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setStepPlaying(false);
      return;
    }
    const t = setTimeout(() => setStepFrame((f) => Math.min(f + playbackSpeed, activeSteps.length - 1)), 90);
    return () => clearTimeout(t);
  }, [stepPlaying, stepFrame, activeSteps, playbackSpeed]);

  // GA generation scrub: same 60ms-tick shape as tsp/page.tsx's GA scrubber.
  useEffect(() => {
    if (!gaPlaying || !gaRunResult) return;
    if (selectedGeneration >= gaRunResult.generations.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setGaPlaying(false);
      return;
    }
    const t = setTimeout(() => setSelectedGeneration((g) => Math.min(g + playbackSpeed, gaRunResult.generations.length - 1)), 60);
    return () => clearTimeout(t);
  }, [gaPlaying, selectedGeneration, gaRunResult, playbackSpeed]);

  const stepGeneration = (delta: number) => {
    if (!gaRunResult) return;
    const next = Math.max(0, Math.min(gaRunResult.generations.length - 1, selectedGeneration + delta));
    setSelectedGeneration(next);
    setGaPlaying(false);
  };

  const jumpToGeneration = (gen: number) => {
    if (!gaRunResult) return;
    const next = Math.max(0, Math.min(gaRunResult.generations.length - 1, gen));
    setSelectedGeneration(next);
    setGaPlaying(false);
    setGenPickerOpen(false);
  };

  const activeStep: QueensStep | null = activeSteps ? activeSteps[Math.min(stepFrame, activeSteps.length - 1)] : null;

  const activeBoard: number[] = useMemo(() => {
    if (mode === "play") return liveBoard;
    if (mode === "genetic") return gaRunResult?.bestPerGeneration[selectedGeneration] ?? EMPTY_BOARD(n);
    return activeStep?.board ?? EMPTY_BOARD(n);
  }, [mode, gaRunResult, selectedGeneration, activeStep, n, liveBoard]);

  const activeConflictCount = useMemo(() => conflicts(activeBoard).length, [activeBoard]);

  const queensPlaced = useMemo(() => activeBoard.filter((r) => r !== -1).length, [activeBoard]);

  const activeSolved =
    mode === "play"
      ? queensPlaced === n && activeConflictCount === 0
      : mode === "genetic"
        ? gaRunResult
          ? activeConflictCount === 0
          : false
        : activeStep?.action === "solved";

  const status = useMemo(() => {
    if (mode === "genetic") {
      return gaRunning ? "EVOLUINDO" : gaRunResult ? "CONCLUÍDO" : "AGUARDANDO EXECUÇÃO";
    }
    if (stepPlaying) return mode === "minconflicts" ? "REPARANDO" : "EXPLORANDO";
    if (!activeSteps) return "AGUARDANDO EXECUÇÃO";
    const finalAction = activeSteps[activeSteps.length - 1].action;
    return finalAction === "solved" ? "SOLUÇÃO ENCONTRADA" : "SEM SOLUÇÃO";
  }, [mode, gaRunning, gaRunResult, stepPlaying, activeSteps]);

  const runLabel =
    mode === "backtracking"
      ? "Rodar backtracking"
      : mode === "forwardchecking"
        ? "Rodar forward checking"
        : mode === "minconflicts"
          ? "Rodar min-conflitos"
          : "Rodar evolução";
  const runDisabled = mode === "genetic" && gaRunning;

  const currentStats: [string, string][] | null = useMemo(() => {
    if (mode === "genetic") {
      if (!gaRunResult) return null;
      return [
        ["Conflitos restantes", String(activeConflictCount)],
        ["Geração", String(selectedGeneration)],
        ["Tempo", gaElapsedMs !== null ? `${gaElapsedMs.toFixed(0)}ms` : "—"],
      ];
    }
    if (!activeStep) return null;
    const elapsedMs = mode === "backtracking" ? backtrackingElapsedMs : mode === "forwardchecking" ? fcElapsedMs : mcElapsedMs;
    return [
      ["Ação", activeStep.action === "solved" ? "Solução" : activeStep.action === "backtrack" ? "Backtrack" : "Colocação"],
      ["Nós expandidos", String(activeStep.nodesExpanded)],
      ["Backtracks", String(activeStep.backtracks)],
      ["Tempo total", elapsedMs !== null ? `${elapsedMs.toFixed(1)}ms` : "—"],
    ];
  }, [mode, activeStep, gaRunResult, activeConflictCount, selectedGeneration, gaElapsedMs, backtrackingElapsedMs, fcElapsedMs, mcElapsedMs]);

  const compareItems: [string, string][] = useMemo(() => {
    const stepRow = (label: string, run: QueensStep[] | null): [string, string] => {
      if (!run) return [label, "—"];
      const final = run[run.length - 1];
      const mark = final.action === "solved" ? "✓" : "✗";
      return [label, `${mark} ${final.nodesExpanded} nós, ${final.backtracks} backtracks`];
    };
    const mcRow: [string, string] = mcRun
      ? [MODE_LABELS.minconflicts, `${mcRun.solved ? "✓" : "✗"} ${mcRun.steps.length - 1} iterações`]
      : [MODE_LABELS.minconflicts, "—"];
    const gaRow: [string, string] = gaRunResult
      ? [MODE_LABELS.genetic, `${conflicts(gaRunResult.bestEverGenome).length === 0 ? "✓" : `${conflicts(gaRunResult.bestEverGenome).length} conflitos`}`]
      : [MODE_LABELS.genetic, "—"];
    return [stepRow(MODE_LABELS.backtracking, backtrackingRun), stepRow(MODE_LABELS.forwardchecking, fcRun), mcRow, gaRow];
  }, [backtrackingRun, fcRun, mcRun, gaRunResult]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>N-Rainhas</span>
            <span>/</span>
            <span className="accent">{MODE_LABELS[mode]}</span>
          </div>
          <h1 className="content-title">N-Rainhas</h1>
          <p className="content-sub">
            Posicione N rainhas num tabuleiro N×N sem que nenhuma ataque outra. Compare backtracking
            puro, forward checking com propagação de restrições, busca local por reparo de conflitos
            e um algoritmo genético.
          </p>
        </div>
        <div className="content-actions">
          {mode !== "play" && mode !== "vs" && (
            <>
              <button className="btn-pill" onClick={() => setCompareOpen(true)}>
                <Icon name="compare_arrows" className="text-[15px]" /> Comparar
              </button>
              <button className="btn-pill btn-pill-primary" onClick={runActive} disabled={runDisabled}>
                <Icon name="play_arrow" className="text-[15px]" /> {runLabel}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="workspace-card">
        <div className="workspace-head">
          <Select
            value={mode}
            onChange={(v) => setMode(v as QueensMode)}
            options={(Object.keys(MODE_LABELS) as QueensMode[]).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
            className="!w-auto shrink-0"
          />
          <div className="workspace-links">
            <button className="workspace-link" onClick={() => setParamsOpen(true)}>
              <Icon name="tune" className="text-[13px]" /> Parâmetros
            </button>
            <button className="workspace-link" onClick={() => setGaOpen(true)} disabled={mode === "play" || mode === "vs"}>
              <Icon name="psychology" className="text-[13px]" /> Genético
            </button>
            <button className="workspace-link" onClick={() => setStatsOpen(true)} disabled={mode === "play" || mode === "vs" || !currentStats}>
              <Icon name="query_stats" className="text-[13px]" /> Última execução
            </button>
          </div>
        </div>

        <div className="canvas-body">
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(217,164,65,0.06),transparent_60%)]">
            <StageHint>
              {mode === "vs" ? (
                <>
                  VOCÊ <b className="readout-glow font-semibold text-primary">{queensPlaced}/{n}</b> · IA{" "}
                  <b className="readout-glow font-semibold text-primary">
                    {vsSteps ? vsSteps[vsFrame].board.filter((r) => r !== -1).length : 0}/{n}
                  </b>
                  {raceWinner && (
                    <>
                      {" "}
                      ·{" "}
                      <b className="readout-glow font-semibold text-primary">
                        {raceWinner === "human" ? "VOCÊ VENCEU" : raceWinner === "ai" ? "A IA VENCEU" : "EMPATE"}
                      </b>
                    </>
                  )}
                </>
              ) : mode === "play" ? (
                <>
                  RAINHAS <b className="readout-glow font-semibold text-primary">{queensPlaced}/{n}</b> · CONFLITOS{" "}
                  <b className="readout-glow font-semibold text-primary">{activeConflictCount}</b>
                  {activeSolved && (
                    <>
                      {" "}
                      · <b className="readout-glow font-semibold text-primary">✓ Solução encontrada</b>
                    </>
                  )}
                </>
              ) : (
                <>
                  RAINHAS <b className="readout-glow font-semibold text-primary">{n}</b> · MODO{" "}
                  <b className="readout-glow font-semibold text-primary">{MODE_LABELS[mode]}</b> · CONFLITOS{" "}
                  <b className="readout-glow font-semibold text-primary">{activeConflictCount}</b>
                  {activeSolved && (
                    <>
                      {" "}
                      · <b className="readout-glow font-semibold text-primary">✓ Solução encontrada</b>
                    </>
                  )}
                </>
              )}
            </StageHint>
            {mode === "vs" ? (
              <div className="flex h-full w-full items-stretch justify-center gap-4">
                <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="shrink-0 font-mono text-[11px] text-on-surface-variant">VOCÊ</span>
                  <div className="min-h-0 w-full flex-1">
                    <WebGLGate>
                      <QueensCanvas n={n} board={liveBoard} solved={queensPlaced === n && activeConflictCount === 0} interactive onCellClick={handleCellClick} />
                    </WebGLGate>
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="shrink-0 font-mono text-[11px] text-on-surface-variant">IA</span>
                  <div className="min-h-0 w-full flex-1">
                    <WebGLGate>
                      <QueensCanvas n={n} board={vsSteps ? vsSteps[vsFrame].board : EMPTY_BOARD(n)} solved={!!vsSteps && vsSteps[vsFrame].action === "solved"} />
                    </WebGLGate>
                  </div>
                </div>
              </div>
            ) : (
              <WebGLGate>
                <QueensCanvas
                  n={n}
                  board={activeBoard}
                  domains={mode === "forwardchecking" ? activeStep?.domains : undefined}
                  frontierCol={mode === "forwardchecking" ? activeStep?.col : undefined}
                  solved={!!activeSolved}
                  interactive={mode === "play"}
                  onCellClick={mode === "play" ? handleCellClick : undefined}
                />
              </WebGLGate>
            )}
            {mode === "play" && queensPlaced === n && activeConflictCount > 0 && (
              <div className="board-overlay">
                <span className="board-overlay-title">VOCÊ PERDEU</span>
                <span className="board-overlay-subtitle">Todas as colunas preenchidas, mas ainda há conflitos</span>
              </div>
            )}
          </div>

          {mode === "genetic" && gaRunResult && (
            <div className="flex shrink-0 items-center justify-center gap-3 bg-background px-4 py-2 text-[11px] text-on-surface-variant">
              <button
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-on-surface transition-colors hover:bg-white/10 disabled:opacity-30"
                onClick={() => stepGeneration(-1)}
                disabled={selectedGeneration <= 0}
              >
                <Icon name="chevron_left" className="text-[16px]" />
              </button>
              <button
                onClick={() => setGenPickerOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-on-surface transition-colors hover:bg-white/10"
              >
                Geração {selectedGeneration}
                <Icon name="expand_more" className="text-[14px] text-on-surface-variant" />
              </button>
              <button
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-on-surface transition-colors hover:bg-white/10 disabled:opacity-30"
                onClick={() => stepGeneration(1)}
                disabled={selectedGeneration >= gaRunResult.generations.length - 1}
              >
                <Icon name="chevron_right" className="text-[16px]" />
              </button>
            </div>
          )}

          {mode === "play" ? (
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 bg-background px-4 sm:px-5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${activeSolved ? "" : "animate-pulse"}`} style={{ background: "var(--tertiary)" }} />
                {activeSolved
                  ? "SOLUÇÃO VÁLIDA — NENHUMA RAINHA SE ATACA"
                  : "CLIQUE NUMA CASA PARA COLOCAR OU REMOVER UMA RAINHA"}
              </span>
              <button className="btn-pill" onClick={resetLiveBoard}>
                <Icon name="refresh" className="text-[15px]" /> Novo tabuleiro
              </button>
            </div>
          ) : mode === "vs" ? (
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 bg-background px-4 sm:px-5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${!raceWinner ? "animate-pulse" : ""}`} style={{ background: "var(--tertiary)" }} />
                {raceWinner === "human"
                  ? "VOCÊ VENCEU A CORRIDA"
                  : raceWinner === "ai"
                    ? "A IA VENCEU A CORRIDA"
                    : raceWinner === "tie"
                      ? "EMPATE — OS DOIS TERMINARAM JUNTOS"
                      : "QUEM POSICIONAR TODAS AS RAINHAS SEM CONFLITO PRIMEIRO VENCE"}
              </span>
              <button className="btn-pill" onClick={resetVsRace}>
                <Icon name="refresh" className="text-[15px]" /> Nova corrida
              </button>
            </div>
          ) : mode === "genetic" ? (
            <Timeline
              status={status}
              pulsing={gaPlaying}
              playing={gaPlaying}
              onTogglePlay={() => setGaPlaying((p) => !p)}
              onSkipEnd={() => {
                if (!gaRunResult) return;
                setSelectedGeneration(gaRunResult.generations.length - 1);
                setGaPlaying(false);
              }}
              current={selectedGeneration}
              total={gaRunResult?.generations.length ?? 0}
              unitLabel="gerações"
              disabled={!gaRunResult}
              speed={playbackSpeed}
              onSpeedChange={setPlaybackSpeed}
              speedLabel="Velocidade"
              speedMin={1}
              speedMax={30}
            />
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
              speedMax={30}
            />
          )}
        </div>
      </div>

      <GeneticModal
        open={gaOpen}
        onClose={() => setGaOpen(false)}
        config={gaConfig}
        onConfigChange={(patch) => setGaConfig((c) => ({ ...c, ...patch }))}
        running={gaRunning}
        progressGeneration={gaProgressGen}
        liveGenerations={gaLiveGenerations}
        onRun={runGenetic}
        runResult={gaRunResult}
        elapsedMs={gaElapsedMs}
      />

      <Modal open={genPickerOpen} onClose={() => setGenPickerOpen(false)} title="Escolher geração" wide>
        {gaRunResult && (
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {gaRunResult.generations.map((_, i) => (
              <button
                key={i}
                onClick={() => jumpToGeneration(i)}
                className={`rounded-lg border px-2 py-1.5 font-mono text-[12px] transition-colors ${
                  i === selectedGeneration
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-white/10 bg-white/5 text-on-surface hover:bg-white/10"
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={statsOpen} onClose={() => setStatsOpen(false)} title="Última execução">
        {currentStats && <StatGrid cols={2} items={currentStats} />}
      </Modal>

      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Comparação entre modos"
        subtitle="Mesma instância para todos — rode cada modo para preencher a comparação"
        wide
      >
        <StatGrid cols={3} items={compareItems} />
      </Modal>

      <Modal open={paramsOpen} onClose={() => setParamsOpen(false)} title="Parâmetros" subtitle="Tamanho do tabuleiro e seed da instância">
        <Field label={`Rainhas (N): ${n}`}>
          <input type="range" min={4} max={16} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </Field>
        <div className="border-t border-outline-variant pt-4">
          <Field label="Seed">
            <div className="flex items-center gap-2">
              <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="w-full" />
              <button className="btn btn-secondary !px-2.5" onClick={() => setSeed(randomSeed())} title="Novo seed aleatório">
                <Icon name="casino" className="text-[16px]" />
              </button>
            </div>
          </Field>
        </div>
        <p className="text-[11px] leading-relaxed text-on-surface-variant">
          A seed alimenta a inicialização aleatória do Min-Conflitos e o embaralhamento inicial do
          Algoritmo Genético — backtracking e forward checking são determinísticos, sempre exploram na
          mesma ordem.
        </p>
      </Modal>
    </div>
  );
}
