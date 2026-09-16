"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/shared/Panel";
import { StageHint } from "@/components/shared/Stage";
import { Timeline } from "@/components/shared/Timeline";
import { WebGLGate } from "@/components/shared/WebGLGate";
import { evolve, GaConfig, GaGenerationSummary, GaRunResult } from "@/lib/core/genetic";
import { buildExplorerGaOps, finalDistance, simulatePath, Genome } from "@/lib/algoritmo-genetico/model";
import { randomSeed } from "@/lib/core/rng";
import { GeneticModal, ExplorerGaFormConfig } from "@/components/algoritmo-genetico/GeneticModal";

const PopulationArena3D = dynamic(
  () => import("@/components/algoritmo-genetico/PopulationArena3D").then((m) => m.PopulationArena3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">
        Carregando arena 3D…
      </div>
    ),
  }
);

export default function AlgoritmoGeneticoPage() {
  const [gaOpen, setGaOpen] = useState(false);
  const [gaConfig, setGaConfig] = useState<ExplorerGaFormConfig>({
    populationSize: 40,
    generations: 25,
    mutationRate: 0.15,
    crossoverRate: 0.7,
    eliteCount: 3,
    tournamentSize: 4,
    seed: randomSeed(),
  });
  const [gaRunning, setGaRunning] = useState(false);
  const [gaProgressGen, setGaProgressGen] = useState(0);
  const [gaLiveGenerations, setGaLiveGenerations] = useState<GaGenerationSummary[]>([]);
  const [gaRunResult, setGaRunResult] = useState<GaRunResult<Genome> | null>(null);
  const [gaElapsedMs, setGaElapsedMs] = useState<number | null>(null);

  const [selectedGeneration, setSelectedGeneration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const runGenetic = () => {
    setGaRunning(true);
    setGaRunResult(null);
    setGaLiveGenerations([]);
    setGaProgressGen(0);
    setSelectedGeneration(0);
    setPlaying(false);

    const config: GaConfig = {
      populationSize: gaConfig.populationSize,
      generations: gaConfig.generations,
      eliteCount: gaConfig.eliteCount,
      mutationRate: gaConfig.mutationRate,
      crossoverRate: gaConfig.crossoverRate,
      tournamentSize: gaConfig.tournamentSize,
      seed: gaConfig.seed,
      // The whole point of this explainer is watching the whole population move, not just the
      // best individual (unlike Pêndulo/Goose) - topK = populationSize keeps every genome of every
      // generation, not just the top one.
      topK: gaConfig.populationSize,
    };
    const ops = buildExplorerGaOps();
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

  const generationView = useMemo(() => {
    if (!gaRunResult) return null;
    const genomes = gaRunResult.topPerGeneration[selectedGeneration];
    if (!genomes) return null;
    const paths = genomes.map((g) => simulatePath(g));
    const fitnesses = genomes.map((g) => -finalDistance(g));
    return { paths, fitnesses, bestIndex: 0 };
  }, [gaRunResult, selectedGeneration]);

  useEffect(() => {
    if (!playing || !gaRunResult) return;
    if (selectedGeneration >= gaRunResult.generations.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setSelectedGeneration((g) => Math.min(g + 1, gaRunResult.generations.length - 1)), 700 / speed);
    return () => clearTimeout(t);
  }, [playing, selectedGeneration, speed, gaRunResult]);

  const stepGeneration = (delta: number) => {
    if (!gaRunResult) return;
    setSelectedGeneration((g) => Math.max(0, Math.min(gaRunResult.generations.length - 1, g + delta)));
    setPlaying(false);
  };

  const bestFitnessThisGen = gaRunResult?.generations[selectedGeneration]?.bestFitness;
  const status = gaRunning ? "EVOLUINDO" : gaRunResult ? "OBSERVANDO GERAÇÃO" : "PRONTO";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Algoritmo Genético</span>
            <span>/</span>
            <span className="accent">Otimização por Evolução</span>
          </div>
          <h1 className="content-title">Algoritmo Genético</h1>
          <p className="content-sub">
            Uma população inteira de sequências de movimento evolui, geração após geração, até
            chegar perto do alvo - sem nenhuma regra de navegação, só seleção (os mais aptos
            reproduzem mais), cruzamento (dois percursos viram um terceiro) e mutação (um passo
            aleatório muda de direção). Veja a população inteira se mexendo ao mesmo tempo e o
            enxame convergindo para o alvo geração a geração.
          </p>
        </div>
        <div className="content-actions">
          <button className="btn-pill" onClick={() => setGaOpen(true)}>
            <Icon name="tune" className="text-[15px]" /> Parâmetros
          </button>
          <button className="btn-pill btn-pill-primary" onClick={runGenetic} disabled={gaRunning}>
            <Icon name="play_arrow" className="text-[15px]" /> {gaRunning ? "Evoluindo…" : "Rodar evolução"}
          </button>
        </div>
      </div>

      <div className="workspace-card">
        <div className="canvas-body">
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(126,224,168,0.06),transparent_60%)]">
            <StageHint>
              GERAÇÃO{" "}
              <b className="readout-glow font-semibold text-primary">
                {gaRunResult ? selectedGeneration : "—"}
                {gaRunResult ? ` / ${gaRunResult.generations.length - 1}` : ""}
              </b>
              {bestFitnessThisGen !== undefined && (
                <>
                  {" · MELHOR FITNESS "}
                  <b className="readout-glow font-semibold text-primary">{bestFitnessThisGen.toFixed(2)}</b>
                </>
              )}
            </StageHint>

            {generationView ? (
              <WebGLGate>
                <PopulationArena3D
                  paths={generationView.paths}
                  fitnesses={generationView.fitnesses}
                  bestIndex={generationView.bestIndex}
                />
              </WebGLGate>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-[12px] text-on-surface-variant">
                <p className="max-w-xs">Rode uma evolução para ver a população inteira convergindo para o alvo.</p>
                <button className="btn-pill btn-pill-primary" style={{ flex: "none" }} onClick={runGenetic} disabled={gaRunning}>
                  <Icon name="play_arrow" className="text-[15px]" /> {gaRunning ? "Evoluindo…" : "Rodar evolução"}
                </button>
              </div>
            )}
          </div>

          {gaRunResult && (
            <div className="flex shrink-0 items-center justify-center gap-3 bg-background px-4 py-2 text-[11px] text-on-surface-variant">
              <button
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-on-surface transition-colors hover:bg-white/10 disabled:opacity-30"
                onClick={() => stepGeneration(-1)}
                disabled={selectedGeneration <= 0}
              >
                <Icon name="chevron_left" className="text-[16px]" />
              </button>
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-on-surface">
                Geração {selectedGeneration}
              </span>
              <button
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-on-surface transition-colors hover:bg-white/10 disabled:opacity-30"
                onClick={() => stepGeneration(1)}
                disabled={selectedGeneration >= gaRunResult.generations.length - 1}
              >
                <Icon name="chevron_right" className="text-[16px]" />
              </button>
            </div>
          )}

          <Timeline
            status={status}
            pulsing={playing}
            playing={playing}
            onTogglePlay={() => setPlaying((p) => !p)}
            onSkipEnd={() => {
              if (!gaRunResult) return;
              setSelectedGeneration(gaRunResult.generations.length - 1);
              setPlaying(false);
            }}
            current={selectedGeneration}
            total={gaRunResult ? gaRunResult.generations.length - 1 : 0}
            unitLabel="gerações"
            disabled={!gaRunResult}
            speed={speed}
            onSpeedChange={setSpeed}
            speedLabel="Velocidade"
            speedMax={8}
          />
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
    </div>
  );
}
