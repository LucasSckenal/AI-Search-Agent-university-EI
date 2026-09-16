"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/shared/Panel";
import { Select } from "@/components/shared/Select";
import { StageHint } from "@/components/shared/Stage";
import { Timeline } from "@/components/shared/Timeline";
import { PatternGrid } from "@/components/hopfield/PatternGrid";
import { EnergyChart } from "@/components/hopfield/EnergyChart";
import { PATTERN_LIBRARY, RecallResult, RecallStep, buildWeights, corrupt, overlap, recall } from "@/lib/hopfield/model";
import { randomSeed } from "@/lib/core/rng";

const ACCENT = "#8b5cf6";
const MIN_STORED = 2;

export default function HopfieldPage() {
  const [storedIds, setStoredIds] = useState<string[]>(["cruz", "x", "quadrado"]);
  const [targetId, setTargetId] = useState("cruz");
  const [noise, setNoise] = useState(0.2);
  // A fixed initial seed (not randomSeed()) keeps the server-rendered and first client-rendered
  // corrupted pattern identical - Math.random() in initial state differs between server and client
  // and would otherwise fail hydration, since this grid (unlike Perceptron/GA pages) renders before
  // any user interaction rather than staying hidden behind a "run" gate.
  const [seed, setSeed] = useState(1);
  const [startState, setStartState] = useState<number[]>(() => corrupt(PATTERN_LIBRARY[0].values, 0.2, 1));

  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);

  const storedPatterns = useMemo(() => PATTERN_LIBRARY.filter((p) => storedIds.includes(p.id)), [storedIds]);
  const W = useMemo(() => buildWeights(storedPatterns.map((p) => p.values)), [storedPatterns]);
  const target = PATTERN_LIBRARY.find((p) => p.id === targetId) ?? PATTERN_LIBRARY[0];

  useEffect(() => {
    if (!storedIds.includes(targetId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the target was just deselected from storage, fall back to whatever is still stored
      setTargetId(storedIds[0]);
    }
  }, [storedIds, targetId]);

  const toggleStored = (id: string) => {
    setStoredIds((prev) => {
      const isIn = prev.includes(id);
      if (isIn && prev.length <= MIN_STORED) return prev;
      return isIn ? prev.filter((x) => x !== id) : [...prev, id];
    });
  };

  const regenerate = (newTargetId: string) => {
    const newSeed = randomSeed();
    const pattern = PATTERN_LIBRARY.find((p) => p.id === newTargetId) ?? PATTERN_LIBRARY[0];
    setStartState(corrupt(pattern.values, noise, newSeed));
    setSeed(newSeed);
  };

  const trace = useMemo(() => {
    const iterator = recall(W, startState, seed);
    const steps: RecallStep[] = [];
    let next = iterator.next();
    while (!next.done) {
      steps.push(next.value);
      next = iterator.next();
    }
    return { steps, result: next.value as RecallResult };
  }, [W, startState, seed]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new starting state needs a fresh trace from step 0, not a sync with external state
    setStepIndex(0);
    setPlaying(false);
  }, [trace]);

  useEffect(() => {
    if (!playing) return;
    if (stepIndex >= trace.steps.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStepIndex((i) => Math.min(i + Math.max(1, speed), trace.steps.length - 1)), 30);
    return () => clearTimeout(t);
  }, [playing, stepIndex, speed, trace]);

  const current = trace.steps[Math.min(stepIndex, trace.steps.length - 1)];
  const done = stepIndex >= trace.steps.length - 1;
  const currentOverlap = overlap(current.state, target.values);

  const bestMatch = useMemo(() => {
    if (!done) return null;
    let best = storedPatterns[0];
    let bestOv = -1;
    for (const p of storedPatterns) {
      const ov = overlap(current.state, p.values);
      if (ov > bestOv) {
        bestOv = ov;
        best = p;
      }
    }
    return { pattern: best, ov: bestOv };
  }, [done, storedPatterns, current]);

  const handleToggle = (i: number) => {
    if (stepIndex !== 0) return;
    setStartState((prev) => {
      const next = [...prev];
      next[i] *= -1;
      return next;
    });
  };

  const status = playing ? "CONVERGINDO" : done ? "CONVERGIU" : "PRONTO";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Hopfield</span>
            <span>/</span>
            <span className="accent">Memória Associativa</span>
          </div>
          <h1 className="content-title">Hopfield</h1>
          <p className="content-sub">
            Uma rede aprende os padrões guardados numa única passada (regra de Hebb) - sem épocas,
            sem gradiente. Corrompa um padrão guardado com ruído e veja a rede recuperá-lo sozinha:
            a cada passo, um neurônio aleatório se atualiza pelo voto dos outros, e a energia da rede
            nunca aumenta até estabilizar. Guardar poucos padrões recupera perfeitamente; guardar
            demais sobrecarrega a memória e a recuperação falha - o limite de capacidade de Hopfield,
            o análogo desta rede à limitação de Minsky-Papert do Classificador Linear.
          </p>
        </div>
        <div className="content-actions">
          <label className="flex items-center gap-2 text-[12px] text-on-surface-variant">
            Ruído {(noise * 100).toFixed(0)}%
            <input type="range" min={0.05} max={0.45} step={0.05} value={noise} onChange={(e) => setNoise(Number(e.target.value))} className="w-24" />
          </label>
          <button className="btn-pill btn-pill-primary" onClick={() => regenerate(targetId)}>
            <Icon name="shuffle" className="text-[15px]" /> Corromper
          </button>
        </div>
      </div>

      <div className="workspace-card">
        <div className="workspace-head">
          <Select
            value={targetId}
            onChange={(v) => {
              setTargetId(v);
              regenerate(v);
            }}
            className="!w-auto shrink-0"
            options={storedPatterns.map((p) => ({ value: p.id, label: `Recall: ${p.label}` }))}
          />
          <div className="workspace-links flex flex-wrap gap-1.5">
            {PATTERN_LIBRARY.map((p) => {
              const active = storedIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleStored(p.id)}
                  aria-pressed={active}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? "border-transparent text-white"
                      : "border-white/10 bg-white/5 text-on-surface-variant hover:bg-white/10"
                  }`}
                  style={active ? { background: ACCENT } : undefined}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="canvas-body">
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(139,92,246,0.06),transparent_60%)]">
            <StageHint>
              PASSO{" "}
              <b className="readout-glow font-semibold text-primary">
                {stepIndex} / {trace.steps.length - 1}
              </b>
              {" · ENERGIA "}
              <b className="readout-glow font-semibold text-primary">{current.energy.toFixed(1)}</b>
              {" · SOBREPOSIÇÃO COM "}
              {target.label.toUpperCase()}
              {" "}
              <b className="readout-glow font-semibold text-primary">{(currentOverlap * 100).toFixed(0)}%</b>
              {done && bestMatch && (
                <>
                  {" · CONVERGIU PARA "}
                  <b className="readout-glow font-semibold text-primary">
                    {bestMatch.ov > 0.95 ? bestMatch.pattern.label.toUpperCase() : "ESTADO ESPÚRIO"}
                  </b>
                </>
              )}
            </StageHint>

            <div className="flex h-full w-full flex-col lg:flex-row">
              <div className="min-h-0 flex-1 lg:w-1/2">
                <PatternGrid state={current.state} accentColor={ACCENT} changedIndex={current.changedIndex} onToggle={stepIndex === 0 ? handleToggle : undefined} />
              </div>
              <div className="flex h-[200px] shrink-0 flex-col justify-center gap-3 border-t border-white/10 px-4 py-3 lg:h-auto lg:w-1/2 lg:border-l lg:border-t-0">
                <EnergyChart steps={trace.steps.slice(0, stepIndex + 1)} />
                {stepIndex === 0 && (
                  <p className="text-[11px] text-on-surface-variant">Clique nos pixels pra corromper o padrão manualmente.</p>
                )}
              </div>
            </div>
          </div>

          <Timeline
            status={status}
            pulsing={playing}
            playing={playing}
            onTogglePlay={() => setPlaying((p) => !p)}
            onSkipEnd={() => {
              setStepIndex(trace.steps.length - 1);
              setPlaying(false);
            }}
            current={stepIndex}
            total={trace.steps.length - 1}
            unitLabel="passos"
            speed={speed}
            onSpeedChange={setSpeed}
            speedLabel="Velocidade"
            speedMax={8}
          />
        </div>
      </div>
    </div>
  );
}
