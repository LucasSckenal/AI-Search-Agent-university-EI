"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, Icon } from "@/components/shared/Panel";
import { Modal } from "@/components/shared/Modal";
import { Select } from "@/components/shared/Select";
import { StageHint } from "@/components/shared/Stage";
import { StatGrid } from "@/components/shared/StatGrid";
import { Timeline } from "@/components/shared/Timeline";
import { SudokuGrid } from "@/components/sudoku/SudokuGrid";
import { randomSeed } from "@/lib/core/rng";
import {
  ac3Steps,
  backtrackingSteps,
  colOf,
  conflictCells,
  Difficulty,
  DIFFICULTY_CLUES,
  DIFFICULTY_LABELS,
  Digit,
  forwardCheckingSteps,
  generatePuzzle,
  isComplete,
  rowOf,
  SIZE,
  SudokuStep,
} from "@/lib/sudoku/model";

type SudokuMode = "play" | "backtracking" | "forwardchecking" | "ac3";

const MODE_LABELS: Record<SudokuMode, string> = {
  play: "Jogar você mesmo",
  backtracking: "Backtracking",
  forwardchecking: "Forward Checking",
  ac3: "AC-3 + Backtracking",
};

const PAD_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export default function SudokuPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>("medio");
  // Deterministic placeholder for SSR (avoids a hydration mismatch, same precedent as N-Rainhas'
  // own seed placeholder); the mount effect below immediately replaces it with a real random seed.
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState<SudokuMode>("play");

  const generated = useMemo(() => generatePuzzle(seed, DIFFICULTY_CLUES[difficulty]), [seed, difficulty]);
  const givenMask = useMemo(() => generated.puzzle.map((v) => v !== 0), [generated]);
  const firstEditableIndex = useMemo(() => {
    const idx = givenMask.findIndex((g) => !g);
    return idx === -1 ? null : idx;
  }, [givenMask]);

  const [liveGrid, setLiveGrid] = useState<Digit[]>(() => generated.puzzle.slice());
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const [paramsOpen, setParamsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  // Shared scrub state for the three step-array modes (backtracking/forward checking/AC-3) - only
  // one is ever visible at a time depending on `mode`, so one frame/playing pair covers all three,
  // the same "repurposed Timeline instance" pattern N-Rainhas/TSP already use.
  const [stepFrame, setStepFrame] = useState(0);
  const [stepPlaying, setStepPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const [backtrackingRun, setBacktrackingRun] = useState<SudokuStep[] | null>(null);
  const [backtrackingElapsedMs, setBacktrackingElapsedMs] = useState<number | null>(null);
  const [fcRun, setFcRun] = useState<SudokuStep[] | null>(null);
  const [fcElapsedMs, setFcElapsedMs] = useState<number | null>(null);
  const [ac3Run, setAc3Run] = useState<SudokuStep[] | null>(null);
  const [ac3ElapsedMs, setAc3ElapsedMs] = useState<number | null>(null);

  const [compare, setCompare] = useState<{
    backtracking: SudokuStep[];
    forwardchecking: SudokuStep[];
    ac3: SudokuStep[];
    backtrackingMs: number;
    forwardcheckingMs: number;
    ac3Ms: number;
  } | null>(null);

  // Replaces the deterministic SSR placeholder seed with a real random one once mounted on the
  // client, so every page load starts on a different puzzle instance without risking a hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time swap from the SSR placeholder seed to a real random one
    setSeed(randomSeed());
  }, []);

  // New instance (difficulty or seed changed): every run mode's result is tied to the previous
  // instance, so all of them go stale together instead of showing a trace computed for another puzzle.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale per-instance results whenever the puzzle changes
    setLiveGrid(generated.puzzle.slice());
    setFocusedIndex(null);
    setBacktrackingRun(null);
    setFcRun(null);
    setAc3Run(null);
    setCompare(null);
    setStepFrame(0);
    setStepPlaying(false);
  }, [generated]);

  // Switching modes shouldn't carry over a frame index from a different algorithm's run.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the shared scrubber when the visible mode changes
    setStepFrame(0);
    setStepPlaying(false);
  }, [mode]);

  // Step-array scrub: advances `playbackSpeed` events per tick, matching N-Rainhas/TSP's own pacing.
  const activeSteps: SudokuStep[] | null = mode === "backtracking" ? backtrackingRun : mode === "forwardchecking" ? fcRun : mode === "ac3" ? ac3Run : null;

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

  const activeStep: SudokuStep | null = activeSteps ? activeSteps[Math.min(stepFrame, activeSteps.length - 1)] : null;
  const activeGrid: Digit[] = mode === "play" ? liveGrid : (activeStep?.grid ?? generated.puzzle);

  const conflicts = useMemo(() => conflictCells(liveGrid), [liveGrid]);
  const complete = useMemo(() => isComplete(liveGrid), [liveGrid]);

  const writeDigit = (i: number, d: Digit) => {
    if (givenMask[i]) return;
    setLiveGrid((prev) => {
      const next = prev.slice();
      next[i] = d;
      return next;
    });
  };

  const handleCellClick = (i: number) => {
    setFocusedIndex(i);
  };

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (focusedIndex === null) return;
    if (e.key >= "1" && e.key <= "9") {
      e.preventDefault();
      writeDigit(focusedIndex, Number(e.key) as Digit);
      return;
    }
    if (e.key === "0" || e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      writeDigit(focusedIndex, 0);
      return;
    }
    const row = rowOf(focusedIndex);
    const col = colOf(focusedIndex);
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        if (col > 0) setFocusedIndex(focusedIndex - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (col < SIZE - 1) setFocusedIndex(focusedIndex + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (row > 0) setFocusedIndex(focusedIndex - SIZE);
        break;
      case "ArrowDown":
        e.preventDefault();
        if (row < SIZE - 1) setFocusedIndex(focusedIndex + SIZE);
        break;
    }
  };

  const runBacktracking = () => {
    const start = performance.now();
    const steps = backtrackingSteps(generated.puzzle);
    setBacktrackingRun(steps);
    setStepFrame(0);
    setStepPlaying(false);
    setBacktrackingElapsedMs(performance.now() - start);
  };
  const runForwardChecking = () => {
    const start = performance.now();
    const steps = forwardCheckingSteps(generated.puzzle);
    setFcRun(steps);
    setStepFrame(0);
    setStepPlaying(false);
    setFcElapsedMs(performance.now() - start);
  };
  const runAc3 = () => {
    const start = performance.now();
    const steps = ac3Steps(generated.puzzle);
    setAc3Run(steps);
    setStepFrame(0);
    setStepPlaying(false);
    setAc3ElapsedMs(performance.now() - start);
  };
  const runActive = () => {
    if (mode === "backtracking") runBacktracking();
    else if (mode === "forwardchecking") runForwardChecking();
    else if (mode === "ac3") runAc3();
  };
  const runLabel = mode === "backtracking" ? "Rodar backtracking" : mode === "forwardchecking" ? "Rodar forward checking" : "Rodar AC-3";

  const runComparison = () => {
    // Times each algorithm itself rather than reusing backtrackingElapsedMs/fcElapsedMs/ac3ElapsedMs
    // - those only get set by the individual "Rodar X" button for the currently-selected mode, so
    // relying on them here would show "-" for any algorithm the user hasn't run standalone yet.
    let start = performance.now();
    const backtracking = backtrackingSteps(generated.puzzle);
    const backtrackingMs = performance.now() - start;

    start = performance.now();
    const forwardchecking = forwardCheckingSteps(generated.puzzle);
    const forwardcheckingMs = performance.now() - start;

    start = performance.now();
    const ac3 = ac3Steps(generated.puzzle);
    const ac3Ms = performance.now() - start;

    setCompare({ backtracking, forwardchecking, ac3, backtrackingMs, forwardcheckingMs, ac3Ms });
    setCompareOpen(true);
  };

  const status = useMemo(() => {
    if (mode === "play") return complete ? "GRADE COMPLETA" : "PREENCHENDO";
    if (stepPlaying) return "EXPLORANDO";
    if (!activeSteps) return "AGUARDANDO EXECUÇÃO";
    const finalAction = activeSteps[activeSteps.length - 1].action;
    return finalAction === "solved" ? "SOLUÇÃO ENCONTRADA" : "SEM SOLUÇÃO";
  }, [mode, complete, stepPlaying, activeSteps]);

  const currentStats: [string, string][] | null = useMemo(() => {
    if (!activeStep) return null;
    const elapsedMs = mode === "backtracking" ? backtrackingElapsedMs : mode === "forwardchecking" ? fcElapsedMs : ac3ElapsedMs;
    const rows: [string, string][] = [
      [
        "Ação",
        activeStep.action === "solved"
          ? "Solução"
          : activeStep.action === "backtrack"
            ? "Backtrack"
            : activeStep.action === "propagate"
              ? "Propagação AC-3"
              : "Colocação",
      ],
      ["Nós expandidos", String(activeStep.nodesExpanded)],
      ["Backtracks", String(activeStep.backtracks)],
      ["Tempo total", elapsedMs !== null ? `${elapsedMs.toFixed(1)}ms` : "—"],
    ];
    if (mode === "ac3" && ac3Run) rows.push(["Revisões AC-3", String(ac3Run[0]?.revisions ?? 0)]);
    return rows;
  }, [mode, activeStep, backtrackingElapsedMs, fcElapsedMs, ac3ElapsedMs, ac3Run]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Sudoku</span>
            <span>/</span>
            <span className="accent">{MODE_LABELS[mode]}</span>
          </div>
          <h1 className="content-title">Sudoku</h1>
          <p className="content-sub">
            Preencha a grade 9×9 sem repetir dígitos em linha, coluna ou bloco 3×3. Compare
            backtracking puro, forward checking e AC-3 — consistência de arco por propagação de
            restrições —, ou jogue você mesmo.
          </p>
        </div>
        <div className="content-actions">
          {mode !== "play" && (
            <>
              <button className="btn-pill" onClick={runComparison}>
                <Icon name="compare_arrows" className="text-[15px]" /> Comparar
              </button>
              <button className="btn-pill btn-pill-primary" onClick={runActive}>
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
            onChange={(v) => setMode(v as SudokuMode)}
            options={(Object.keys(MODE_LABELS) as SudokuMode[]).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
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
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(91,141,239,0.06),transparent_60%)]">
            <StageHint>
              GRADE <b className="readout-glow font-semibold text-primary">9×9</b> · PISTAS{" "}
              <b className="readout-glow font-semibold text-primary">{generated.clues}</b> · DIFICULDADE{" "}
              <b className="readout-glow font-semibold text-primary">{DIFFICULTY_LABELS[difficulty]}</b>
              {mode === "play" && (
                <>
                  {" "}
                  · CONFLITOS <b className="readout-glow font-semibold text-primary">{conflicts.size}</b>
                  {complete && (
                    <>
                      {" "}
                      · <b className="readout-glow font-semibold text-primary">✓ Solução encontrada</b>
                    </>
                  )}
                </>
              )}
            </StageHint>
            <div
              className="flex h-full w-full items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70"
              tabIndex={0}
              role="application"
              aria-label="Grade de Sudoku. Clique numa célula e digite 1 a 9 para preencher, ou use as setas para mover o cursor."
              onKeyDown={mode === "play" ? handleGridKeyDown : undefined}
              onFocus={() => mode === "play" && setFocusedIndex((i) => i ?? firstEditableIndex)}
            >
              <SudokuGrid
                grid={activeGrid}
                givenMask={givenMask}
                conflicts={mode === "play" ? conflicts : undefined}
                focusedIndex={mode === "play" ? focusedIndex : null}
                frontierIndex={mode !== "play" ? (activeStep?.index ?? null) : null}
                domains={mode !== "play" ? activeStep?.domains : undefined}
                interactive={mode === "play"}
                onCellClick={mode === "play" ? handleCellClick : undefined}
                overlay={mode === "play" && complete ? { title: "VOCÊ VENCEU", subtitle: "Grade completa sem conflitos" } : null}
              />
            </div>
            {mode === "play" && (
              <div className="sudoku-padpad">
                {PAD_DIGITS.map((d) => (
                  <button
                    key={d}
                    className="sudoku-padpad-btn"
                    onClick={() => focusedIndex !== null && writeDigit(focusedIndex, d)}
                    disabled={focusedIndex === null || givenMask[focusedIndex]}
                  >
                    {d}
                  </button>
                ))}
                <button
                  className="sudoku-padpad-btn sudoku-padpad-btn-clear"
                  onClick={() => focusedIndex !== null && writeDigit(focusedIndex, 0)}
                  disabled={focusedIndex === null || givenMask[focusedIndex]}
                  aria-label="Apagar célula"
                >
                  <Icon name="backspace" className="text-[16px]" />
                </button>
              </div>
            )}
          </div>

          {mode === "play" ? (
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 bg-background px-4 sm:px-5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${complete ? "" : "animate-pulse"}`} style={{ background: "var(--tertiary)" }} />
                {complete ? "GRADE COMPLETA — SEM CONFLITOS" : "CLIQUE NUMA CÉLULA E DIGITE 1-9 PARA PREENCHER"}
              </span>
              <button className="btn-pill" onClick={() => setLiveGrid(generated.puzzle.slice())}>
                <Icon name="refresh" className="text-[15px]" /> Limpar respostas
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
              speedMax={30}
            />
          )}
        </div>
      </div>

      <Modal open={statsOpen} onClose={() => setStatsOpen(false)} title="Última execução">
        {currentStats && <StatGrid cols={2} items={currentStats} />}
      </Modal>

      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Backtracking vs. Forward Checking vs. AC-3"
        subtitle="Mesmo puzzle para os três — a comparação isola o efeito da propagação de restrições"
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
                  <th className="px-2 py-2 text-right font-medium">Nós expandidos</th>
                  <th className="px-2 py-2 text-right font-medium">Backtracks</th>
                  <th className="px-2 py-2 text-right font-medium">Revisões AC-3</th>
                  <th className="px-2 py-2 text-right font-medium">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    { label: MODE_LABELS.backtracking, steps: compare.backtracking, ms: compare.backtrackingMs },
                    { label: MODE_LABELS.forwardchecking, steps: compare.forwardchecking, ms: compare.forwardcheckingMs },
                    { label: MODE_LABELS.ac3, steps: compare.ac3, ms: compare.ac3Ms },
                  ] satisfies { label: string; steps: SudokuStep[]; ms: number }[]
                ).map(({ label, steps, ms }) => {
                  const final = steps[steps.length - 1];
                  const revisions = steps[0].action === "propagate" ? steps[0].revisions : undefined;
                  return (
                    <tr key={label} className="border-b border-white/5">
                      <td className="px-2 py-2">{label}</td>
                      <td className="px-2 py-2 text-right font-mono">{final.nodesExpanded.toLocaleString("pt-BR")}</td>
                      <td className="px-2 py-2 text-right font-mono">{final.backtracks.toLocaleString("pt-BR")}</td>
                      <td className="px-2 py-2 text-right font-mono">{revisions !== undefined ? revisions.toLocaleString("pt-BR") : "—"}</td>
                      <td className="px-2 py-2 text-right font-mono">{ms.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal open={paramsOpen} onClose={() => setParamsOpen(false)} title="Parâmetros" subtitle="Dificuldade e seed da instância">
        <Field label="Dificuldade">
          <Select
            value={difficulty}
            onChange={(v) => setDifficulty(v as Difficulty)}
            options={(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }))}
          />
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
          A seed controla qual puzzle é gerado. Backtracking, Forward Checking e AC-3 são
          determinísticos — sempre exploram na mesma ordem para o mesmo puzzle.
        </p>
      </Modal>
    </div>
  );
}
