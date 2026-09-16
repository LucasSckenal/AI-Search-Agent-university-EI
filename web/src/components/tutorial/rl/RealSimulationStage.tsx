"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/shared/Panel";
import { StageHint } from "@/components/shared/Stage";
import { WebGLGate } from "@/components/shared/WebGLGate";
import { StepControls } from "@/components/tutorial/StepControls";
import { maxQPerState } from "@/lib/rl/model";
import { RlPreset, configFor, worldForPreset } from "@/lib/tutorial/rl-presets";
import { RlRun, rolloutForSnapshot, runRlComparison } from "@/lib/tutorial/rl-run";
import { outcomeLabel } from "@/lib/tutorial/rl-explain";

const RLCanvas = dynamic(() => import("@/components/rl/RLCanvas").then((m) => m.RLCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">
      Carregando cenário 3D…
    </div>
  ),
});

/**
 * The lab's real-execution stage for the RL family - gated behind an [EXECUTAR] button, then plays
 * the real runQLearning() run snapshot by snapshot on the 3D grid world (the same component
 * /aprendizado uses), scrubbed with StepControls over qTableSnapshots (the heatmap only actually
 * changes at snapshot boundaries, same reasoning as /aprendizado's own episode picker).
 */
export function RealSimulationStage({
  preset,
  episodes,
  onResult,
}: {
  preset: RlPreset;
  episodes: number;
  onResult?: (run: RlRun) => void;
}) {
  const [executed, setExecuted] = useState(false);
  const [snapIndex, setSnapIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const run = useMemo(() => {
    const world = worldForPreset(preset);
    const config = configFor(preset, episodes);
    return runRlComparison(world, config);
  }, [preset, episodes]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new preset/episode budget needs a fresh, un-executed run
    setExecuted(false);
    setSnapIndex(0);
    setPlaying(false);
  }, [run]);

  useEffect(() => {
    if (!playing) return;
    if (snapIndex >= run.q.qTableSnapshots.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setSnapIndex((i) => Math.min(i + 1, run.q.qTableSnapshots.length - 1)), 120);
    return () => clearTimeout(t);
  }, [playing, snapIndex, run]);

  const start = () => {
    setExecuted(true);
    setSnapIndex(0);
    setPlaying(run.q.qTableSnapshots.length > 1);
    onResult?.(run);
  };

  const snapshot = run.q.qTableSnapshots[Math.min(snapIndex, run.q.qTableSnapshots.length - 1)];
  const snapshotRollout = useMemo(
    () => (executed ? rolloutForSnapshot(run.world, snapshot.q, run.config.maxStepsPerEpisode) : null),
    [executed, run, snapshot]
  );
  const values = executed ? maxQPerState(snapshot.q, run.world.rows * run.world.cols) : null;

  return (
    <div className="canvas-body">
      <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(126,168,245,0.06),transparent_60%)]">
        <StageHint>
          EPISÓDIO <b className="readout-glow font-semibold text-primary">{executed ? snapshot.episode : 0}</b>
          {" / "}
          {run.q.episodes[run.q.episodes.length - 1].episode}
          {snapshotRollout && (
            <>
              {" · RECOMPENSA "}
              <b className="readout-glow font-semibold text-primary">{snapshotRollout.reward.toFixed(2)}</b>
              {" · "}
              {snapshotRollout.outcome === "goal" ? (
                <b className="readout-glow font-semibold text-primary">✓ {outcomeLabel(snapshotRollout.outcome)}</b>
              ) : snapshotRollout.outcome === "pit" ? (
                <b className="readout-glow font-semibold" style={{ color: "#ff5d5d" }}>
                  ✗ {outcomeLabel(snapshotRollout.outcome)}
                </b>
              ) : (
                <b className="readout-glow font-semibold" style={{ color: "#ffb020" }}>
                  ✗ {outcomeLabel(snapshotRollout.outcome)}
                </b>
              )}
            </>
          )}
        </StageHint>

        <WebGLGate>
          <RLCanvas world={run.world} values={values} rollout={snapshotRollout} />
        </WebGLGate>

        {!executed && (
          <div className="absolute inset-0 z-[2] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <button className="btn-pill btn-pill-primary" onClick={start}>
              <Icon name="play_arrow" className="text-[15px]" /> Executar
            </button>
          </div>
        )}
      </div>

      <StepControls
        index={executed ? snapIndex : 0}
        total={Math.max(run.q.qTableSnapshots.length - 1, 0)}
        onChange={(i) => {
          if (!executed) return;
          setPlaying(false);
          setSnapIndex(i);
        }}
        playing={playing}
        onTogglePlay={() => setPlaying((p) => !p)}
        disabled={!executed}
      />
    </div>
  );
}
