"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Field, Icon } from "@/components/shared/Panel";
import { Modal } from "@/components/shared/Modal";
import { Select } from "@/components/shared/Select";
import { StageHint } from "@/components/shared/Stage";
import { StatGrid } from "@/components/shared/StatGrid";
import { Timeline } from "@/components/shared/Timeline";
import { randomSeed, seededRng } from "@/lib/core/rng";
import { evolve, GaGenerationSummary, GaRunResult } from "@/lib/core/genetic";
import { Game2048Grid, MOVE_ANIMATION_MS } from "@/components/game2048/Game2048Grid";
import { Game2048GeneticModal, Game2048GaFormConfig } from "@/components/game2048/Game2048GeneticModal";
import { buildGame2048GaOps } from "@/lib/game2048/genetic";
import {
  applyMove,
  Board,
  Direction,
  Game2048Result,
  HeuristicWeights,
  legalMoves,
  runGame,
  spawnTile,
  startingBoard,
  TileMove,
  WIN_TILE,
} from "@/lib/game2048/model";

type Game2048Mode = "greedy" | "expectimax" | "genetic" | "vs" | "play";

const MODE_LABELS: Record<Game2048Mode, string> = {
  greedy: "Heurística Gulosa",
  expectimax: "Expectimax",
  genetic: "Algoritmo Genético",
  vs: "IA vs Você",
  play: "Jogar você mesmo",
};

type RaceWinner = "human" | "ai" | "tie";

// AI moves this often in "IA vs Você" - matches Game2048Grid's own slide+settle animation length so
// its board's move always finishes animating before the next one starts, same pacing idea as the
// scrub tick used for the other AI modes' Timeline.
const AI_RACE_TICK_MS = MOVE_ANIMATION_MS;

// Safety cap on move count, not a target - most games end (board fills up / no legal move) well
// before this. Kept high enough that a well-played small board can actually reach 2048.
const MAX_MOVES = 3000;

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

interface LiveGame {
  board: Board;
  /** The board immediately before the last move, for the grid's slide animation - null right
   *  after a reset, when there's nothing to slide from yet. */
  prevBoard: Board | null;
  moves: TileMove[] | null;
  score: number;
  spawnedIndex: number | null;
  over: boolean;
  won: boolean;
}

export default function Game2048Page() {
  const [size, setSize] = useState(4);
  // Deterministic placeholder for SSR (avoids a hydration mismatch, same precedent as tsp/rl's own
  // seed placeholder); the mount effect below immediately replaces it with a real random seed.
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState<Game2048Mode>("greedy");
  // Depth 1 essentially never reaches 2048 (measured: 0/8 games across seeds, best case 1024) -
  // it's barely more than Heurística Gulosa with one extra ply, which defeats the page's own point
  // that lookahead matters. Depth 2 actually wins roughly half the time on the default 4x4 board
  // (measured: 3-4/8) and nearly always on bigger ones, so it's the default despite being slower
  // (profiling: ~2-5.5s for a full game on 4x4, 20-35s on 5x5/6x6) - capped at 2 so the slider can
  // never reach a multi-minute search.
  const [expectimaxDepth, setExpectimaxDepth] = useState(2);

  const [paramsOpen, setParamsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [gaOpen, setGaOpen] = useState(false);

  const [result, setResult] = useState<Game2048Result | null>(null);
  const [running, setRunning] = useState(false);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const [compare, setCompare] = useState<{ greedy: Game2048Result; expectimax: Game2048Result } | null>(null);
  const [comparing, setComparing] = useState(false);

  // Algoritmo Genético: evolves the heuristic's weight vector (not a different decision procedure -
  // Genetic reuses the exact same zero-lookahead move choice as Heurística Gulosa, just with
  // evolved weights) via the same core evolve() engine tsp/labirinto/rainhas/goose already share.
  const [gaConfig, setGaConfig] = useState<Game2048GaFormConfig>({
    populationSize: 40,
    generations: 40,
    mutationRate: 0.25,
    crossoverRate: 0.8,
    eliteCount: 3,
    tournamentSize: 4,
    evalMaxMoves: 250,
    seed: 1,
  });
  const [gaRunning, setGaRunning] = useState(false);
  const [gaProgressGen, setGaProgressGen] = useState(0);
  const [gaLiveGenerations, setGaLiveGenerations] = useState<GaGenerationSummary[]>([]);
  const [gaRunResult, setGaRunResult] = useState<GaRunResult<HeuristicWeights> | null>(null);
  const [gaElapsedMs, setGaElapsedMs] = useState<number | null>(null);

  // Manual play: a real live game state driven by keyboard/touch input, separate from the
  // precomputed-then-scrubbed step arrays every AI mode uses - there's nothing to scrub, the user
  // is the one deciding each move in real time.
  const rngRef = useRef<() => number>(() => Math.random());
  // Locks input for the duration of one move's slide/settle animation - without this, mashing or
  // holding an arrow key fires moves faster than the board can visually keep up with, which is
  // exactly the "too fast" feel a debounced real 2048 doesn't have.
  const moveLockRef = useRef(false);
  const [live, setLive] = useState<LiveGame>({
    board: new Array(16).fill(0),
    prevBoard: null,
    moves: null,
    score: 0,
    spawnedIndex: null,
    over: false,
    won: false,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time swap from the SSR placeholder seed to a real random one
    setSeed(randomSeed());
    setGaConfig((c) => ({ ...c, seed: randomSeed() }));
  }, []);

  // Accepts an explicit seed so "IA vs Você" can hand the human and the AI opponent the exact same
  // starting tile-spawn sequence - Play mode just omits it and gets a fresh random one.
  const resetLiveGame = (raceSeed?: number) => {
    rngRef.current = seededRng(raceSeed ?? randomSeed());
    moveLockRef.current = false;
    let board: Board = new Array(size * size).fill(0);
    ({ board } = spawnTile(board, rngRef.current));
    ({ board } = spawnTile(board, rngRef.current));
    setLive({ board, prevBoard: null, moves: null, score: 0, spawnedIndex: null, over: false, won: false });
  };

  // New board size while already playing manually needs a fresh live game at the new dimensions;
  // entering "play" mode also needs one, since `live` may still hold a stale size from before.
  useEffect(() => {
    if (mode !== "play") return;
    resetLiveGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetLiveGame reads `size` fresh via closure each call; including it would refire on every render
  }, [mode, size]);

  // IA vs Você: the human's live board (reusing Play mode's own state/input handling) races a
  // precomputed Expectimax run of the same board size, both started from one shared seed so neither
  // side gets an easier opening - the AI's steps then play back on a fixed clock (see the tick
  // effect below) instead of instantly, so it feels like a real opponent instead of a foregone
  // conclusion.
  const [aiVs, setAiVs] = useState<Game2048Result | null>(null);
  const [aiVsFrame, setAiVsFrame] = useState(0);
  const [raceWinner, setRaceWinner] = useState<RaceWinner | null>(null);
  // At the default depth 2, computing the AI's full trace up front can take several seconds (see
  // expectimaxDepth's own comment) - wrapped in setTimeout so the human's board (reset instantly,
  // below) paints and becomes playable right away instead of the whole page freezing on entry, same
  // pause-point pattern as runActive/runComparison. The human can start playing immediately; the AI
  // side just shows the static starting board (aiVsBoard falls back to previewBoard) until ready.
  const [vsPreparing, setVsPreparing] = useState(false);

  const resetVsRace = () => {
    const raceSeed = randomSeed();
    resetLiveGame(raceSeed);
    setAiVs(null);
    setAiVsFrame(0);
    setRaceWinner(null);
    setVsPreparing(true);
    setTimeout(() => {
      setAiVs(runGame({ size, mode: "expectimax", expectimaxDepth, seed: raceSeed, maxMoves: MAX_MOVES }));
      setVsPreparing(false);
    }, 20);
  };

  useEffect(() => {
    if (mode !== "vs") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- entering vs mode (or resizing the board while in it) needs a fresh race, not a sync with external state
    resetVsRace();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetVsRace reads size/expectimaxDepth fresh via closure each call; a mid-race depth tweak shouldn't restart the race on its own
  }, [mode, size]);

  // Advances the AI's board one precomputed move at a time on a fixed clock instead of showing the
  // (near-instant) full result immediately - see AI_RACE_TICK_MS above for why that pace was chosen.
  useEffect(() => {
    if (mode !== "vs" || !aiVs || raceWinner) return;
    if (aiVsFrame >= aiVs.steps.length) return;
    const t = setTimeout(() => setAiVsFrame((f) => Math.min(f + 1, aiVs.steps.length)), AI_RACE_TICK_MS);
    return () => clearTimeout(t);
  }, [mode, aiVs, aiVsFrame, raceWinner]);

  // Race ends the instant either side reaches 2048 (first past the post), or - if neither does -
  // once both boards have run out of legal moves, decided by final score.
  useEffect(() => {
    if (mode !== "vs" || !aiVs || raceWinner) return;
    const aiBoard = aiVsFrame === 0 ? aiVs.initialBoard : aiVs.steps[aiVsFrame - 1].board;
    const aiWon = aiBoard.some((v) => v >= WIN_TILE);
    const humanDone = live.over;
    const aiDone = aiVsFrame >= aiVs.steps.length;
    let next: RaceWinner | null = null;
    if (live.won && aiWon) next = "tie";
    else if (live.won) next = "human";
    else if (aiWon) next = "ai";
    else if (humanDone && aiDone) next = live.score === aiVs.finalScore ? "tie" : live.score > aiVs.finalScore ? "human" : "ai";
    if (next) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the race-ending condition just computed above
      setRaceWinner(next);
    }
  }, [mode, aiVs, aiVsFrame, live.won, live.over, live.score, raceWinner]);

  const aiVsBoard = aiVs ? (aiVsFrame === 0 ? aiVs.initialBoard : aiVs.steps[aiVsFrame - 1].board) : null;
  const aiVsSpawnedIndex = aiVs && aiVsFrame > 0 ? aiVs.steps[aiVsFrame - 1].spawnedIndex : null;
  const aiVsScore = aiVs && aiVsFrame > 0 ? aiVs.steps[aiVsFrame - 1].cumulativeScore : 0;
  const aiVsPrevBoard = aiVs && aiVsFrame > 0 ? (aiVsFrame === 1 ? aiVs.initialBoard : aiVs.steps[aiVsFrame - 2].board) : null;
  const aiVsMoves = aiVs && aiVsFrame > 0 ? aiVs.steps[aiVsFrame - 1].moves : null;

  const applyLiveMove = (direction: Direction) => {
    if (moveLockRef.current) return;
    let applied = false;
    setLive((prev) => {
      if (prev.over) return prev;
      const { board: moved, scoreDelta, moved: didMove, moves } = applyMove(prev.board, size, direction);
      if (!didMove) return prev;
      applied = true;
      const { board: spawned, index } = spawnTile(moved, rngRef.current);
      const over = legalMoves(spawned, size).length === 0;
      const won = prev.won || spawned.some((v) => v >= WIN_TILE);
      return { board: spawned, prevBoard: prev.board, moves, score: prev.score + scoreDelta, spawnedIndex: index, over, won };
    });
    if (applied) {
      moveLockRef.current = true;
      setTimeout(() => {
        moveLockRef.current = false;
      }, MOVE_ANIMATION_MS);
    }
  };

  useEffect(() => {
    if (mode !== "play" && mode !== "vs") return;
    const onKey = (e: KeyboardEvent) => {
      const direction = KEY_TO_DIRECTION[e.key];
      if (!direction) return;
      e.preventDefault();
      applyLiveMove(direction);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyLiveMove updates via a setState functional updater, so it never needs the latest `live` in its closure
  }, [mode, size]);

  // A result only stays "active" while it still matches the current controls - switching size,
  // seed, mode, or (in expectimax) depth doesn't recompute automatically, it just hides the stale
  // run until the user presses "Rodar" again, same idea as tsp's per-mode result staleness.
  const activeResult = useMemo(() => {
    if (!result) return null;
    if (result.config.mode !== mode || result.config.size !== size || result.config.seed !== seed) return null;
    if (mode === "expectimax" && result.config.expectimaxDepth !== expectimaxDepth) return null;
    return result;
  }, [result, mode, size, seed, expectimaxDepth]);

  // Cheap 2-tile starting position shown before any run, same role as tsp's city layout or rl's
  // grid world - the instance is visible immediately, only the agent's play requires pressing Run.
  const previewBoard = useMemo(() => startingBoard(size, seed), [size, seed]);

  const board = mode === "play" ? live.board : activeResult ? (frame === 0 ? activeResult.initialBoard : activeResult.steps[frame - 1].board) : previewBoard;
  const spawnedIndex = mode === "play" ? live.spawnedIndex : activeResult && frame > 0 ? activeResult.steps[frame - 1].spawnedIndex : null;
  const currentScore = mode === "play" ? live.score : activeResult && frame > 0 ? activeResult.steps[frame - 1].cumulativeScore : 0;
  const maxTile = Math.max(...board);

  // Feeds the grid's slide animation - only meaningful for a genuine single-move transition, so
  // both branches leave it null whenever there's nothing sequential to animate from (frame 0, no
  // active result, or manual play right after a reset).
  const prevBoardForGrid =
    mode === "play" ? live.prevBoard : activeResult && frame > 0 ? (frame === 1 ? activeResult.initialBoard : activeResult.steps[frame - 2].board) : null;
  const movesForGrid = mode === "play" ? live.moves : activeResult && frame > 0 ? activeResult.steps[frame - 1].moves : null;

  // Wrapped in setTimeout so the "Calculando…" state paints before the (possibly multi-second,
  // synchronous) search blocks the main thread - same pause-point pattern as tsp's runOptimal.
  const runActive = () => {
    if (mode === "play" || mode === "vs") return;
    setRunning(true);
    setPlaying(false);
    setTimeout(() => {
      const r = runGame({ size, mode, expectimaxDepth, seed, maxMoves: MAX_MOVES });
      setResult(r);
      setFrame(0);
      setRunning(false);
    }, 20);
  };

  const runComparison = () => {
    setComparing(true);
    setTimeout(() => {
      const greedy = runGame({ size, mode: "greedy", expectimaxDepth, seed, maxMoves: MAX_MOVES });
      const expectimax = runGame({ size, mode: "expectimax", expectimaxDepth, seed, maxMoves: MAX_MOVES });
      setCompare({ greedy, expectimax });
      setComparing(false);
      setCompareOpen(true);
    }, 20);
  };

  // Evolves gaConfig.generations generations, chunked across setTimeout(0) ticks so a large
  // population×generations run never blocks the main thread in one go - same shape already proven
  // in tsp/labirinto/goose's GA runners. Once evolution finishes, the best genome plays one real
  // full-length showcase game (unlike the short evaluation games used for fitness), which lands in
  // the same `result`/Timeline the other two modes use - Genetic scrubs identically to them.
  const runGenetic = () => {
    setGaRunning(true);
    setGaRunResult(null);
    setGaLiveGenerations([]);
    setGaProgressGen(0);
    setMode("genetic");

    const ops = buildGame2048GaOps(size, gaConfig.seed, gaConfig.evalMaxMoves);
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
          const showcase = runGame({
            size,
            mode: "genetic",
            weights: finalResult.bestEverGenome,
            seed,
            expectimaxDepth: 1,
            maxMoves: MAX_MOVES,
          });
          setResult(showcase);
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

  // Move scrub: advances `playbackSpeed` moves per tick. Much slower than tsp/aprendizado's 60ms
  // tick and defaulting to 1 move per tick, not 4 - the grid's slide-then-settle animation for one
  // move takes ~450ms end to end (see Game2048Grid), and this tick needs to comfortably outlast
  // that so each move's animation actually finishes before the next one starts, unlike those pages'
  // scrubs where the visual (a route redraw, a heatmap) has no per-frame animation to wait out.
  useEffect(() => {
    if (!playing || !activeResult) return;
    if (frame >= activeResult.steps.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setFrame((f) => Math.min(f + playbackSpeed, activeResult.steps.length)), 500);
    return () => clearTimeout(t);
  }, [playing, frame, activeResult, playbackSpeed]);

  const status = running
    ? "CALCULANDO"
    : playing
      ? "REPRODUZINDO"
      : activeResult
        ? frame >= activeResult.steps.length
          ? activeResult.won
            ? "VITÓRIA"
            : "CONCLUÍDO"
          : "PRONTO"
        : "AGUARDANDO EXECUÇÃO";

  const runLabel = mode === "greedy" ? "Rodar Heurística Gulosa" : "Rodar Expectimax";

  const finalStats: [string, string][] | null = useMemo(() => {
    if (!activeResult) return null;
    const isExpectimax = activeResult.config.mode === "expectimax";
    const avgNodes = isExpectimax
      ? activeResult.steps.reduce((a, s) => a + s.nodesExplored, 0) / Math.max(1, activeResult.steps.length)
      : null;
    const truncatedSteps = activeResult.steps.filter((s) => s.truncated).length;
    const w = activeResult.config.weights;
    return [
      ["Pontuação final", activeResult.finalScore.toLocaleString("pt-BR")],
      ["Maior bloco", String(activeResult.maxTile)],
      ["Jogadas", activeResult.totalMoves.toLocaleString("pt-BR")],
      ["Venceu (2048)?", activeResult.won ? "Sim" : "Não"],
      ["Jogo truncado?", activeResult.truncated ? "Sim (limite de jogadas)" : "Não"],
      ...(avgNodes !== null
        ? ([
            ["Nós explorados (média/jogada)", avgNodes.toFixed(0)],
            ["Jogadas truncadas por orçamento", String(truncatedSteps)],
          ] as [string, string][])
        : []),
      ...(activeResult.config.mode === "genetic" && w
        ? ([["Pesos evoluídos", `vazio ${w.empty.toFixed(2)} · mono ${w.mono.toFixed(2)} · suavidade ${w.smooth.toFixed(2)} · canto ${w.corner.toFixed(2)}`]] as [
            string,
            string,
          ][])
        : []),
    ];
  }, [activeResult]);

  const compareItems: [string, string][] = useMemo(() => {
    const row = (label: string, r: Game2048Result | null): [string, string] => {
      if (!r) return [label, "—"];
      return [label, `${r.finalScore.toLocaleString("pt-BR")} pts · bloco ${r.maxTile} · ${r.totalMoves.toLocaleString("pt-BR")} jogadas`];
    };
    return [row(MODE_LABELS.greedy, compare?.greedy ?? null), row(MODE_LABELS.expectimax, compare?.expectimax ?? null)];
  }, [compare]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>2048</span>
            <span>/</span>
            <span className="accent">{MODE_LABELS[mode]}</span>
          </div>
          <h1 className="content-title">2048</h1>
          <p className="content-sub">
            Deslize e combine blocos iguais até chegar a 2048. Compare uma heurística gulosa (pesos
            fixos, sem antecipação), um Algoritmo Genético que evolui esses mesmos pesos, e
            Expectimax — a variante estocástica do Minimax, que olha turnos à frente considerando
            todo bloco aleatório que pode surgir — ou jogue você mesmo com as setas do teclado.
          </p>
        </div>
        <div className="content-actions">
          {mode !== "vs" && mode !== "play" && (
            <button className="btn-pill" onClick={runComparison} disabled={comparing}>
              <Icon name="compare_arrows" className="text-[15px]" /> {comparing ? "Comparando…" : "Comparar"}
            </button>
          )}
          {mode === "genetic" ? (
            <button className="btn-pill btn-pill-primary" onClick={() => setGaOpen(true)} disabled={gaRunning}>
              <Icon name="psychology" className="text-[15px]" /> {gaRunning ? "Evoluindo…" : "Rodar evolução"}
            </button>
          ) : mode !== "play" && mode !== "vs" ? (
            <button className="btn-pill btn-pill-primary" onClick={runActive} disabled={running}>
              <Icon name="play_arrow" className="text-[15px]" /> {running ? "Calculando…" : runLabel}
            </button>
          ) : null}
        </div>
      </div>

      <div className="workspace-card">
        <div className="workspace-head">
          <Select
            value={mode}
            onChange={(v) => setMode(v as Game2048Mode)}
            options={(Object.keys(MODE_LABELS) as Game2048Mode[]).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
            className="!w-auto shrink-0"
          />
          <div className="workspace-links">
            <button className="workspace-link" onClick={() => setParamsOpen(true)}>
              <Icon name="tune" className="text-[13px]" /> Parâmetros
            </button>
            <button className="workspace-link" onClick={() => setGaOpen(true)} disabled={mode === "vs" || mode === "play"}>
              <Icon name="psychology" className="text-[13px]" /> Genético
            </button>
            <button className="workspace-link" onClick={() => setStatsOpen(true)} disabled={mode === "vs" || mode === "play" || !activeResult}>
              <Icon name="query_stats" className="text-[13px]" /> Última execução
            </button>
          </div>
        </div>

        <div className="canvas-body">
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(242,109,91,0.06),transparent_60%)]">
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
              ) : (
                <>
                  TABULEIRO <b className="readout-glow font-semibold text-primary">{size}×{size}</b> · MODO{" "}
                  <b className="readout-glow font-semibold text-primary">{MODE_LABELS[mode]}</b> · PONTUAÇÃO{" "}
                  <b className="readout-glow font-semibold text-primary">{currentScore.toLocaleString("pt-BR")}</b> · MAIOR BLOCO{" "}
                  <b className="readout-glow font-semibold text-primary">{maxTile}</b>
                </>
              )}
            </StageHint>
            {mode === "vs" ? (
              <div className="flex h-full w-full flex-wrap items-center justify-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <span className="font-mono text-[11px] text-on-surface-variant">VOCÊ</span>
                  <Game2048Grid board={live.board} prevBoard={live.prevBoard} moves={live.moves} size={size} spawnedIndex={live.spawnedIndex} className="g2048-grid--vs" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="font-mono text-[11px] text-on-surface-variant">
                    IA{vsPreparing && <span className="text-primary"> · calculando…</span>}
                  </span>
                  <Game2048Grid board={aiVsBoard ?? previewBoard} prevBoard={aiVsPrevBoard} moves={aiVsMoves} size={size} spawnedIndex={aiVsSpawnedIndex} className="g2048-grid--vs" />
                </div>
              </div>
            ) : (
              <Game2048Grid
                board={board}
                prevBoard={prevBoardForGrid}
                moves={movesForGrid}
                size={size}
                spawnedIndex={spawnedIndex}
                overlay={
                  mode === "play" && live.over
                    ? live.won
                      ? { title: "VOCÊ VENCEU!", subtitle: "Sem mais jogadas — chegou a 2048" }
                      : { title: "VOCÊ PERDEU", subtitle: "Sem mais jogadas possíveis" }
                    : null
                }
              />
            )}
            {(mode === "play" || mode === "vs") && (
              <div className="pointer-events-auto absolute bottom-4 right-4 z-[1] grid grid-cols-3 grid-rows-3 gap-1">
                <span />
                <button className="g2048-dpad-btn" onClick={() => applyLiveMove("up")} aria-label="Cima">
                  <Icon name="keyboard_arrow_up" className="text-[18px]" />
                </button>
                <span />
                <button className="g2048-dpad-btn" onClick={() => applyLiveMove("left")} aria-label="Esquerda">
                  <Icon name="keyboard_arrow_left" className="text-[18px]" />
                </button>
                <span />
                <button className="g2048-dpad-btn" onClick={() => applyLiveMove("right")} aria-label="Direita">
                  <Icon name="keyboard_arrow_right" className="text-[18px]" />
                </button>
                <span />
                <button className="g2048-dpad-btn" onClick={() => applyLiveMove("down")} aria-label="Baixo">
                  <Icon name="keyboard_arrow_down" className="text-[18px]" />
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
                  ? live.won
                    ? "VITÓRIA — SEM MAIS JOGADAS"
                    : "FIM DE JOGO — SEM MAIS JOGADAS"
                  : live.won
                    ? "VOCÊ CHEGOU A 2048 — CONTINUE JOGANDO"
                    : "USE AS SETAS DO TECLADO (OU OS BOTÕES) PARA JOGAR"}
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
                          : "QUEM CHEGA A 2048 PRIMEIRO VENCE"}
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
              unitLabel="jogadas"
              disabled={!activeResult}
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
        {finalStats && <StatGrid cols={2} items={finalStats} />}
      </Modal>

      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Comparação entre modos"
        subtitle="Mesmo tabuleiro e mesma sequência de blocos para os dois"
        wide
      >
        <StatGrid cols={2} items={compareItems} />
      </Modal>

      <Game2048GeneticModal
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

      <Modal
        open={paramsOpen}
        onClose={() => setParamsOpen(false)}
        title="Parâmetros"
        subtitle="Tamanho do tabuleiro, profundidade do Expectimax e seed"
      >
        <Field label={`Tamanho do tabuleiro: ${size}×${size}`}>
          <input type="range" min={3} max={6} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </Field>
        <Field label={`Profundidade do Expectimax: ${expectimaxDepth}`}>
          <input
            type="range"
            min={1}
            max={2}
            value={expectimaxDepth}
            onChange={(e) => setExpectimaxDepth(Number(e.target.value))}
            disabled={mode !== "expectimax" && mode !== "vs"}
          />
        </Field>
        <div className="border-t border-outline-variant pt-4">
          <Field label="Seed">
            <div className="flex items-center gap-2">
              <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="w-full" />
              <button className="btn btn-secondary !px-2.5" onClick={() => setSeed(randomSeed())} title="Novo jogo aleatório">
                <Icon name="casino" className="text-[16px]" />
              </button>
            </div>
          </Field>
        </div>
        <p className="text-[11px] leading-relaxed text-on-surface-variant">
          Profundidade 1 quase nunca chega a 2048 sozinha (é pouco mais que a Heurística Gulosa com
          um lance extra de antecipação) — por isso o padrão é profundidade 2, que chega lá bem mais
          da metade das vezes num tabuleiro 4×4, e quase sempre em tabuleiros maiores. Sem
          antecipação (Heurística Gulosa e Algoritmo Genético) raramente chega a 2048 sozinho — é
          exatamente essa limitação que a antecipação do Expectimax existe para resolver. O custo é
          velocidade: profundidade 2 pode levar alguns segundos por partida em 4×4 e bem mais em
          tabuleiros maiores, então o cálculo roda por inteiro antes de mostrar o resultado.
        </p>
      </Modal>
    </div>
  );
}
