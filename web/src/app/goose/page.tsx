"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/shared/Panel";
import { Modal } from "@/components/shared/Modal";
import { Select } from "@/components/shared/Select";
import { StageHint } from "@/components/shared/Stage";
import { StatGrid } from "@/components/shared/StatGrid";
import { Timeline } from "@/components/shared/Timeline";
import { evolve, GaConfig, GaGenerationSummary, GaRunResult } from "@/lib/core/genetic";
import { buildGooseGaOps, simulateFrames, GooseGaOptions } from "@/lib/goose/genetic";
import { decide, extractInputs } from "@/lib/goose/agent";
import { createInitialState, stepGame, GOOSE_DT, GooseAction, GooseRunState } from "@/lib/goose/model";
import { randomSeed } from "@/lib/core/rng";
import { GeneticModal, GooseGaFormConfig } from "@/components/goose/GeneticModal";
import { GooseCanvas, GooseRenderState } from "@/components/goose/Goose2D";

type GooseMode = "ai" | "vs" | "play";

const MODE_LABELS: Record<GooseMode, string> = {
  ai: "Assistir IA evoluir",
  vs: "IA vs Você",
  play: "Jogar você mesmo",
};

type RaceWinner = "human" | "ai" | "tie";

const JUMP_KEYS = new Set(["ArrowUp", "w", "W", " "]);
const DUCK_KEYS = new Set(["ArrowDown", "s", "S"]);

// How many of the fittest agents from the watched generation run simultaneously, translucent,
// alongside the highlighted best one - the signature "population racing together" visual, capped
// so it stays legible instead of turning into overlapping noise.
const TOP_K = 15;

export default function GoosePage() {
  const [mode, setMode] = useState<GooseMode>("ai");
  const [gaOpen, setGaOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [gaConfig, setGaConfig] = useState<GooseGaFormConfig>({
    populationSize: 60,
    generations: 60,
    mutationRate: 0.15,
    crossoverRate: 0.7,
    eliteCount: 3,
    tournamentSize: 4,
    maxSteps: 2400,
    seed: randomSeed(),
    runSeed: randomSeed(),
  });
  const [gaRunning, setGaRunning] = useState(false);
  const [gaProgressGen, setGaProgressGen] = useState(0);
  const [gaLiveGenerations, setGaLiveGenerations] = useState<GaGenerationSummary[]>([]);
  const [gaRunResult, setGaRunResult] = useState<GaRunResult<Float64Array> | null>(null);
  const [gaElapsedMs, setGaElapsedMs] = useState<number | null>(null);

  const [selectedGeneration, setSelectedGeneration] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // frames advanced per tick
  const [genPickerOpen, setGenPickerOpen] = useState(false);

  // Manual play: a real live goose driven by keyboard/touch input, reusing model.ts's own
  // stepGame/createInitialState instead of a neural net's decide() - same physics, same obstacle
  // generator, just a human choosing "jump" or not each tick instead of a genome.
  const [live, setLive] = useState<GooseRunState>(() => createInitialState(1));
  const [liveBest, setLiveBest] = useState(0);
  const jumpQueuedRef = useRef(false);
  const duckHeldRef = useRef(false);

  const resetLiveGoose = () => {
    jumpQueuedRef.current = false;
    duckHeldRef.current = false;
    setLive(createInitialState(randomSeed()));
  };

  // Entering play mode always starts a fresh run - a stale run from a previous visit to this mode
  // would show a dead goose sitting in the wreckage instead of a ready-to-go board.
  useEffect(() => {
    if (mode !== "play") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- entering play mode needs a fresh run, not a sync with some external state
    resetLiveGoose();
  }, [mode]);

  // IA vs Você: races the human's live goose against the best genome the last evolution produced,
  // both fed the exact same obstacle seed so it's a fair heat - obstacle spawn timing depends only
  // on elapsed time/distance (never on jump/duck), so two geese sharing a seed see an identical
  // course for as long as both stay alive, the same invariant that lets AI mode's population render
  // from a single shared obstacle array in the first place.
  const raceGenome = gaRunResult?.bestEverGenome ?? null;
  const [aiLive, setAiLive] = useState<GooseRunState | null>(null);
  const [raceWinner, setRaceWinner] = useState<RaceWinner | null>(null);

  const resetRace = () => {
    if (!raceGenome) return;
    jumpQueuedRef.current = false;
    duckHeldRef.current = false;
    const sharedSeed = randomSeed();
    setLive(createInitialState(sharedSeed));
    setAiLive(createInitialState(sharedSeed));
    setRaceWinner(null);
  };

  // Starts (or restarts) a race the instant there's an opponent to race - covers both "entering vs
  // mode with an evolution already run" and "running an evolution while already parked in vs mode".
  useEffect(() => {
    if (mode !== "vs" || !raceGenome) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a fresh race, not a sync with external state
    resetRace();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetRace only closes over raceGenome (already a dep) and stable refs/setters
  }, [mode, raceGenome]);

  // Once both racers have crashed, the winner is whoever's final distance is greater - checked only
  // after both are down (not the instant one dies) so an early human crash doesn't end the race
  // before the AI has had its own chance to fail.
  useEffect(() => {
    if (mode !== "vs" || !aiLive || raceWinner) return;
    if (live.alive || aiLive.alive) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to both racers having just crashed
    setRaceWinner(live.distance === aiLive.distance ? "tie" : live.distance > aiLive.distance ? "human" : "ai");
  }, [mode, live, aiLive, raceWinner]);

  // Fixed-rate physics tick, matching the AI playback's own "advance one frame every 1000/60ms"
  // simplification (see the scrub effect below) rather than measuring real elapsed time - simpler,
  // and consistent with how this page already treats a "frame" as a fixed GOOSE_DT step. Drives the
  // human's goose in both Play and vs modes, plus the AI opponent's goose in vs mode, all off the
  // same tick so neither side can drift ahead of the other.
  useEffect(() => {
    const active = mode === "play" || (mode === "vs" && !!raceGenome);
    if (!active) return;
    const id = setInterval(() => {
      setLive((prev) => {
        if (!prev.alive) return prev;
        const action: GooseAction = jumpQueuedRef.current ? "jump" : duckHeldRef.current ? "duck" : "none";
        jumpQueuedRef.current = false;
        return stepGame(prev, action, GOOSE_DT);
      });
      if (mode === "vs" && raceGenome) {
        setAiLive((prev) => {
          if (!prev || !prev.alive) return prev;
          const action = decide(raceGenome, extractInputs(prev));
          return stepGame(prev, action, GOOSE_DT);
        });
      }
    }, 1000 / 60);
    return () => clearInterval(id);
  }, [mode, raceGenome]);

  // Jump is edge-triggered (one queued jump per keydown, ignoring OS auto-repeat) so holding the
  // key doesn't endlessly re-queue - matches how the real Chrome dino game only jumps on a fresh
  // press. Ducking is a held state instead, since crouching for as long as the key is down is the
  // whole point of it.
  useEffect(() => {
    if (mode !== "play" && mode !== "vs") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (JUMP_KEYS.has(e.key)) {
        e.preventDefault();
        if (!e.repeat) jumpQueuedRef.current = true;
      } else if (DUCK_KEYS.has(e.key)) {
        e.preventDefault();
        duckHeldRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (DUCK_KEYS.has(e.key)) duckHeldRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [mode]);

  // Records the session's best distance the instant a run ends - live.distance/alive both freeze
  // once dead (stepGame short-circuits on !alive), so this only ever fires once per death.
  useEffect(() => {
    if (!live.alive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- captures the just-ended run's distance as the new session best, a one-shot reaction to a state transition rather than a loop
      setLiveBest((b) => Math.max(b, live.distance));
    }
  }, [live.alive, live.distance]);

  // Evolves gaConfig.generations generations, chunked across setTimeout(0) ticks - goose fitness
  // evaluations are heavier than the maze's (a full physics simulation per genome instead of a
  // fixed-length walk), so the chunk size is smaller to keep each tick short.
  const runGenetic = () => {
    setGaRunning(true);
    setGaRunResult(null);
    setGaLiveGenerations([]);
    setGaProgressGen(0);
    setSelectedGeneration(0);
    setFrameIndex(0);
    setPlaying(false);

    const config: GaConfig = {
      populationSize: gaConfig.populationSize,
      generations: gaConfig.generations,
      eliteCount: gaConfig.eliteCount,
      mutationRate: gaConfig.mutationRate,
      crossoverRate: gaConfig.crossoverRate,
      tournamentSize: gaConfig.tournamentSize,
      seed: gaConfig.seed,
      topK: TOP_K,
    };
    const options: GooseGaOptions = { runSeed: gaConfig.runSeed, maxSteps: gaConfig.maxSteps, dtSeconds: GOOSE_DT };
    const ops = buildGooseGaOps(options);
    const iterator = evolve(config, ops);
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
          // Start the scrub at generation 0, not the last one - the point is watching the
          // population get visibly better generation by generation, not landing on the answer.
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

  // Re-simulates the watched generation's top genomes on demand rather than recording every
  // frame of every generation up front - obstacles depend only on elapsed steps and the shared
  // run seed (never on any individual goose's actions), so every genome sees an identical sequence
  // and any one of them can supply the obstacle track.
  const playback = useMemo(() => {
    if (!gaRunResult) return null;
    const genomes = gaRunResult.topPerGeneration[selectedGeneration];
    if (!genomes || genomes.length === 0) return null;
    const options: GooseGaOptions = { runSeed: gaConfig.runSeed, maxSteps: gaConfig.maxSteps, dtSeconds: GOOSE_DT };
    const allFrames = genomes.map((g) => simulateFrames(g, options));
    const longest = allFrames.reduce((a, b) => (a.length >= b.length ? a : b));
    return { allFrames, longest, maxLen: longest.length };
  }, [gaRunResult, selectedGeneration, gaConfig.runSeed, gaConfig.maxSteps]);

  // Reaching the end of a generation's playback while still "playing" advances to the next
  // generation and keeps going, instead of just stopping - pressing play once walks through the
  // population's evolution generation by generation, which is the point of watching it at all.
  useEffect(() => {
    if (!playing || !playback) return;
    if (frameIndex >= playback.maxLen - 1) {
      const hasNextGeneration = !!gaRunResult && selectedGeneration < gaRunResult.generations.length - 1;
      if (hasNextGeneration) {
        const t = setTimeout(() => {
          setSelectedGeneration((g) => g + 1);
          setFrameIndex(0);
        }, 550);
        return () => clearTimeout(t);
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setFrameIndex((f) => Math.min(f + Math.max(1, speed), playback.maxLen - 1)), 1000 / 60);
    return () => clearTimeout(t);
  }, [playing, frameIndex, playback, gaRunResult, selectedGeneration, speed]);

  const obstacles = useMemo(() => {
    if (!playback) return [];
    const clamped = Math.min(frameIndex, playback.longest.length - 1);
    return playback.longest[clamped]?.obstacles ?? [];
  }, [playback, frameIndex]);

  const geese: GooseRenderState[] = useMemo(() => {
    if (!playback) return [];
    return playback.allFrames.map((frames, i) => {
      const clamped = Math.min(frameIndex, frames.length - 1);
      const state = frames[clamped];
      return {
        y: state.y,
        isDucking: state.isDucking,
        isJumping: state.isJumping,
        alive: state.alive,
        highlight: i === 0,
        runPhase: Math.floor(state.elapsed * 10) % 4,
      };
    });
  }, [playback, frameIndex]);

  const groundOffset = useMemo(() => {
    if (!playback) return 0;
    const leaderFrames = playback.allFrames[0];
    const clamped = Math.min(frameIndex, leaderFrames.length - 1);
    return leaderFrames[clamped]?.distance ?? 0;
  }, [playback, frameIndex]);

  const stepGeneration = (delta: number) => {
    if (!gaRunResult) return;
    const next = Math.max(0, Math.min(gaRunResult.generations.length - 1, selectedGeneration + delta));
    setSelectedGeneration(next);
    setFrameIndex(0);
    setPlaying(false);
  };

  const jumpToGeneration = (gen: number) => {
    if (!gaRunResult) return;
    const next = Math.max(0, Math.min(gaRunResult.generations.length - 1, gen));
    setSelectedGeneration(next);
    setFrameIndex(0);
    setPlaying(false);
    setGenPickerOpen(false);
  };

  const bestOfGeneration = playback?.allFrames[0]?.[playback.allFrames[0].length - 1];
  const status = gaRunning ? "EVOLUINDO" : gaRunResult ? "OBSERVANDO GERAÇÃO" : "PRONTO";
  const generationRatio = gaRunResult && gaRunResult.generations.length > 1
    ? selectedGeneration / (gaRunResult.generations.length - 1)
    : 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Goose</span>
            <span>/</span>
            <span className="accent">Algoritmo Genético</span>
          </div>
          <h1 className="content-title">Goose</h1>
          <p className="content-sub">
            Uma população de pequenas redes neurais evolui para sobreviver o máximo de tempo
            possível desviando de cactos e pássaros. Cada geração enfrenta exatamente os mesmos
            obstáculos, então quem vai mais longe venceu por mérito, não por sorte.
          </p>
        </div>
        <div className="content-actions">
          {mode !== "play" && (
            <>
              <button className="btn-pill" onClick={() => setGaOpen(true)}>
                <Icon name="tune" className="text-[15px]" /> Parâmetros
              </button>
              <button className="btn-pill btn-pill-primary" onClick={runGenetic} disabled={gaRunning}>
                <Icon name="play_arrow" className="text-[15px]" /> {gaRunning ? "Evoluindo…" : "Rodar evolução"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="workspace-card">
        <div className="workspace-head">
          <Select
            value={mode}
            onChange={(v) => setMode(v as GooseMode)}
            options={(Object.keys(MODE_LABELS) as GooseMode[]).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
            className="!w-auto shrink-0"
          />
          <div className="workspace-links">
            <button className="workspace-link" onClick={() => setStatsOpen(true)} disabled={mode === "play" || !gaRunResult}>
              <Icon name="query_stats" className="text-[13px]" /> Última geração
            </button>
          </div>
        </div>

        <div className="canvas-body">
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(175,198,255,0.06),transparent_60%)]">
            <StageHint>
              {mode === "play" ? (
                <>
                  DISTÂNCIA{" "}
                  <b className="readout-glow font-semibold text-primary">{live.distance.toFixed(0)}</b>
                  {" "}· OBSTÁCULOS <b className="readout-glow font-semibold text-primary">{live.obstaclesCleared}</b>
                  {liveBest > 0 && (
                    <>
                      {" "}· MELHOR DA SESSÃO <b className="readout-glow font-semibold text-primary">{liveBest.toFixed(0)}</b>
                    </>
                  )}
                  {!live.alive && (
                    <>
                      {" "}· <b className="readout-glow font-semibold text-primary">FIM DE JOGO</b>
                    </>
                  )}
                </>
              ) : mode === "vs" ? (
                <>
                  VOCÊ <b className="readout-glow font-semibold text-primary">{live.distance.toFixed(0)}</b>
                  {" "}· IA <b className="readout-glow font-semibold text-primary">{aiLive ? aiLive.distance.toFixed(0) : "—"}</b>
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
                  GERAÇÃO{" "}
                  <b className="readout-glow font-semibold text-primary">
                    {gaRunResult ? selectedGeneration : "—"}
                    {gaRunResult ? ` / ${gaRunResult.generations.length - 1}` : ""}
                  </b>{" "}
                  · MOSTRANDO <b className="readout-glow font-semibold text-primary">{playback?.allFrames.length ?? 0}</b> agentes
                  {bestOfGeneration && (
                    <>
                      {" "}
                      · MELHOR DISTÂNCIA <b className="readout-glow font-semibold text-primary">{bestOfGeneration.distance.toFixed(0)}</b>
                    </>
                  )}
                </>
              )}
            </StageHint>
            {mode === "play" ? (
              <GooseCanvas
                obstacles={live.obstacles}
                geese={[
                  {
                    y: live.y,
                    isDucking: live.isDucking,
                    isJumping: live.isJumping,
                    alive: live.alive,
                    highlight: true,
                    runPhase: Math.floor(live.elapsed * 10) % 4,
                  },
                ]}
                groundOffset={live.distance}
                generationRatio={0}
              />
            ) : mode === "vs" ? (
              raceGenome && aiLive ? (
                <GooseCanvas
                  obstacles={live.alive ? live.obstacles : aiLive.obstacles}
                  geese={[
                    {
                      y: live.y,
                      isDucking: live.isDucking,
                      isJumping: live.isJumping,
                      alive: live.alive,
                      highlight: true,
                      runPhase: Math.floor(live.elapsed * 10) % 4,
                    },
                    {
                      y: aiLive.y,
                      isDucking: aiLive.isDucking,
                      isJumping: aiLive.isJumping,
                      alive: aiLive.alive,
                      highlight: false,
                      runPhase: Math.floor(aiLive.elapsed * 10) % 4,
                    },
                  ]}
                  groundOffset={live.alive ? live.distance : aiLive.distance}
                  generationRatio={1}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-[12px] text-on-surface-variant">
                  <p className="max-w-xs">
                    Rode uma evolução primeiro para ter um adversário — a IA corre com o melhor genoma encontrado.
                  </p>
                  <button className="btn-pill btn-pill-primary" onClick={runGenetic} disabled={gaRunning}>
                    <Icon name="play_arrow" className="text-[15px]" /> {gaRunning ? "Evoluindo…" : "Rodar evolução"}
                  </button>
                </div>
              )
            ) : (
              <GooseCanvas obstacles={obstacles} geese={geese} groundOffset={groundOffset} generationRatio={generationRatio} />
            )}
            {(mode === "play" || (mode === "vs" && raceGenome && aiLive)) && (
              <div className="pointer-events-auto absolute bottom-4 right-4 z-[1] flex gap-2">
                <button
                  className="g2048-dpad-btn"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    duckHeldRef.current = true;
                  }}
                  onPointerUp={() => {
                    duckHeldRef.current = false;
                  }}
                  onPointerLeave={() => {
                    duckHeldRef.current = false;
                  }}
                  aria-label="Abaixar"
                >
                  <Icon name="keyboard_arrow_down" className="text-[18px]" />
                </button>
                <button
                  className="g2048-dpad-btn"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    jumpQueuedRef.current = true;
                  }}
                  aria-label="Pular"
                >
                  <Icon name="keyboard_arrow_up" className="text-[18px]" />
                </button>
              </div>
            )}
          </div>

          {mode === "ai" && gaRunResult && (
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
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${live.alive ? "animate-pulse" : ""}`} style={{ background: "var(--tertiary)" }} />
                {live.alive ? "SETA CIMA/ESPAÇO PULA · SETA BAIXO ABAIXA" : "FIM DE JOGO — SEM MAIS OBSTÁCULOS PARA DESVIAR"}
              </span>
              <button className="btn-pill" onClick={resetLiveGoose}>
                <Icon name="refresh" className="text-[15px]" /> Novo jogo
              </button>
            </div>
          ) : mode === "vs" ? (
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 bg-background px-4 sm:px-5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${raceGenome && !raceWinner ? "animate-pulse" : ""}`}
                  style={{ background: "var(--tertiary)" }}
                />
                {!raceGenome
                  ? "SEM ADVERSÁRIO — RODE UMA EVOLUÇÃO"
                  : raceWinner === "human"
                    ? "VOCÊ VENCEU A CORRIDA"
                    : raceWinner === "ai"
                      ? "A IA VENCEU A CORRIDA"
                      : raceWinner === "tie"
                        ? "EMPATE — OS DOIS CAÍRAM JUNTOS"
                        : !live.alive
                          ? "VOCÊ CAIU — AGUARDANDO A IA"
                          : aiLive && !aiLive.alive
                            ? "A IA CAIU — CONTINUE VOANDO"
                            : "SETA CIMA/ESPAÇO PULA · SETA BAIXO ABAIXA"}
              </span>
              <button className="btn-pill" onClick={resetRace} disabled={!raceGenome}>
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
                if (!playback) return;
                setFrameIndex(playback.maxLen - 1);
                setPlaying(false);
              }}
              current={frameIndex}
              total={playback?.maxLen ?? 0}
              unitLabel="quadros"
              disabled={!playback}
              speed={speed}
              onSpeedChange={setSpeed}
              speedLabel="Velocidade"
              speedMax={8}
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

      <Modal open={statsOpen} onClose={() => setStatsOpen(false)} title="Última geração">
        {bestOfGeneration && (
          <StatGrid
            cols={2}
            items={[
              ["Geração", selectedGeneration],
              ["Distância do melhor", bestOfGeneration.distance.toFixed(1)],
              ["Obstáculos superados", bestOfGeneration.obstaclesCleared],
              ["Sobreviveu ao limite", bestOfGeneration.alive ? "Sim" : "Não"],
              ["Tempo simulado", `${bestOfGeneration.elapsed.toFixed(1)}s`],
              ["Agentes mostrados", playback?.allFrames.length ?? 0],
            ]}
          />
        )}
      </Modal>
    </div>
  );
}
