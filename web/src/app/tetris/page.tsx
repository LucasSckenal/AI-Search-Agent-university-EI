"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Field, Icon } from "@/components/shared/Panel";
import { Modal } from "@/components/shared/Modal";
import { Select } from "@/components/shared/Select";
import { StageHint } from "@/components/shared/Stage";
import { StatGrid } from "@/components/shared/StatGrid";
import { Timeline } from "@/components/shared/Timeline";
import { randomSeed } from "@/lib/core/rng";
import { evolve, GaGenerationSummary, GaRunResult } from "@/lib/core/genetic";
import { FallingPiece, TetrisGrid, TetrisPiecePreview } from "@/components/tetris/TetrisGrid";
import { TetrisGeneticModal, TetrisGaFormConfig } from "@/components/tetris/TetrisGeneticModal";
import { buildTetrisGaOps } from "@/lib/tetris/genetic";
import {
  ActivePiece,
  Board,
  DEFAULT_WEIGHTS,
  dropIntervalMs,
  emptyBoard,
  hardDropTarget,
  HeuristicWeights,
  levelForLines,
  lockPiece,
  lineScore,
  makePieceQueue,
  PieceType,
  runGame,
  spawnPiece,
  TetrisResult,
  tryMove,
  tryRotate,
} from "@/lib/tetris/model";

type TetrisMode = "greedy" | "genetic" | "vs" | "play";

const MODE_LABELS: Record<TetrisMode, string> = {
  greedy: "Heurística Gulosa",
  genetic: "Algoritmo Genético",
  vs: "IA vs Você",
  play: "Jogar você mesmo",
};

type RaceWinner = "human" | "ai" | "tie";

// Safety cap on pieces placed, not a target - a real run ends when the board tops out well before
// this, same role as 2048's MAX_MOVES.
const MAX_PIECES = 400;

// IA vs Você: AI places one piece every this many ms, on a fixed clock instead of instantly - same
// idea as 2048/goose/rainhas's own race pacing, just tuned to Tetris's own rhythm (roughly a level-1
// gravity drop) instead of reusing any of those pages' numbers verbatim.
const AI_RACE_TICK_MS = 650;

// Greedy/Genetic playback: one piece advances every this many ms per unit of `playbackSpeed` (so
// speed 1 = one piece every SCRUB_TICK_MS). Sized to comfortably outlast fallDurationMs's longest
// drop so the falling-piece animation always finishes before the next piece starts, instead of
// being cut off mid-fall - matches the reasoning behind 2048's own MOVE_ANIMATION_MS-paced tick.
const SCRUB_TICK_MS = 550;

interface LiveTetris {
  board: Board;
  activePiece: ActivePiece | null;
  nextType: PieceType | null;
  score: number;
  lines: number;
  level: number;
  over: boolean;
}

// Scales a fall's CSS transition duration by how far the piece actually drops, so a 1-row settle
// isn't stretched as long as a 19-row one, clamped to stay comfortably inside both SCRUB_TICK_MS
// and AI_RACE_TICK_MS.
function fallDurationMs(landingY: number): number {
  return Math.min(420, Math.max(110, landingY * 16));
}

export default function TetrisPage() {
  // Deterministic placeholder for SSR (avoids a hydration mismatch, same precedent as tsp/2048's
  // own seed placeholder); the mount effect below immediately replaces it with a real random seed.
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState<TetrisMode>("greedy");

  const [paramsOpen, setParamsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [gaOpen, setGaOpen] = useState(false);

  const [result, setResult] = useState<TetrisResult | null>(null);
  const [resultKind, setResultKind] = useState<TetrisMode | null>(null);
  const [running, setRunning] = useState(false);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Algoritmo Genético: evolves the heuristic's weight vector - the exact same zero-lookahead
  // straight-drop placement choice as Heurística Gulosa, just with evolved weights instead of the
  // hand-picked DEFAULT_WEIGHTS, same idea as 2048's Genetic mode.
  const [gaConfig, setGaConfig] = useState<TetrisGaFormConfig>({
    populationSize: 40,
    generations: 40,
    mutationRate: 0.25,
    crossoverRate: 0.8,
    eliteCount: 3,
    tournamentSize: 4,
    evalMaxPieces: 150,
    seed: 1,
  });
  const [gaRunning, setGaRunning] = useState(false);
  const [gaProgressGen, setGaProgressGen] = useState(0);
  const [gaLiveGenerations, setGaLiveGenerations] = useState<GaGenerationSummary[]>([]);
  const [gaRunResult, setGaRunResult] = useState<GaRunResult<HeuristicWeights> | null>(null);
  const [gaElapsedMs, setGaElapsedMs] = useState<number | null>(null);

  // Manual play: a real live game state driven by gravity + keyboard/touch input, separate from the
  // precomputed-then-scrubbed step arrays the AI modes use. Reused as-is by "vs" mode.
  const queueRef = useRef(makePieceQueue(1));
  const [live, setLive] = useState<LiveTetris>({
    board: emptyBoard(),
    activePiece: null,
    nextType: null,
    score: 0,
    lines: 0,
    level: 1,
    over: false,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time swap from the SSR placeholder seed to a real random one
    setSeed(randomSeed());
    setGaConfig((c) => ({ ...c, seed: randomSeed() }));
  }, []);

  // Accepts an explicit seed so "IA vs Você" can hand the human and the AI opponent the exact same
  // piece sequence (fair race) - Play mode just omits it and gets a fresh random one.
  const resetLiveGame = (raceSeed?: number) => {
    queueRef.current = makePieceQueue(raceSeed ?? randomSeed());
    const board = emptyBoard();
    const firstType = queueRef.current.next();
    const piece = spawnPiece(board, firstType);
    const nextType = queueRef.current.next();
    setLive({ board, activePiece: piece, nextType, score: 0, lines: 0, level: 1, over: piece === null });
  };

  useEffect(() => {
    if (mode !== "play") return;
    resetLiveGame();
  }, [mode]);

  // Locks the active piece into the board, clears lines, scores, and spawns the next piece from the
  // shared queue - used by both the gravity tick (piece can't fall further) and manual hard drop.
  const lockAndAdvance = (prev: LiveTetris): LiveTetris => {
    if (!prev.activePiece) return prev;
    const { board: locked, linesCleared } = lockPiece(prev.board, prev.activePiece);
    const scoreDelta = lineScore(linesCleared);
    const lines = prev.lines + linesCleared;
    const type = prev.nextType;
    const nextType = queueRef.current.next();
    const piece = type ? spawnPiece(locked, type) : null;
    return {
      board: locked,
      activePiece: piece,
      nextType,
      score: prev.score + scoreDelta,
      lines,
      level: levelForLines(lines),
      over: piece === null,
    };
  };

  // Gravity: the active piece falls one row every dropIntervalMs(level) - restarts the interval
  // whenever level/over changes so speed ramps up as lines clear.
  useEffect(() => {
    if ((mode !== "play" && mode !== "vs") || live.over) return;
    const t = setInterval(() => {
      setLive((prev) => {
        if (prev.over || !prev.activePiece) return prev;
        const moved = tryMove(prev.board, prev.activePiece, 0, 1);
        if (moved) return { ...prev, activePiece: moved };
        return lockAndAdvance(prev);
      });
    }, dropIntervalMs(live.level));
    return () => clearInterval(t);
  }, [mode, live.level, live.over]);

  useEffect(() => {
    if (mode !== "play" && mode !== "vs") return;
    const onKey = (e: KeyboardEvent) => {
      if (live.over) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setLive((prev) => {
          if (prev.over || !prev.activePiece) return prev;
          const moved = tryMove(prev.board, prev.activePiece, -1, 0);
          return moved ? { ...prev, activePiece: moved } : prev;
        });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setLive((prev) => {
          if (prev.over || !prev.activePiece) return prev;
          const moved = tryMove(prev.board, prev.activePiece, 1, 0);
          return moved ? { ...prev, activePiece: moved } : prev;
        });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setLive((prev) => {
          if (prev.over || !prev.activePiece) return prev;
          const moved = tryMove(prev.board, prev.activePiece, 0, 1);
          return moved ? { ...prev, activePiece: moved } : lockAndAdvance(prev);
        });
      } else if ((e.key === "ArrowUp" || e.key === "x" || e.key === "X") && !e.repeat) {
        e.preventDefault();
        setLive((prev) => {
          if (prev.over || !prev.activePiece) return prev;
          const rotated = tryRotate(prev.board, prev.activePiece, 1);
          return rotated ? { ...prev, activePiece: rotated } : prev;
        });
      } else if ((e.key === "z" || e.key === "Z") && !e.repeat) {
        e.preventDefault();
        setLive((prev) => {
          if (prev.over || !prev.activePiece) return prev;
          const rotated = tryRotate(prev.board, prev.activePiece, -1);
          return rotated ? { ...prev, activePiece: rotated } : prev;
        });
      } else if (e.key === " " && !e.repeat) {
        e.preventDefault();
        setLive((prev) => {
          if (prev.over || !prev.activePiece) return prev;
          const dropped = hardDropTarget(prev.board, prev.activePiece);
          return lockAndAdvance({ ...prev, activePiece: dropped });
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, live.over]);

  const touchMove = (dx: number) => {
    setLive((prev) => {
      if (prev.over || !prev.activePiece) return prev;
      const moved = tryMove(prev.board, prev.activePiece, dx, 0);
      return moved ? { ...prev, activePiece: moved } : prev;
    });
  };
  const touchSoftDrop = () => {
    setLive((prev) => {
      if (prev.over || !prev.activePiece) return prev;
      const moved = tryMove(prev.board, prev.activePiece, 0, 1);
      return moved ? { ...prev, activePiece: moved } : lockAndAdvance(prev);
    });
  };
  const touchRotate = () => {
    setLive((prev) => {
      if (prev.over || !prev.activePiece) return prev;
      const rotated = tryRotate(prev.board, prev.activePiece, 1);
      return rotated ? { ...prev, activePiece: rotated } : prev;
    });
  };
  const touchHardDrop = () => {
    setLive((prev) => {
      if (prev.over || !prev.activePiece) return prev;
      const dropped = hardDropTarget(prev.board, prev.activePiece);
      return lockAndAdvance({ ...prev, activePiece: dropped });
    });
  };

  // IA vs Você: the human's live board (Play mode's own state/input) races a precomputed Heurística
  // Gulosa run - always available with no setup, unlike Genetic which needs an evolution run first -
  // both started from one shared seed so neither side gets an easier piece sequence. The AI's steps
  // then play back one piece per AI_RACE_TICK_MS instead of instantly.
  const [aiVs, setAiVs] = useState<TetrisResult | null>(null);
  const [aiVsFrame, setAiVsFrame] = useState(0);
  const [raceWinner, setRaceWinner] = useState<RaceWinner | null>(null);

  const resetVsRace = () => {
    const raceSeed = randomSeed();
    resetLiveGame(raceSeed);
    setAiVs(runGameWrapped(DEFAULT_WEIGHTS, raceSeed));
    setAiVsFrame(0);
    setRaceWinner(null);
  };

  useEffect(() => {
    if (mode !== "vs") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- entering vs mode starts a fresh race, not a sync with external state
    resetVsRace();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetVsRace reads no reactive state; only mode entry should trigger it
  }, [mode]);

  // Advances the AI's board one precomputed piece at a time on a fixed clock instead of showing the
  // (near-instant) full result immediately - see AI_RACE_TICK_MS above.
  useEffect(() => {
    if (mode !== "vs" || !aiVs || raceWinner) return;
    if (aiVsFrame >= aiVs.steps.length) return;
    const t = setTimeout(() => setAiVsFrame((f) => Math.min(f + 1, aiVs.steps.length)), AI_RACE_TICK_MS);
    return () => clearTimeout(t);
  }, [mode, aiVs, aiVsFrame, raceWinner]);

  // Neither side has a fixed "win" line in Tetris (no 2048-style target tile) - the race ends once
  // both sides are done (human topped out, AI finished its run), decided by final score.
  useEffect(() => {
    if (mode !== "vs" || !aiVs || raceWinner) return;
    const humanDone = live.over;
    const aiDone = aiVsFrame >= aiVs.steps.length;
    if (humanDone && aiDone) {
      const next: RaceWinner = live.score === aiVs.finalScore ? "tie" : live.score > aiVs.finalScore ? "human" : "ai";
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the race-ending condition just computed above
      setRaceWinner(next);
    }
  }, [mode, aiVs, aiVsFrame, live.over, live.score, raceWinner]);

  // A result only stays "active" while it still matches the current controls - changing mode or
  // seed hides the stale run until "Rodar" is pressed again, same idea as 2048's activeResult.
  const activeResult = useMemo(() => {
    if (!result || resultKind !== mode) return null;
    if (result.config.seed !== seed) return null;
    return result;
  }, [result, resultKind, mode, seed]);

  // Wrapped in setTimeout so the "Calculando…" state paints before the (possibly multi-second,
  // synchronous) self-play run blocks the main thread - same pause-point pattern as 2048's runActive.
  const runActive = () => {
    if (mode !== "greedy") return;
    setRunning(true);
    setPlaying(false);
    setTimeout(() => {
      const r = runGameWrapped(DEFAULT_WEIGHTS, seed);
      setResult(r);
      setResultKind("greedy");
      setFrame(0);
      setRunning(false);
    }, 20);
  };

  // Evolves gaConfig.generations generations, chunked across setTimeout(0) ticks so a large
  // population×generations run never blocks the main thread in one go - same shape proven in
  // tsp/labirinto/goose/2048's GA runners. Once evolution finishes, the best genome plays one real
  // full-length showcase game, which lands in the same `result`/Timeline the greedy mode uses.
  const runGenetic = () => {
    setGaRunning(true);
    setGaRunResult(null);
    setGaLiveGenerations([]);
    setGaProgressGen(0);
    setMode("genetic");

    const ops = buildTetrisGaOps({ seed: gaConfig.seed, maxPieces: gaConfig.evalMaxPieces });
    const iterator = evolve(
      {
        populationSize: gaConfig.populationSize,
        generations: gaConfig.generations,
        eliteCount: gaConfig.eliteCount,
        mutationRate: gaConfig.mutationRate,
        crossoverRate: gaConfig.crossoverRate,
        tournamentSize: gaConfig.tournamentSize,
        seed: gaConfig.seed,
      },
      ops
    );
    const startTime = performance.now();
    const CHUNK_SIZE = 2;
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
          const showcase = runGameWrapped(finalResult.bestEverGenome, seed);
          setResult(showcase);
          setResultKind("genetic");
          setFrame(0);
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

  // Piece scrub: advances `playbackSpeed` pieces every SCRUB_TICK_MS - see that constant's comment
  // for why the tick is as long as it is (letting the per-piece fall animation actually play out).
  useEffect(() => {
    if (!playing || !activeResult) return;
    if (frame >= activeResult.steps.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setFrame((f) => Math.min(f + playbackSpeed, activeResult.steps.length)), SCRUB_TICK_MS);
    return () => clearTimeout(t);
  }, [playing, frame, activeResult, playbackSpeed]);

  // Falling-piece animation (greedy/genetic scrub): only animates a single-step advance (autoplay at
  // speed 1, or a one-step scrub) - a multi-step jump (skip, faster speeds, dragging the scrubber)
  // just snaps straight to the new locked board, same tradeoff every other page's scrub makes for
  // jumps vs its per-step animation.
  const [fallingPiece, setFallingPiece] = useState<FallingPiece | null>(null);
  const lastFrameRef = useRef(0);

  useEffect(() => {
    if (mode === "play" || mode === "vs" || !activeResult) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing a stale animation when leaving/never-entering an AI scrub mode, not a sync loop
      setFallingPiece(null);
      lastFrameRef.current = frame;
      return;
    }
    const prevFrame = lastFrameRef.current;
    lastFrameRef.current = frame;
    if (frame === prevFrame + 1 && frame >= 1) {
      const step = activeResult.steps[frame - 1];
      const fallMs = fallDurationMs(step.y);
      setFallingPiece({ type: step.pieceType, rotation: step.rotation, x: step.x, y: 0, fallMs: 1 });
      let raf1 = 0;
      let raf2 = 0;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setFallingPiece((prev) => (prev ? { ...prev, y: step.y, fallMs } : prev));
        });
      });
      const t = setTimeout(() => setFallingPiece(null), fallMs + 40);
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
        clearTimeout(t);
      };
    }
    setFallingPiece(null);
  }, [frame, activeResult, mode]);

  // Same falling-piece animation, driven by the AI opponent's own step clock in vs mode.
  const [aiFallingPiece, setAiFallingPiece] = useState<FallingPiece | null>(null);
  const lastAiVsFrameRef = useRef(0);

  useEffect(() => {
    if (mode !== "vs" || !aiVs) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing a stale animation when leaving/never-entering vs mode, not a sync loop
      setAiFallingPiece(null);
      lastAiVsFrameRef.current = aiVsFrame;
      return;
    }
    const prevFrame = lastAiVsFrameRef.current;
    lastAiVsFrameRef.current = aiVsFrame;
    if (aiVsFrame === prevFrame + 1 && aiVsFrame >= 1) {
      const step = aiVs.steps[aiVsFrame - 1];
      const fallMs = fallDurationMs(step.y);
      setAiFallingPiece({ type: step.pieceType, rotation: step.rotation, x: step.x, y: 0, fallMs: 1 });
      let raf1 = 0;
      let raf2 = 0;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setAiFallingPiece((prev) => (prev ? { ...prev, y: step.y, fallMs } : prev));
        });
      });
      const t = setTimeout(() => setAiFallingPiece(null), fallMs + 40);
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
        clearTimeout(t);
      };
    }
    setAiFallingPiece(null);
  }, [aiVsFrame, aiVs, mode]);

  const lockedBoard = mode === "play" ? live.board : activeResult ? (frame === 0 ? activeResult.initialBoard : activeResult.steps[frame - 1].board) : emptyBoard();
  const preLockBoard = activeResult ? (frame <= 1 ? activeResult.initialBoard : activeResult.steps[frame - 2].board) : emptyBoard();
  const board = fallingPiece ? preLockBoard : lockedBoard;
  const currentScore = mode === "play" ? live.score : activeResult && frame > 0 ? activeResult.steps[frame - 1].cumulativeScore : 0;
  const nextPieceType = mode === "play" ? live.nextType : activeResult ? (activeResult.steps[frame]?.pieceType ?? null) : null;

  const aiVsLockedBoard = aiVs ? (aiVsFrame === 0 ? aiVs.initialBoard : aiVs.steps[aiVsFrame - 1].board) : null;
  const aiVsPreLockBoard = aiVs ? (aiVsFrame <= 1 ? aiVs.initialBoard : aiVs.steps[aiVsFrame - 2].board) : null;
  const aiVsBoard = aiFallingPiece ? aiVsPreLockBoard : aiVsLockedBoard;
  const aiVsScore = aiVs && aiVsFrame > 0 ? aiVs.steps[aiVsFrame - 1].cumulativeScore : 0;

  const status = running
    ? "CALCULANDO"
    : playing
      ? "REPRODUZINDO"
      : activeResult
        ? frame >= activeResult.steps.length
          ? activeResult.toppedOut
            ? "TOPO ATINGIDO"
            : "CONCLUÍDO"
          : "PRONTO"
        : "AGUARDANDO EXECUÇÃO";

  const finalStats: [string, string][] | null = useMemo(() => {
    if (!activeResult) return null;
    const w = activeResult.config.weights;
    return [
      ["Pontuação final", activeResult.finalScore.toLocaleString("pt-BR")],
      ["Linhas eliminadas", String(activeResult.totalLines)],
      ["Peças posicionadas", String(activeResult.piecesPlaced)],
      ["Topo atingido (fim de jogo)?", activeResult.toppedOut ? "Sim" : "Não"],
      ["Execução truncada?", activeResult.truncated ? "Sim (limite de peças)" : "Não"],
      ...(resultKind === "genetic"
        ? ([
            [
              "Pesos evoluídos",
              `linhas ${w.lines.toFixed(2)} · altura ${w.height.toFixed(2)} · buracos ${w.holes.toFixed(2)} · irregularidade ${w.bumpiness.toFixed(2)}`,
            ],
          ] as [string, string][])
        : []),
    ];
  }, [activeResult, resultKind]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Tetris</span>
            <span>/</span>
            <span className="accent">{MODE_LABELS[mode]}</span>
          </div>
          <h1 className="content-title">Tetris</h1>
          <p className="content-sub">
            Encaixe as peças que caem num poço 10×20 e limpe linhas o quanto der. Compare uma
            heurística gulosa — que testa toda posição de queda de cada peça e escolhe a melhor sem
            olhar à frente — com um Algoritmo Genético que evolui os pesos dessa heurística, jogue
            você mesmo com o teclado, ou dispute uma corrida contra a IA.
          </p>
        </div>
        <div className="content-actions">
          {mode === "genetic" ? (
            <button className="btn-pill btn-pill-primary" onClick={() => setGaOpen(true)} disabled={gaRunning}>
              <Icon name="psychology" className="text-[15px]" /> {gaRunning ? "Evoluindo…" : "Rodar evolução"}
            </button>
          ) : mode === "greedy" ? (
            <button className="btn-pill btn-pill-primary" onClick={runActive} disabled={running}>
              <Icon name="play_arrow" className="text-[15px]" /> {running ? "Calculando…" : "Rodar Heurística Gulosa"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="workspace-card">
        <div className="workspace-head">
          <Select
            value={mode}
            onChange={(v) => setMode(v as TetrisMode)}
            options={(Object.keys(MODE_LABELS) as TetrisMode[]).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
            className="!w-auto shrink-0"
          />
          <div className="workspace-links">
            <button className="workspace-link" onClick={() => setParamsOpen(true)}>
              <Icon name="tune" className="text-[13px]" /> Parâmetros
            </button>
            <button className="workspace-link" onClick={() => setGaOpen(true)} disabled={mode === "play" || mode === "vs"}>
              <Icon name="psychology" className="text-[13px]" /> Genético
            </button>
            <button className="workspace-link" onClick={() => setStatsOpen(true)} disabled={mode === "play" || mode === "vs" || !activeResult}>
              <Icon name="query_stats" className="text-[13px]" /> Última execução
            </button>
          </div>
        </div>

        <div className="canvas-body">
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(155,107,255,0.06),transparent_60%)]">
            <StageHint>
              {mode === "vs" ? (
                <>
                  VOCÊ <b className="readout-glow font-semibold text-primary">{live.score.toLocaleString("pt-BR")}</b>
                  {" "}· IA <b className="readout-glow font-semibold text-primary">{aiVsScore.toLocaleString("pt-BR")}</b>
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
                  NÍVEL <b className="readout-glow font-semibold text-primary">{live.level}</b> · LINHAS{" "}
                  <b className="readout-glow font-semibold text-primary">{live.lines}</b> · PONTUAÇÃO{" "}
                  <b className="readout-glow font-semibold text-primary">{live.score.toLocaleString("pt-BR")}</b>
                </>
              ) : (
                <>
                  MODO <b className="readout-glow font-semibold text-primary">{MODE_LABELS[mode]}</b> · PEÇA{" "}
                  <b className="readout-glow font-semibold text-primary">{frame}</b> · PONTUAÇÃO{" "}
                  <b className="readout-glow font-semibold text-primary">{currentScore.toLocaleString("pt-BR")}</b>
                </>
              )}
            </StageHint>

            {mode === "vs" ? (
              <div className="flex h-full w-full items-stretch justify-center gap-4">
                <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="shrink-0 font-mono text-[11px] text-on-surface-variant">VOCÊ</span>
                  <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                    <TetrisGrid board={live.board} activePiece={live.activePiece} className="tetris-grid--vs" />
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="shrink-0 font-mono text-[11px] text-on-surface-variant">IA</span>
                  <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                    <TetrisGrid board={aiVsBoard ?? emptyBoard()} fallingPiece={aiFallingPiece} className="tetris-grid--vs" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center gap-5">
                <TetrisGrid
                  board={board}
                  activePiece={mode === "play" ? live.activePiece : undefined}
                  fallingPiece={fallingPiece}
                  overlay={
                    mode === "play" && live.over
                      ? { title: "VOCÊ PERDEU", subtitle: "Sem espaço para a próxima peça" }
                      : null
                  }
                />
                <div className="hidden flex-col items-center gap-1.5 sm:flex">
                  <span className="font-mono text-[10px] text-on-surface-variant">PRÓXIMA</span>
                  <TetrisPiecePreview type={nextPieceType} />
                </div>
              </div>
            )}

            {(mode === "play" || mode === "vs") && (
              <div className="pointer-events-auto absolute bottom-4 right-4 z-[1] grid grid-cols-3 grid-rows-3 gap-1">
                <span />
                <button className="g2048-dpad-btn" onClick={touchRotate} aria-label="Girar">
                  <Icon name="rotate_right" className="text-[18px]" />
                </button>
                <span />
                <button className="g2048-dpad-btn" onClick={() => touchMove(-1)} aria-label="Esquerda">
                  <Icon name="keyboard_arrow_left" className="text-[18px]" />
                </button>
                <button className="g2048-dpad-btn" onClick={touchSoftDrop} aria-label="Descer">
                  <Icon name="keyboard_arrow_down" className="text-[18px]" />
                </button>
                <button className="g2048-dpad-btn" onClick={() => touchMove(1)} aria-label="Direita">
                  <Icon name="keyboard_arrow_right" className="text-[18px]" />
                </button>
                <span />
                <button className="g2048-dpad-btn" onClick={touchHardDrop} aria-label="Queda instantânea">
                  <Icon name="vertical_align_bottom" className="text-[18px]" />
                </button>
                <span />
              </div>
            )}
          </div>

          {mode === "play" ? (
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 bg-background px-4 sm:px-5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${live.over ? "" : "animate-pulse"}`} style={{ background: "var(--tertiary)" }} />
                {live.over
                  ? "FIM DE JOGO — SEM ESPAÇO PARA A PRÓXIMA PEÇA"
                  : "SETAS PARA MOVER/DESCER · CIMA OU X GIRA · Z GIRA AO CONTRÁRIO · ESPAÇO QUEDA INSTANTÂNEA"}
              </span>
              <button className="btn-pill" onClick={() => resetLiveGame()}>
                <Icon name="refresh" className="text-[15px]" /> Novo jogo
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
                      ? "EMPATE"
                      : live.over
                        ? "SEU JOGO ACABOU — AGUARDANDO A IA TERMINAR"
                        : aiVs && aiVsFrame >= aiVs.steps.length
                          ? "A IA TERMINOU — TERMINE SEU JOGO"
                          : "QUEM FIZER MAIS PONTOS VENCE"}
              </span>
              <button className="btn-pill" onClick={resetVsRace}>
                <Icon name="refresh" className="text-[15px]" /> Nova corrida
              </button>
            </div>
          ) : (
            <Timeline
              status={status}
              pulsing={playing}
              playing={playing}
              onTogglePlay={() => setPlaying((p) => !p)}
              onSkipEnd={() => {
                if (!activeResult) return;
                setFrame(activeResult.steps.length);
                setPlaying(false);
              }}
              current={activeResult ? frame : 0}
              total={activeResult?.steps.length ?? 0}
              unitLabel="peças"
              disabled={!activeResult}
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
        {finalStats && <StatGrid cols={2} items={finalStats} />}
      </Modal>

      <TetrisGeneticModal
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

      <Modal open={paramsOpen} onClose={() => setParamsOpen(false)} title="Parâmetros" subtitle="Seed da sequência de peças (o poço é sempre 10×20)">
        <Field label="Seed">
          <div className="flex items-center gap-2">
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="w-full" />
            <button className="btn btn-secondary !px-2.5" onClick={() => setSeed(randomSeed())} title="Nova sequência de peças aleatória">
              <Icon name="casino" className="text-[16px]" />
            </button>
          </div>
        </Field>
        <p className="text-[11px] leading-relaxed text-on-surface-variant">
          A seed decide a sequência de peças (sorteada em &quot;sacolas&quot; de 7, cada peça aparece
          uma vez por sacola). O tabuleiro é sempre 10×20, o tamanho clássico do Tetris.
        </p>
      </Modal>
    </div>
  );
}

// Thin wrapper so the AI-mode run sites don't need to re-spell every TetrisConfig field.
function runGameWrapped(weights: HeuristicWeights, seed: number): TetrisResult {
  return runGame({ weights, seed, maxPieces: MAX_PIECES });
}
