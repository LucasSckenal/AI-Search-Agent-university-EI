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
import {
  generateCities,
  tourLength,
  nearestNeighborTour,
  twoOptSteps,
  TourStep,
  heldKarpOptimal,
  HeldKarpResult,
  HELD_KARP_MAX_CITIES,
} from "@/lib/tsp/model";
import { buildTspGaOps, TspGenome } from "@/lib/tsp/genetic";
import { GeneticModal, TspGaFormConfig } from "@/components/tsp/GeneticModal";

// WebGL only exists in the browser; loading it as a dynamic, SSR-disabled component keeps the
// three.js/react-three-fiber bundle out of the server render entirely (same pattern as labirinto's
// MazeCanvas / cubo's Cube3D).
const TspCanvas = dynamic(() => import("@/components/tsp/TspCanvas").then((m) => m.TspCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">
      Carregando cenário 3D…
    </div>
  ),
});

type TspMode = "nn" | "twoopt" | "genetic" | "optimal";

const MODE_LABELS: Record<TspMode, string> = {
  nn: "Vizinho Mais Próximo",
  twoopt: "2-opt",
  genetic: "Algoritmo Genético",
  optimal: "Ótimo (Held-Karp)",
};

export default function TspPage() {
  const [cityCount, setCityCount] = useState(10);
  // Deterministic placeholder for SSR (avoids a hydration mismatch, same precedent as labirinto's
  // empty-maze placeholder); the mount effect below immediately replaces it with a real random
  // seed on the client.
  const [seed, setSeed] = useState(1);
  const cities = useMemo(() => generateCities(cityCount, seed), [cityCount, seed]);
  const [mode, setMode] = useState<TspMode>("nn");

  const [paramsOpen, setParamsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [showGhostOptimal, setShowGhostOptimal] = useState(false);

  const nnTour = useMemo(() => (cities.length > 0 ? nearestNeighborTour(cities) : []), [cities]);
  const nnLength = useMemo(() => (nnTour.length > 0 ? tourLength(cities, nnTour) : 0), [cities, nnTour]);

  const [twoOptRun, setTwoOptRun] = useState<TourStep[] | null>(null);
  const [twoOptFrame, setTwoOptFrame] = useState(0);
  const [twoOptPlaying, setTwoOptPlaying] = useState(false);
  const [twoOptElapsedMs, setTwoOptElapsedMs] = useState<number | null>(null);

  const [optimalResult, setOptimalResult] = useState<HeldKarpResult | null>(null);
  const [optimalElapsedMs, setOptimalElapsedMs] = useState<number | null>(null);
  const heldKarpAvailable = cities.length <= HELD_KARP_MAX_CITIES;

  const [gaOpen, setGaOpen] = useState(false);
  const [genPickerOpen, setGenPickerOpen] = useState(false);
  const [gaConfig, setGaConfig] = useState<TspGaFormConfig>({
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
  const [gaRunResult, setGaRunResult] = useState<GaRunResult<TspGenome> | null>(null);
  const [gaElapsedMs, setGaElapsedMs] = useState<number | null>(null);
  const [selectedGeneration, setSelectedGeneration] = useState(0);
  const [gaPlaying, setGaPlaying] = useState(false);

  // Replaces the deterministic SSR placeholder seed with a real random one once mounted on the
  // client, so every page load starts on a different city layout without risking a hydration
  // mismatch (see the placeholder's own comment above).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time swap from the SSR placeholder seed to a real random one
    setSeed(randomSeed());
  }, []);

  // New city instance (count or seed changed): every run mode's result is tied to the previous
  // set of cities, so all of them go stale together instead of showing a tour computed for a
  // different instance.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale per-instance results whenever the city set changes
    setTwoOptRun(null);
    setTwoOptFrame(0);
    setTwoOptPlaying(false);
    setOptimalResult(null);
    setGaRunResult(null);
    setGaLiveGenerations([]);
    setGaPlaying(false);
    setMode("nn");
  }, [cities]);

  const runTwoOpt = () => {
    const start = performance.now();
    const steps = twoOptSteps(cities, nnTour);
    setTwoOptRun(steps);
    setTwoOptFrame(0);
    setTwoOptPlaying(false);
    setTwoOptElapsedMs(performance.now() - start);
  };

  const runOptimal = () => {
    if (!heldKarpAvailable) return;
    const start = performance.now();
    const result = heldKarpOptimal(cities);
    setOptimalResult(result);
    setOptimalElapsedMs(performance.now() - start);
  };

  // Evolves gaConfig.generations generations, chunked across setTimeout(0) ticks so a large
  // population×generations run never blocks the main thread in one go - same shape already
  // proven in labirinto/goose's GA runners.
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
    const ops = buildTspGaOps(cities);
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
          setSelectedGeneration(finalResult.generations.length - 1);
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
    if (mode === "twoopt") runTwoOpt();
    else if (mode === "optimal") runOptimal();
    else if (mode === "genetic") runGenetic();
  };

  // 2-opt scrub: advances one accepted swap per tick, so the route visibly "untangles" swap by swap.
  useEffect(() => {
    if (!twoOptPlaying || !twoOptRun) return;
    if (twoOptFrame >= twoOptRun.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setTwoOptPlaying(false);
      return;
    }
    const t = setTimeout(() => setTwoOptFrame((f) => Math.min(f + 1, twoOptRun.length - 1)), 110);
    return () => clearTimeout(t);
  }, [twoOptPlaying, twoOptFrame, twoOptRun]);

  // GA generation scrub: same 60ms-tick shape as maze/page.tsx's GA scrubber.
  useEffect(() => {
    if (!gaPlaying || !gaRunResult) return;
    if (selectedGeneration >= gaRunResult.generations.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setGaPlaying(false);
      return;
    }
    const t = setTimeout(() => setSelectedGeneration((g) => Math.min(g + 1, gaRunResult.generations.length - 1)), 60);
    return () => clearTimeout(t);
  }, [gaPlaying, selectedGeneration, gaRunResult]);

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

  const activeTour: number[] | null = useMemo(() => {
    if (mode === "nn") return nnTour;
    if (mode === "twoopt") return twoOptRun ? twoOptRun[twoOptFrame].tour : nnTour;
    if (mode === "optimal") return optimalResult?.tour ?? null;
    if (mode === "genetic") return gaRunResult?.bestPerGeneration[selectedGeneration] ?? null;
    return null;
  }, [mode, nnTour, twoOptRun, twoOptFrame, optimalResult, gaRunResult, selectedGeneration]);

  const activeLength = useMemo(() => {
    if (!activeTour || activeTour.length === 0) return null;
    return tourLength(cities, activeTour);
  }, [cities, activeTour]);

  const pctOverOptimal = useMemo(() => {
    if (!optimalResult || activeLength === null) return null;
    return ((activeLength - optimalResult.length) / optimalResult.length) * 100;
  }, [optimalResult, activeLength]);

  const highlightEdges = mode === "twoopt" && twoOptRun ? twoOptRun[twoOptFrame].newEdges : undefined;
  const compareTour = showGhostOptimal ? (optimalResult?.tour ?? null) : null;

  const status =
    mode === "twoopt"
      ? twoOptPlaying
        ? "OTIMIZANDO"
        : twoOptRun
          ? twoOptFrame >= twoOptRun.length - 1
            ? "ÓTIMO LOCAL"
            : "PRONTO"
          : "AGUARDANDO EXECUÇÃO"
      : mode === "genetic"
        ? gaRunning
          ? "EVOLUINDO"
          : gaRunResult
            ? "CONCLUÍDO"
            : "AGUARDANDO EXECUÇÃO"
        : mode === "optimal"
          ? optimalResult
            ? "CONCLUÍDO"
            : heldKarpAvailable
              ? "AGUARDANDO EXECUÇÃO"
              : "INDISPONÍVEL"
          : "CALCULADO";

  const runLabel =
    mode === "twoopt" ? "Rodar 2-opt" : mode === "optimal" ? "Calcular ótimo" : mode === "genetic" ? "Rodar evolução" : "Calculado";
  const runDisabled = mode === "nn" || (mode === "optimal" && !heldKarpAvailable) || (mode === "genetic" && gaRunning);

  const currentModeResult = useMemo(() => {
    switch (mode) {
      case "nn":
        return { length: nnLength, elapsedMs: null as number | null };
      case "twoopt":
        return twoOptRun ? { length: twoOptRun[twoOptRun.length - 1].length, elapsedMs: twoOptElapsedMs } : null;
      case "optimal":
        return optimalResult ? { length: optimalResult.length, elapsedMs: optimalElapsedMs } : null;
      case "genetic":
        return gaRunResult ? { length: tourLength(cities, gaRunResult.bestEverGenome), elapsedMs: gaElapsedMs } : null;
    }
  }, [mode, nnLength, twoOptRun, twoOptElapsedMs, optimalResult, optimalElapsedMs, gaRunResult, gaElapsedMs, cities]);

  const compareItems: [string, string][] = useMemo(() => {
    const optimalLen = optimalResult?.length ?? null;
    const row = (label: string, length: number | null): [string, string] => {
      if (length === null) return [label, "—"];
      // Clamped to 0 below optimalLen: floating-point tour-length sums can land a hair under the
      // DP's own optimal length even for the literal same tour, which would otherwise print as a
      // nonsensical "+-0.0%".
      const pct = optimalLen !== null ? Math.max(0, ((length - optimalLen) / optimalLen) * 100) : null;
      return [label, `${length.toFixed(1)}${pct !== null ? ` (+${pct.toFixed(1)}%)` : ""}`];
    };
    return [
      row(MODE_LABELS.nn, nnLength),
      row(MODE_LABELS.twoopt, twoOptRun ? twoOptRun[twoOptRun.length - 1].length : null),
      row(MODE_LABELS.genetic, gaRunResult ? tourLength(cities, gaRunResult.bestEverGenome) : null),
      row(MODE_LABELS.optimal, optimalLen),
    ];
  }, [nnLength, twoOptRun, gaRunResult, cities, optimalResult]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Caixeiro Viajante</span>
            <span>/</span>
            <span className="accent">{MODE_LABELS[mode]}</span>
          </div>
          <h1 className="content-title">Caixeiro Viajante</h1>
          <p className="content-sub">
            Encontre a rota mais curta que visita todas as cidades exatamente uma vez e retorna ao
            início. Compare uma heurística construtiva, uma busca local, um algoritmo genético e a
            solução exata.
          </p>
        </div>
        <div className="content-actions">
          <button className="btn-pill" onClick={() => setParamsOpen(true)}>
            <Icon name="tune" className="text-[15px]" /> Parâmetros
          </button>
          <button className="btn-pill btn-pill-primary" onClick={runActive} disabled={runDisabled}>
            <Icon name="play_arrow" className="text-[15px]" /> {runLabel}
          </button>
        </div>
      </div>

      <div className="workspace-card">
        <div className="workspace-head">
          <Select
            value={mode}
            onChange={(v) => setMode(v as TspMode)}
            options={(Object.keys(MODE_LABELS) as TspMode[]).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
          />
          <div className="workspace-links">
            <button className="workspace-link" onClick={() => setGaOpen(true)}>
              <Icon name="psychology" className="text-[13px]" /> Genético
            </button>
            <button
              className={`workspace-link ${showGhostOptimal ? "text-primary" : ""}`}
              onClick={() => setShowGhostOptimal((v) => !v)}
              disabled={!optimalResult}
            >
              <Icon name="visibility" className="text-[13px]" /> Comparar com ótimo
            </button>
            <button className="workspace-link" onClick={() => setCompareOpen(true)}>
              <Icon name="compare_arrows" className="text-[13px]" /> Comparação
            </button>
            <button className="workspace-link" onClick={() => setStatsOpen(true)} disabled={!currentModeResult}>
              <Icon name="query_stats" className="text-[13px]" /> Última execução
            </button>
          </div>
        </div>

        <div className="canvas-body">
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(175,198,255,0.06),transparent_60%)]">
            <StageHint>
              CIDADES <b className="readout-glow font-semibold text-primary">{cityCount}</b> · MODO{" "}
              <b className="readout-glow font-semibold text-primary">{MODE_LABELS[mode]}</b>
              {activeLength !== null && (
                <>
                  {" "}
                  · ROTA <b className="readout-glow font-semibold text-primary">{activeLength.toFixed(1)}</b>
                </>
              )}
              {pctOverOptimal !== null && pctOverOptimal > 0.05 && (
                <>
                  {" "}
                  · <b className="readout-glow font-semibold text-primary">+{pctOverOptimal.toFixed(1)}%</b> acima do ótimo
                </>
              )}
              {mode === "optimal" && !heldKarpAvailable && (
                <> · Reduza para ≤{HELD_KARP_MAX_CITIES} cidades para calcular o ótimo</>
              )}
            </StageHint>
            <WebGLGate>
              <TspCanvas cities={cities} tour={activeTour} compareTour={compareTour} highlightEdges={highlightEdges} />
            </WebGLGate>
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

          {mode === "genetic" ? (
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
            />
          ) : mode === "twoopt" ? (
            <Timeline
              status={status}
              pulsing={twoOptPlaying}
              playing={twoOptPlaying}
              onTogglePlay={() => setTwoOptPlaying((p) => !p)}
              onSkipEnd={() => {
                if (!twoOptRun) return;
                setTwoOptFrame(twoOptRun.length - 1);
                setTwoOptPlaying(false);
              }}
              current={twoOptFrame}
              total={twoOptRun?.length ?? 0}
              unitLabel="trocas"
              disabled={!twoOptRun}
            />
          ) : (
            <Timeline
              status={status}
              pulsing={false}
              playing={false}
              onTogglePlay={() => {}}
              onSkipEnd={() => {}}
              current={0}
              total={0}
              unitLabel="—"
              disabled
            />
          )}
        </div>
      </div>

      <GeneticModal
        open={gaOpen}
        onClose={() => setGaOpen(false)}
        cities={cities}
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
        {currentModeResult && (
          <StatGrid
            cols={2}
            items={[
              ["Modo", MODE_LABELS[mode]],
              ["Distância", currentModeResult.length.toFixed(1)],
              ["Tempo", currentModeResult.elapsedMs !== null ? `${currentModeResult.elapsedMs.toFixed(1)}ms` : "—"],
              [
                "% acima do ótimo",
                optimalResult ? `${(((currentModeResult.length - optimalResult.length) / optimalResult.length) * 100).toFixed(1)}%` : "—",
              ],
            ]}
          />
        )}
      </Modal>

      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Comparação entre modos"
        subtitle="Mesma instância de cidades para todos — rode cada modo para preencher a comparação"
        wide
      >
        <StatGrid cols={3} items={compareItems} />
      </Modal>

      <Modal open={paramsOpen} onClose={() => setParamsOpen(false)} title="Parâmetros" subtitle="Número de cidades e seed da instância">
        <Field label={`Cidades: ${cityCount}`}>
          <input type="range" min={4} max={60} value={cityCount} onChange={(e) => setCityCount(Number(e.target.value))} />
        </Field>
        <div className="border-t border-outline-variant pt-4">
          <Field label="Seed">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value) || 0)}
                className="w-full"
              />
              <button className="btn btn-secondary !px-2.5" onClick={() => setSeed(randomSeed())} title="Novo seed aleatório">
                <Icon name="casino" className="text-[16px]" />
              </button>
            </div>
          </Field>
        </div>
        {!heldKarpAvailable && (
          <p className="text-[11px] leading-relaxed text-on-surface-variant">
            O modo Ótimo (Held-Karp) exige no máximo {HELD_KARP_MAX_CITIES} cidades — reduza o
            slider acima para poder calcular a solução exata.
          </p>
        )}
      </Modal>
    </div>
  );
}
