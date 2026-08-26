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
import { GaGenerationSummary } from "@/lib/core/genetic";
import { randomSeed } from "@/lib/core/rng";
import { GaConvergenceChart } from "@/components/shared/GaConvergenceChart";
import {
  QLearningResult,
  ValueIterationResult,
  generateGridWorld,
  greedyPolicyFromQ,
  greedyRolloutWithReward,
  maxQPerState,
  runQLearning,
  valueIteration,
} from "@/lib/rl/model";

// WebGL only exists in the browser; loading it as a dynamic, SSR-disabled component keeps the
// three.js/react-three-fiber bundle out of the server render entirely (same pattern as tsp/rainhas).
const RLCanvas = dynamic(() => import("@/components/rl/RLCanvas").then((m) => m.RLCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">
      Carregando cenário 3D…
    </div>
  ),
});

type RLMode = "qlearning" | "valueiteration";

const MODE_LABELS: Record<RLMode, string> = {
  qlearning: "Q-Learning",
  valueiteration: "Iteração de Valor",
};

interface RLFormConfig {
  alpha: number;
  gamma: number;
  epsilonStart: number;
  epsilonEnd: number;
  episodes: number;
  slipChance: number;
}

export default function RLPage() {
  const [size, setSize] = useState(6);
  // Deterministic placeholder for SSR (avoids a hydration mismatch, same precedent as tsp/rainhas'
  // own seed placeholder); the mount effect below immediately replaces it with a real random seed.
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState<RLMode>("qlearning");

  const [paramsOpen, setParamsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [episodePickerOpen, setEpisodePickerOpen] = useState(false);

  const [rlConfig, setRlConfig] = useState<RLFormConfig>({
    alpha: 0.5,
    gamma: 0.95,
    epsilonStart: 1,
    epsilonEnd: 0.05,
    episodes: 600,
    slipChance: 0,
  });

  const [qResult, setQResult] = useState<QLearningResult | null>(null);
  const [qElapsedMs, setQElapsedMs] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState(0);
  const [qPlaying, setQPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const [viResult, setViResult] = useState<ValueIterationResult | null>(null);
  const [viElapsedMs, setViElapsedMs] = useState<number | null>(null);

  // Replaces the deterministic SSR placeholder seed with a real random one once mounted on the
  // client, so every page load starts on a different grid-world instance without risking a
  // hydration mismatch (see the placeholder's own comment above).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time swap from the SSR placeholder seed to a real random one
    setSeed(randomSeed());
  }, []);

  // World generation is pure and cheap for these grid sizes - no need for a "generate" button, the
  // canvas just always shows the instance the current size/seed produce (same idea as the maze page
  // showing a maze before any search has run).
  const world = useMemo(() => generateGridWorld(size, size, seed), [size, seed]);

  // New instance (size or seed changed): both algorithms' results are tied to the previous world,
  // so they go stale together instead of showing a heatmap computed for a different grid.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale per-instance results whenever size/seed changes
    setQResult(null);
    setViResult(null);
    setSelectedEpisode(0);
    setQPlaying(false);
  }, [size, seed]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- stops the episode-scrub loop when the visible mode changes away from it
    setQPlaying(false);
  }, [mode]);

  const runQLearningNow = () => {
    const start = performance.now();
    const result = runQLearning(world, {
      alpha: rlConfig.alpha,
      gamma: rlConfig.gamma,
      epsilonStart: rlConfig.epsilonStart,
      epsilonEnd: rlConfig.epsilonEnd,
      episodes: rlConfig.episodes,
      maxStepsPerEpisode: size * size * 4,
      slipChance: rlConfig.slipChance,
      seed,
    });
    setQResult(result);
    setQElapsedMs(performance.now() - start);
    // Land on episode 0, not the final one - pressing play should replay the whole training run
    // from scratch, not require rewinding through the picker first.
    setSelectedEpisode(0);
    setQPlaying(false);
    setMode("qlearning");
  };

  const runValueIterationNow = () => {
    const start = performance.now();
    const result = valueIteration(world, rlConfig.gamma, rlConfig.slipChance);
    setViResult(result);
    setViElapsedMs(performance.now() - start);
    setMode("valueiteration");
  };

  const runActive = () => {
    if (mode === "qlearning") runQLearningNow();
    else runValueIterationNow();
  };

  // Episode scrub: advances `playbackSpeed` episodes per tick, replaying how the learned Q-table
  // (sampled every ~5% of episodes) evolved over the course of training - same 60ms-tick shape as
  // tsp/rainhas' own GA generation scrubber.
  useEffect(() => {
    if (!qPlaying || !qResult) return;
    if (selectedEpisode >= qResult.episodes.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setQPlaying(false);
      return;
    }
    const t = setTimeout(() => setSelectedEpisode((e) => Math.min(e + playbackSpeed, qResult.episodes.length - 1)), 60);
    return () => clearTimeout(t);
  }, [qPlaying, selectedEpisode, qResult, playbackSpeed]);

  // The Q-table is only sampled every ~5% of episodes (see runQLearning), so the scrub finds the
  // most recent snapshot at or before the selected episode instead of expecting an exact match.
  const nearestSnapshot = useMemo(() => {
    if (!qResult || qResult.qTableSnapshots.length === 0) return null;
    let best = qResult.qTableSnapshots[0];
    for (const snap of qResult.qTableSnapshots) {
      if (snap.episode <= selectedEpisode) best = snap;
      else break;
    }
    return best;
  }, [qResult, selectedEpisode]);

  // Jumps between snapshots rather than raw episodes - the heatmap only actually changes at
  // snapshot boundaries (see runQLearning's ~5%-of-episodes sampling), so stepping one-by-one
  // through individual episodes would mostly look like nothing happened.
  const stepSnapshot = (delta: number) => {
    if (!qResult || !nearestSnapshot) return;
    const idx = qResult.qTableSnapshots.findIndex((s) => s.episode === nearestSnapshot.episode);
    const nextIdx = Math.max(0, Math.min(qResult.qTableSnapshots.length - 1, idx + delta));
    setSelectedEpisode(qResult.qTableSnapshots[nextIdx].episode);
    setQPlaying(false);
  };

  const jumpToSnapshot = (episode: number) => {
    setSelectedEpisode(episode);
    setQPlaying(false);
    setEpisodePickerOpen(false);
  };

  const activeValues = useMemo(() => {
    if (mode === "qlearning") return nearestSnapshot ? maxQPerState(nearestSnapshot.q, size * size) : null;
    return viResult?.values ?? null;
  }, [mode, nearestSnapshot, viResult, size]);

  const activeRollout = useMemo(() => {
    const policy =
      mode === "qlearning"
        ? nearestSnapshot
          ? greedyPolicyFromQ(nearestSnapshot.q, size * size)
          : null
        : (viResult?.policy ?? null);
    if (!policy) return null;
    return greedyRolloutWithReward(world, policy, size * size * 4);
  }, [mode, nearestSnapshot, viResult, world, size]);

  const status = useMemo(() => {
    if (mode === "qlearning") {
      if (!qResult) return "AGUARDANDO EXECUÇÃO";
      return qPlaying ? "REPRODUZINDO" : "CONCLUÍDO";
    }
    return viResult ? "CONCLUÍDO" : "AGUARDANDO EXECUÇÃO";
  }, [mode, qResult, qPlaying, viResult]);

  const runLabel = mode === "qlearning" ? "Rodar Q-learning" : "Rodar iteração de valor";

  // Reward-per-episode reuses GaConvergenceChart's best/mean-line shape: "best" is each episode's
  // raw reward, "mean" is a rolling average over the last 20 episodes (population mean has no
  // equivalent here, since Q-learning trains a single agent, not a population).
  const rewardSeries: GaGenerationSummary[] = useMemo(() => {
    if (!qResult) return [];
    const WINDOW = 20;
    const window: number[] = [];
    let sum = 0;
    return qResult.episodes.map((e) => {
      window.push(e.totalReward);
      sum += e.totalReward;
      if (window.length > WINDOW) sum -= window.shift()!;
      const mean = sum / window.length;
      return { generation: e.episode, bestFitness: e.totalReward, meanFitness: mean, worstFitness: Math.min(e.totalReward, mean), stdFitness: 0 };
    });
  }, [qResult]);

  const currentStats: [string, string][] | null = useMemo(() => {
    if (mode === "qlearning") {
      if (!qResult) return null;
      const ep = qResult.episodes[Math.min(selectedEpisode, qResult.episodes.length - 1)];
      const outcomeLabel =
        activeRollout?.outcome === "goal"
          ? "Objetivo alcançado"
          : activeRollout?.outcome === "pit"
            ? "Caiu no buraco"
            : activeRollout
              ? "Não alcançou (tempo esgotado)"
              : "—";
      return [
        ["Episódio", `${selectedEpisode} / ${qResult.episodes.length - 1}`],
        ["Recompensa (episódio)", ep.totalReward.toFixed(2)],
        ["Épsilon", ep.epsilon.toFixed(2)],
        ["Tempo de treino", qElapsedMs !== null ? `${qElapsedMs.toFixed(1)}ms` : "—"],
        ["Resultado (política atual)", outcomeLabel],
        ["Espinhos atingidos", activeRollout ? String(activeRollout.spikeHits.length) : "—"],
      ];
    }
    if (!viResult) return null;
    const outcomeLabel =
      activeRollout?.outcome === "goal"
        ? "Objetivo alcançado"
        : activeRollout?.outcome === "pit"
          ? "Caiu no buraco"
          : activeRollout
            ? "Não alcançou (tempo esgotado)"
            : "—";
    return [
      ["Varreduras", String(viResult.sweeps)],
      ["Recompensa da política", activeRollout ? activeRollout.reward.toFixed(2) : "—"],
      ["Resultado", outcomeLabel],
      ["Espinhos atingidos", activeRollout ? String(activeRollout.spikeHits.length) : "—"],
      ["Tempo", viElapsedMs !== null ? `${viElapsedMs.toFixed(1)}ms` : "—"],
    ];
  }, [mode, qResult, selectedEpisode, qElapsedMs, viResult, viElapsedMs, activeRollout]);

  const compareItems: [string, string][] = useMemo(() => {
    let qRow: [string, string] = [MODE_LABELS.qlearning, "—"];
    if (qResult) {
      const last = qResult.episodes.slice(-Math.max(1, Math.round(qResult.episodes.length * 0.1)));
      const avg = last.reduce((a, e) => a + e.totalReward, 0) / last.length;
      qRow = [MODE_LABELS.qlearning, `${avg.toFixed(2)} recompensa média (últimos 10%)`];
    }
    let viRow: [string, string] = [MODE_LABELS.valueiteration, "—"];
    let lossRow: [string, string] = ["% de recompensa perdida", "—"];
    if (viResult) {
      const viPolicyReward = greedyRolloutWithReward(world, viResult.policy, size * size * 4).reward;
      viRow = [MODE_LABELS.valueiteration, `${viPolicyReward.toFixed(2)} recompensa ótima`];
      if (qResult) {
        const last = qResult.episodes.slice(-Math.max(1, Math.round(qResult.episodes.length * 0.1)));
        const avg = last.reduce((a, e) => a + e.totalReward, 0) / last.length;
        const loss = viPolicyReward !== 0 ? Math.max(0, ((viPolicyReward - avg) / Math.abs(viPolicyReward)) * 100) : 0;
        lossRow = ["% de recompensa perdida", `${loss.toFixed(1)}%`];
      }
    }
    return [qRow, viRow, lossRow];
  }, [qResult, viResult, world, size]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Aprendizado por Reforço</span>
            <span>/</span>
            <span className="accent">{MODE_LABELS[mode]}</span>
          </div>
          <h1 className="content-title">Aprendizado por Reforço</h1>
          <p className="content-sub">
            Um agente aprende a chegar ao objetivo por tentativa e erro num mundo de grade com
            paredes, buracos fatais e espinhos que machucam mas não matam. Compare Q-learning
            (aprende sem conhecer o modelo) com Iteração de Valor (conhece o modelo e converge para
            a política ótima).
          </p>
        </div>
        <div className="content-actions">
          <button className="btn-pill" onClick={() => setCompareOpen(true)}>
            <Icon name="compare_arrows" className="text-[15px]" /> Comparar
          </button>
          <button className="btn-pill btn-pill-primary" onClick={runActive}>
            <Icon name="play_arrow" className="text-[15px]" /> {runLabel}
          </button>
        </div>
      </div>

      <div className="workspace-card">
        <div className="workspace-head">
          <Select
            value={mode}
            onChange={(v) => setMode(v as RLMode)}
            options={(Object.keys(MODE_LABELS) as RLMode[]).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
            className="!w-auto shrink-0"
          />
          <div className="workspace-links">
            <button className="workspace-link" onClick={() => setParamsOpen(true)}>
              <Icon name="tune" className="text-[13px]" /> Parâmetros
            </button>
            <button className="workspace-link" onClick={() => setStatsOpen(true)} disabled={!currentStats}>
              <Icon name="query_stats" className="text-[13px]" /> Última execução
            </button>
          </div>
        </div>

        <div className="canvas-body">
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(126,168,245,0.06),transparent_60%)]">
            <StageHint>
              GRADE <b className="readout-glow font-semibold text-primary">{size}×{size}</b> · MODO{" "}
              <b className="readout-glow font-semibold text-primary">{MODE_LABELS[mode]}</b>
              {activeRollout && (
                <>
                  {" "}
                  · RECOMPENSA <b className="readout-glow font-semibold text-primary">{activeRollout.reward.toFixed(2)}</b>
                  {" "}
                  ·{" "}
                  {activeRollout.outcome === "goal" ? (
                    <b className="readout-glow font-semibold text-primary">✓ Objetivo alcançado</b>
                  ) : activeRollout.outcome === "pit" ? (
                    <b className="readout-glow font-semibold" style={{ color: "#ff5d5d" }}>
                      ✗ Caiu no buraco
                    </b>
                  ) : (
                    <b className="readout-glow font-semibold" style={{ color: "#ffb020" }}>
                      ✗ Não alcançou o objetivo
                    </b>
                  )}
                  {activeRollout.spikeHits.length > 0 && (
                    <>
                      {" "}
                      ·{" "}
                      <b className="readout-glow font-semibold" style={{ color: "#ffb020" }}>
                        {activeRollout.spikeHits.length} espinho(s) atingido(s)
                      </b>
                    </>
                  )}
                </>
              )}
            </StageHint>
            <WebGLGate>
              <RLCanvas world={world} values={activeValues} rollout={activeRollout} />
            </WebGLGate>
          </div>

          {mode === "qlearning" && qResult && (
            <div className="flex shrink-0 items-center justify-center gap-3 bg-background px-4 py-2 text-[11px] text-on-surface-variant">
              <button
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-on-surface transition-colors hover:bg-white/10 disabled:opacity-30"
                onClick={() => stepSnapshot(-1)}
                disabled={!nearestSnapshot || nearestSnapshot.episode === qResult.qTableSnapshots[0].episode}
              >
                <Icon name="chevron_left" className="text-[16px]" />
              </button>
              <button
                onClick={() => setEpisodePickerOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-on-surface transition-colors hover:bg-white/10"
              >
                Episódio {selectedEpisode}
                <Icon name="expand_more" className="text-[14px] text-on-surface-variant" />
              </button>
              <button
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-on-surface transition-colors hover:bg-white/10 disabled:opacity-30"
                onClick={() => stepSnapshot(1)}
                disabled={!nearestSnapshot || nearestSnapshot.episode === qResult.qTableSnapshots[qResult.qTableSnapshots.length - 1].episode}
              >
                <Icon name="chevron_right" className="text-[16px]" />
              </button>
            </div>
          )}

          {mode === "qlearning" ? (
            <Timeline
              status={status}
              pulsing={qPlaying}
              playing={qPlaying}
              onTogglePlay={() => setQPlaying((p) => !p)}
              onSkipEnd={() => {
                if (!qResult) return;
                setSelectedEpisode(qResult.episodes.length - 1);
                setQPlaying(false);
              }}
              current={selectedEpisode}
              total={qResult?.episodes.length ?? 0}
              unitLabel="episódios"
              disabled={!qResult}
              speed={playbackSpeed}
              onSpeedChange={setPlaybackSpeed}
              speedLabel="Velocidade"
              speedMin={1}
              speedMax={30}
            />
          ) : (
            <Timeline status={status} pulsing={false} playing={false} onTogglePlay={() => {}} onSkipEnd={() => {}} current={0} total={0} unitLabel="—" disabled />
          )}
        </div>
      </div>

      <Modal open={episodePickerOpen} onClose={() => setEpisodePickerOpen(false)} title="Escolher episódio" subtitle="Um ponto por snapshot do Q-table (a cada ~5% do treino)" wide>
        {qResult && (
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {qResult.qTableSnapshots.map((snap) => (
              <button
                key={snap.episode}
                onClick={() => jumpToSnapshot(snap.episode)}
                className={`rounded-lg border px-2 py-1.5 font-mono text-[12px] transition-colors ${
                  snap.episode === nearestSnapshot?.episode
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-white/10 bg-white/5 text-on-surface hover:bg-white/10"
                }`}
              >
                {snap.episode}
              </button>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={statsOpen} onClose={() => setStatsOpen(false)} title="Última execução" wide={mode === "qlearning"}>
        {currentStats && <StatGrid cols={2} items={currentStats} />}
        {mode === "qlearning" && rewardSeries.length > 0 && (
          <div className="border-t border-outline-variant pt-4">
            <GaConvergenceChart generations={rewardSeries} unitLabel="Episódio" bestLabel="Recompensa" meanLabel="Média móvel (20)" />
          </div>
        )}
      </Modal>

      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Comparação entre modos"
        subtitle="Mesma instância para os dois — rode cada modo para preencher a comparação"
        wide
      >
        <StatGrid cols={3} items={compareItems} />
      </Modal>

      <Modal open={paramsOpen} onClose={() => setParamsOpen(false)} title="Parâmetros" subtitle="Mundo de grade, seed e hiperparâmetros do treino">
        <Field label={`Tamanho da grade: ${size}×${size}`}>
          <input type="range" min={4} max={12} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </Field>
        <Field label="Seed">
          <div className="flex items-center gap-2">
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="w-full" />
            <button className="btn btn-secondary !px-2.5" onClick={() => setSeed(randomSeed())} title="Novo mundo aleatório">
              <Icon name="casino" className="text-[16px]" />
            </button>
          </div>
        </Field>
        <div className="border-t border-outline-variant pt-4" />
        <Field label={`Taxa de aprendizado (α): ${rlConfig.alpha.toFixed(2)}`}>
          <input type="range" min={0.05} max={1} step={0.05} value={rlConfig.alpha} onChange={(e) => setRlConfig((c) => ({ ...c, alpha: Number(e.target.value) }))} />
        </Field>
        <Field label={`Fator de desconto (γ): ${rlConfig.gamma.toFixed(2)}`}>
          <input type="range" min={0.5} max={0.99} step={0.01} value={rlConfig.gamma} onChange={(e) => setRlConfig((c) => ({ ...c, gamma: Number(e.target.value) }))} />
        </Field>
        <Field label={`Exploração inicial (ε): ${rlConfig.epsilonStart.toFixed(2)}`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={rlConfig.epsilonStart}
            onChange={(e) => setRlConfig((c) => ({ ...c, epsilonStart: Number(e.target.value) }))}
          />
        </Field>
        <Field label={`Exploração final (ε): ${rlConfig.epsilonEnd.toFixed(2)}`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={rlConfig.epsilonEnd}
            onChange={(e) => setRlConfig((c) => ({ ...c, epsilonEnd: Number(e.target.value) }))}
          />
        </Field>
        <Field label={`Episódios: ${rlConfig.episodes}`}>
          <input
            type="range"
            min={100}
            max={3000}
            step={50}
            value={rlConfig.episodes}
            onChange={(e) => setRlConfig((c) => ({ ...c, episodes: Number(e.target.value) }))}
          />
        </Field>
        <Field label={`Chance de escorregão: ${(rlConfig.slipChance * 100).toFixed(0)}%`}>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.05}
            value={rlConfig.slipChance}
            onChange={(e) => setRlConfig((c) => ({ ...c, slipChance: Number(e.target.value) }))}
          />
        </Field>
        <p className="text-[11px] leading-relaxed text-on-surface-variant">
          α/ε/episódios só afetam o Q-learning (o agente que aprende por tentativa e erro); γ e a
          chance de escorregão afetam os dois modos, já que a Iteração de Valor também precisa saber
          quão determinístico é o mundo para calcular a política ótima.
        </p>
      </Modal>
    </div>
  );
}
