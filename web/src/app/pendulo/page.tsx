"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/shared/Panel";
import { Modal } from "@/components/shared/Modal";
import { Select } from "@/components/shared/Select";
import { StageHint } from "@/components/shared/Stage";
import { StatGrid } from "@/components/shared/StatGrid";
import { Timeline } from "@/components/shared/Timeline";
import { evolve, GaConfig, GaGenerationSummary, GaRunResult } from "@/lib/core/genetic";
import { buildPenduloGaOps, simulateFrames, PenduloGaOptions } from "@/lib/pendulo/genetic";
import { decide, extractInputs } from "@/lib/pendulo/agent";
import { createInitialState, stepPendulo, heuristicDecide, PENDULO_DT, PenduloAction, PenduloState } from "@/lib/pendulo/model";
import { randomSeed } from "@/lib/core/rng";
import { GeneticModal, PenduloGaFormConfig } from "@/components/pendulo/GeneticModal";
import { Pendulo2D } from "@/components/pendulo/Pendulo2D";
import { NetworkViz } from "@/components/pendulo/NetworkViz";

type PenduloMode = "play" | "heuristica" | "evoluida" | "vs";

const MODE_LABELS: Record<PenduloMode, string> = {
  play: "Jogar você mesmo",
  heuristica: "Controlador Heurístico (PD)",
  evoluida: "Rede Neural Evoluída",
  vs: "Rede Neural vs Heurístico",
};

type RaceWinner = "nn" | "heuristic" | "tie";

const LEFT_KEYS = new Set(["ArrowLeft", "a", "A"]);
const RIGHT_KEYS = new Set(["ArrowRight", "d", "D"]);

export default function PenduloPage() {
  const [mode, setMode] = useState<PenduloMode>("evoluida");
  const [gaOpen, setGaOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [gaConfig, setGaConfig] = useState<PenduloGaFormConfig>({
    populationSize: 60,
    generations: 40,
    mutationRate: 0.15,
    crossoverRate: 0.7,
    eliteCount: 4,
    tournamentSize: 4,
    maxSteps: 1000,
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
  const [speed, setSpeed] = useState(1);
  const [genPickerOpen, setGenPickerOpen] = useState(false);

  // Manual play: a human-driven cart, reusing model.ts's own stepPendulo/createInitialState instead
  // of a genome's decide() - same physics, just a person choosing left/right each tick. Bang-bang
  // control has no "do nothing" - the last direction pressed keeps being applied until a new key
  // changes it, so a live ref (not state) tracks it without re-rendering every keystroke.
  const pushRef = useRef<PenduloAction>("right");
  const [live, setLive] = useState<PenduloState>(() => createInitialState(1));
  const [liveBestSteps, setLiveBestSteps] = useState(0);

  const resetLive = () => {
    pushRef.current = "right";
    setLive(createInitialState(randomSeed()));
  };

  useEffect(() => {
    if (mode !== "play") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- entering play mode needs a fresh run, not a sync with some external state
    resetLive();
  }, [mode]);

  useEffect(() => {
    if (!live.alive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- captures the just-ended run's steps as the new session best, a one-shot reaction to a state transition rather than a loop
      setLiveBestSteps((b) => Math.max(b, live.steps));
    }
  }, [live.alive, live.steps]);

  useEffect(() => {
    if (mode !== "play") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (LEFT_KEYS.has(e.key)) {
        e.preventDefault();
        pushRef.current = "left";
      } else if (RIGHT_KEYS.has(e.key)) {
        e.preventDefault();
        pushRef.current = "right";
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode]);

  useEffect(() => {
    if (mode !== "play") return;
    const id = setInterval(() => {
      setLive((prev) => (prev.alive ? stepPendulo(prev, pushRef.current, PENDULO_DT) : prev));
    }, PENDULO_DT * 1000);
    return () => clearInterval(id);
  }, [mode]);

  // Heurística: the hand-coded PD controller runs on its own, no input needed - just a live
  // demonstration that keeps going until it falls (rare, by design) or is manually restarted.
  const [heuristicLive, setHeuristicLive] = useState<PenduloState>(() => createInitialState(2));

  const resetHeuristic = () => setHeuristicLive(createInitialState(randomSeed()));

  useEffect(() => {
    if (mode !== "heuristica") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- entering this mode needs a fresh run
    resetHeuristic();
  }, [mode]);

  useEffect(() => {
    if (mode !== "heuristica") return;
    const id = setInterval(() => {
      setHeuristicLive((prev) => (prev.alive ? stepPendulo(prev, heuristicDecide(prev), PENDULO_DT) : prev));
    }, PENDULO_DT * 1000);
    return () => clearInterval(id);
  }, [mode]);

  // Rede Neural vs Heurístico: both controllers race from the identical starting tilt, ticking off
  // one shared clock so neither can drift ahead of the other. Capped at gaConfig.maxSteps - a good
  // controller (either one) can balance indefinitely, so without a cap the race would never resolve.
  const raceGenome = gaRunResult?.bestEverGenome ?? null;
  const [nnVs, setNnVs] = useState<PenduloState | null>(null);
  const [heuristicVs, setHeuristicVs] = useState<PenduloState | null>(null);
  const [raceWinner, setRaceWinner] = useState<RaceWinner | null>(null);

  const resetRace = () => {
    if (!raceGenome) return;
    const sharedSeed = randomSeed();
    setNnVs(createInitialState(sharedSeed));
    setHeuristicVs(createInitialState(sharedSeed));
    setRaceWinner(null);
  };

  useEffect(() => {
    if (mode !== "vs" || !raceGenome) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a fresh race, not a sync with external state
    resetRace();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetRace only closes over raceGenome (already a dep) and stable setters
  }, [mode, raceGenome]);

  useEffect(() => {
    if (mode !== "vs" || !nnVs || !heuristicVs || raceWinner) return;
    const bothDone = (!nnVs.alive || nnVs.steps >= gaConfig.maxSteps) && (!heuristicVs.alive || heuristicVs.steps >= gaConfig.maxSteps);
    if (!bothDone) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to both racers having just finished
    setRaceWinner(
      nnVs.steps === heuristicVs.steps ? "tie" : nnVs.steps > heuristicVs.steps ? "nn" : "heuristic"
    );
  }, [mode, nnVs, heuristicVs, raceWinner, gaConfig.maxSteps]);

  useEffect(() => {
    if (mode !== "vs" || !raceGenome) return;
    const id = setInterval(() => {
      setNnVs((prev) => {
        if (!prev || !prev.alive || prev.steps >= gaConfig.maxSteps) return prev;
        return stepPendulo(prev, decide(raceGenome, extractInputs(prev)), PENDULO_DT);
      });
      setHeuristicVs((prev) => {
        if (!prev || !prev.alive || prev.steps >= gaConfig.maxSteps) return prev;
        return stepPendulo(prev, heuristicDecide(prev), PENDULO_DT);
      });
    }, PENDULO_DT * 1000);
    return () => clearInterval(id);
  }, [mode, raceGenome, gaConfig.maxSteps]);

  // Evolves gaConfig.generations generations, chunked across setTimeout(0) ticks. Physics steps are
  // cheap here (a handful of trig calls, no arrays like Goose's obstacles), so a larger chunk is
  // fine without risking a janky tick.
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
    };
    const options: PenduloGaOptions = { runSeed: gaConfig.runSeed, maxSteps: gaConfig.maxSteps, dt: PENDULO_DT };
    const ops = buildPenduloGaOps(options);
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

  // Re-simulates the watched generation's best genome on demand rather than recording every frame
  // of every generation up front. Unlike Goose's side-scrolling runway (which can host several
  // agents racing together along the track), a 4.8m-wide cart track showing many overlapping carts
  // would just be visual noise - so this shows one genome at a time, the generation's best.
  const playback = useMemo(() => {
    if (!gaRunResult) return null;
    const genome = gaRunResult.bestPerGeneration[selectedGeneration];
    if (!genome) return null;
    const options: PenduloGaOptions = { runSeed: gaConfig.runSeed, maxSteps: gaConfig.maxSteps, dt: PENDULO_DT };
    const frames = simulateFrames(genome, options);
    return { genome, frames };
  }, [gaRunResult, selectedGeneration, gaConfig.runSeed, gaConfig.maxSteps]);

  useEffect(() => {
    if (!playing || !playback) return;
    if (frameIndex >= playback.frames.length - 1) {
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
    const t = setTimeout(() => setFrameIndex((f) => Math.min(f + Math.max(1, speed), playback.frames.length - 1)), 1000 / 60);
    return () => clearTimeout(t);
  }, [playing, frameIndex, playback, gaRunResult, selectedGeneration, speed]);

  const currentFrame = playback?.frames[Math.min(frameIndex, playback.frames.length - 1)] ?? null;
  const currentInputs = currentFrame ? extractInputs(currentFrame) : null;

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

  const bestOfGeneration = playback?.frames[playback.frames.length - 1];
  const status = gaRunning ? "EVOLUINDO" : gaRunResult ? "OBSERVANDO GERAÇÃO" : "PRONTO";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Pêndulo</span>
            <span>/</span>
            <span className="accent">Neuroevolução</span>
          </div>
          <h1 className="content-title">Pêndulo Invertido</h1>
          <p className="content-sub">
            Uma rede neural de duas camadas ocultas evolui, geração após geração, até aprender a
            equilibrar um pêndulo sobre um carrinho - o mesmo problema clássico de controle usado
            desde os anos 80 para testar algoritmos de aprendizado. Um controlador PD escrito à mão
            resolve o mesmo problema sem aprender nada, só reagindo ao ângulo e à posição em tempo
            real. No modo evoluída, veja a rede ao vivo: cada neurônio acende conforme sua ativação
            muda a cada passo.
          </p>
        </div>
        <div className="content-actions">
          {(mode === "evoluida" || mode === "vs") && (
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
            onChange={(v) => setMode(v as PenduloMode)}
            options={(Object.keys(MODE_LABELS) as PenduloMode[]).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
            className="!w-auto shrink-0"
          />
          <div className="workspace-links">
            <button className="workspace-link" onClick={() => setStatsOpen(true)} disabled={mode !== "evoluida" || !gaRunResult}>
              <Icon name="query_stats" className="text-[13px]" /> Última geração
            </button>
          </div>
        </div>

        <div className="canvas-body">
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(255,107,214,0.06),transparent_60%)]">
            <StageHint>
              {mode === "play" ? (
                <>
                  TEMPO <b className="readout-glow font-semibold text-primary">{live.elapsed.toFixed(1)}s</b>
                  {liveBestSteps > 0 && (
                    <>
                      {" "}
                      · MELHOR DA SESSÃO{" "}
                      <b className="readout-glow font-semibold text-primary">{(liveBestSteps * PENDULO_DT).toFixed(1)}s</b>
                    </>
                  )}
                  {!live.alive && (
                    <>
                      {" "}· <b className="readout-glow font-semibold text-primary">CAIU</b>
                    </>
                  )}
                </>
              ) : mode === "heuristica" ? (
                <>
                  TEMPO <b className="readout-glow font-semibold text-primary">{heuristicLive.elapsed.toFixed(1)}s</b>
                  {" "}· POSIÇÃO <b className="readout-glow font-semibold text-primary">{heuristicLive.x.toFixed(2)}m</b>
                  {!heuristicLive.alive && (
                    <>
                      {" "}· <b className="readout-glow font-semibold text-primary">CAIU</b>
                    </>
                  )}
                </>
              ) : mode === "vs" ? (
                <>
                  REDE <b className="readout-glow font-semibold text-primary">{nnVs ? (nnVs.elapsed).toFixed(1) : "—"}s</b>
                  {" "}· PD <b className="readout-glow font-semibold text-primary">{heuristicVs ? heuristicVs.elapsed.toFixed(1) : "—"}s</b>
                  {raceWinner && (
                    <>
                      {" "}
                      ·{" "}
                      <b className="readout-glow font-semibold text-primary">
                        {raceWinner === "nn" ? "REDE NEURAL VENCEU" : raceWinner === "heuristic" ? "PD VENCEU" : "EMPATE"}
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
                  </b>
                  {bestOfGeneration && (
                    <>
                      {" "}
                      · SOBREVIVEU <b className="readout-glow font-semibold text-primary">{bestOfGeneration.elapsed.toFixed(1)}s</b>
                    </>
                  )}
                </>
              )}
            </StageHint>

            {mode === "play" ? (
              <Pendulo2D x={live.x} theta={live.theta} alive={live.alive} accentColor="#ff6bd6" />
            ) : mode === "heuristica" ? (
              <Pendulo2D x={heuristicLive.x} theta={heuristicLive.theta} alive={heuristicLive.alive} accentColor="#7ea8f5" />
            ) : mode === "vs" ? (
              raceGenome && nnVs && heuristicVs ? (
                <div className="flex h-full w-full">
                  <div className="flex h-full w-1/2 flex-col border-r border-white/10">
                    <div className="min-h-0 flex-1">
                      <Pendulo2D x={nnVs.x} theta={nnVs.theta} alive={nnVs.alive} label="Rede Neural" accentColor="#ff6bd6" />
                    </div>
                    <div className="h-[140px] shrink-0 border-t border-white/10">
                      <NetworkViz genome={raceGenome} inputs={extractInputs(nnVs)} accentColor="#ff6bd6" />
                    </div>
                  </div>
                  <div className="h-full w-1/2">
                    <Pendulo2D x={heuristicVs.x} theta={heuristicVs.theta} alive={heuristicVs.alive} label="Heurístico (PD)" accentColor="#7ea8f5" />
                  </div>
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-[12px] text-on-surface-variant">
                  <p className="max-w-xs">
                    Rode uma evolução primeiro para ter uma rede treinada - ela corre com o melhor
                    genoma encontrado.
                  </p>
                  <button className="btn-pill btn-pill-primary" style={{ flex: "none" }} onClick={runGenetic} disabled={gaRunning}>
                    <Icon name="play_arrow" className="text-[15px]" /> {gaRunning ? "Evoluindo…" : "Rodar evolução"}
                  </button>
                </div>
              )
            ) : currentFrame && playback && currentInputs ? (
              <div className="flex h-full w-full flex-col lg:flex-row">
                <div className="min-h-0 flex-1 lg:w-1/2">
                  <Pendulo2D x={currentFrame.x} theta={currentFrame.theta} alive={currentFrame.alive} accentColor="#ff6bd6" />
                </div>
                <div className="h-[160px] shrink-0 border-t border-white/10 lg:h-auto lg:w-1/2 lg:border-l lg:border-t-0">
                  <NetworkViz genome={playback.genome} inputs={currentInputs} accentColor="#ff6bd6" />
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-[12px] text-on-surface-variant">
                <p className="max-w-xs">Rode uma evolução para assistir a rede aprendendo a equilibrar o pêndulo.</p>
                <button className="btn-pill btn-pill-primary" style={{ flex: "none" }} onClick={runGenetic} disabled={gaRunning}>
                  <Icon name="play_arrow" className="text-[15px]" /> {gaRunning ? "Evoluindo…" : "Rodar evolução"}
                </button>
              </div>
            )}

            {mode === "play" && (
              <div className="pointer-events-auto absolute bottom-4 right-4 z-[1] flex gap-2">
                <button
                  className="g2048-dpad-btn"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    pushRef.current = "left";
                  }}
                  aria-label="Empurrar para a esquerda"
                >
                  <Icon name="keyboard_arrow_left" className="text-[18px]" />
                </button>
                <button
                  className="g2048-dpad-btn"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    pushRef.current = "right";
                  }}
                  aria-label="Empurrar para a direita"
                >
                  <Icon name="keyboard_arrow_right" className="text-[18px]" />
                </button>
              </div>
            )}
          </div>

          {mode === "evoluida" && gaRunResult && (
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
                {live.alive ? "SETA ESQUERDA/DIREITA EMPURRA O CARRINHO" : "CAIU — REINICIE PARA TENTAR DE NOVO"}
              </span>
              <button className="btn-pill" onClick={resetLive}>
                <Icon name="refresh" className="text-[15px]" /> Novo jogo
              </button>
            </div>
          ) : mode === "heuristica" ? (
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 bg-background px-4 sm:px-5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${heuristicLive.alive ? "animate-pulse" : ""}`} style={{ background: "var(--tertiary)" }} />
                {heuristicLive.alive ? "CONTROLADOR PD RODANDO SOZINHO" : "CAIU"}
              </span>
              <button className="btn-pill" onClick={resetHeuristic}>
                <Icon name="refresh" className="text-[15px]" /> Reiniciar
              </button>
            </div>
          ) : mode === "vs" ? (
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 bg-background px-4 sm:px-5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${raceGenome && !raceWinner ? "animate-pulse" : ""}`}
                  style={{ background: "var(--tertiary)" }}
                />
                {!raceGenome ? "SEM REDE TREINADA — RODE UMA EVOLUÇÃO" : raceWinner ? "CORRIDA ENCERRADA" : "CORRENDO…"}
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
                setFrameIndex(playback.frames.length - 1);
                setPlaying(false);
              }}
              current={frameIndex}
              total={playback?.frames.length ?? 0}
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
              ["Tempo sobrevivido", `${bestOfGeneration.elapsed.toFixed(1)}s`],
              ["Passos", bestOfGeneration.steps],
              ["Sobreviveu até o fim", bestOfGeneration.alive ? "Sim" : "Não"],
              ["Posição final", `${bestOfGeneration.x.toFixed(2)}m`],
            ]}
          />
        )}
      </Modal>
    </div>
  );
}
