"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, Icon } from "@/components/shared/Panel";
import { Modal } from "@/components/shared/Modal";
import { Select } from "@/components/shared/Select";
import { StageHint } from "@/components/shared/Stage";
import { StatGrid } from "@/components/shared/StatGrid";
import { Timeline } from "@/components/shared/Timeline";
import { BattleshipGrid } from "@/components/batalha-naval/BattleshipGrid";
import { randomSeed, seededRng } from "@/lib/core/rng";
import {
  BattleshipStep,
  BOARD_SIZE,
  CellState,
  cellIndex,
  colOf,
  emptyShots,
  FLEET,
  fireAt,
  generateFleet,
  heuristicoSteps,
  Instance,
  isFleetSunk,
  probabilisticoSteps,
  rowOf,
  shipsSunkCount,
  shotsFiredCount,
} from "@/lib/batalha-naval/model";

type BattleshipMode = "play" | "heuristico" | "probabilistico";

const MODE_LABELS: Record<BattleshipMode, string> = {
  play: "Jogar você mesmo",
  heuristico: "Caça e Alvo",
  probabilistico: "Mapa de Densidade",
};

export default function BatalhaNavalPage() {
  // Deterministic placeholder for SSR (same precedent as every other page's own seed placeholder);
  // the mount effect below immediately swaps it for a real random seed.
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState<BattleshipMode>("play");

  const [paramsOpen, setParamsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time swap from the SSR placeholder seed to a real random one
    setSeed(randomSeed());
  }, []);

  // Sem regra de primeira-jogada-segura (diferente do Campo Minado): a frota não depende de nenhum
  // clique, então uma única instância vale pros três modos - torna a Comparação trivialmente
  // apples-to-apples sem precisar de uma instância separada "de jogo" vs. "de IA".
  const instance: Instance = useMemo(() => generateFleet(BOARD_SIZE, FLEET, seededRng(seed)), [seed]);

  // --- modo play ---
  const [shots, setShots] = useState<CellState[]>(() => emptyShots(BOARD_SIZE));
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [lastPlayShot, setLastPlayShot] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting to a fresh game whenever the seed (and so the fleet) changes, not syncing external state
    setShots(emptyShots(BOARD_SIZE));
    setFocusedIndex(null);
    setLastPlayShot(null);
  }, [instance]);

  const won = isFleetSunk(instance, shots);

  const handleFire = (idx: number) => {
    if (won || shots[idx] !== "unknown") return;
    const result = fireAt(instance, shots, idx);
    setShots(result.shots);
    setLastPlayShot(idx);
  };
  const handleCellClick = (idx: number) => {
    setFocusedIndex(idx);
    handleFire(idx);
  };

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (focusedIndex === null) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleFire(focusedIndex);
      return;
    }
    const row = rowOf(BOARD_SIZE, focusedIndex);
    const col = colOf(BOARD_SIZE, focusedIndex);
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        if (col > 0) setFocusedIndex(focusedIndex - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (col < BOARD_SIZE - 1) setFocusedIndex(focusedIndex + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (row > 0) setFocusedIndex(focusedIndex - BOARD_SIZE);
        break;
      case "ArrowDown":
        e.preventDefault();
        if (row < BOARD_SIZE - 1) setFocusedIndex(focusedIndex + BOARD_SIZE);
        break;
    }
  };

  // --- modos IA ---
  const [heuristicoRun, setHeuristicoRun] = useState<BattleshipStep[] | null>(null);
  const [heuristicoElapsedMs, setHeuristicoElapsedMs] = useState<number | null>(null);
  const [probRun, setProbRun] = useState<BattleshipStep[] | null>(null);
  const [probElapsedMs, setProbElapsedMs] = useState<number | null>(null);
  const [compare, setCompare] = useState<{ heuristico: BattleshipStep[]; prob: BattleshipStep[]; heuristicoMs: number; probMs: number } | null>(null);

  const [stepFrame, setStepFrame] = useState(0);
  const [stepPlaying, setStepPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale runs whenever the fleet (instance) changes
    setHeuristicoRun(null);
    setProbRun(null);
    setCompare(null);
    setStepFrame(0);
    setStepPlaying(false);
  }, [instance]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the shared scrubber when the visible mode changes
    setStepFrame(0);
    setStepPlaying(false);
  }, [mode]);

  const activeSteps: BattleshipStep[] | null = mode === "heuristico" ? heuristicoRun : mode === "probabilistico" ? probRun : null;

  useEffect(() => {
    if (!stepPlaying || !activeSteps) return;
    if (stepFrame >= activeSteps.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setStepPlaying(false);
      return;
    }
    const t = setTimeout(() => setStepFrame((f) => Math.min(f + playbackSpeed, activeSteps.length - 1)), 140);
    return () => clearTimeout(t);
  }, [stepPlaying, stepFrame, activeSteps, playbackSpeed]);

  const activeStep: BattleshipStep | null = activeSteps ? activeSteps[Math.min(stepFrame, activeSteps.length - 1)] : null;
  const onLastFrame = activeSteps ? stepFrame >= activeSteps.length - 1 : false;

  const runHeuristico = () => {
    const start = performance.now();
    const steps = heuristicoSteps(instance);
    setHeuristicoRun(steps);
    setStepFrame(0);
    setStepPlaying(false);
    setHeuristicoElapsedMs(performance.now() - start);
  };
  const runProbabilistico = () => {
    const start = performance.now();
    const steps = probabilisticoSteps(instance);
    setProbRun(steps);
    setStepFrame(0);
    setStepPlaying(false);
    setProbElapsedMs(performance.now() - start);
  };
  const runActive = () => {
    if (mode === "heuristico") runHeuristico();
    else if (mode === "probabilistico") runProbabilistico();
  };

  const runComparison = () => {
    // Cronometra suas próprias execuções frescas em vez de reaproveitar heuristicoElapsedMs/
    // probElapsedMs - os mesmos só ficam preenchidos pelo botão "Rodar X" do modo selecionado no
    // momento, então confiar neles aqui mostraria "-" pro algoritmo que o usuário ainda não rodou
    // sozinho (a mesma correção que o Comparar do Sudoku e do Campo Minado precisaram).
    let start = performance.now();
    const heuristico = heuristicoSteps(instance);
    const heuristicoMs = performance.now() - start;

    start = performance.now();
    const prob = probabilisticoSteps(instance);
    const probMs = performance.now() - start;

    setCompare({ heuristico, prob, heuristicoMs, probMs });
    setCompareOpen(true);
  };

  const activeShots = mode === "play" ? shots : (activeStep?.shots ?? emptyShots(BOARD_SIZE));
  const shipsSunk = mode === "play" ? shipsSunkCount(instance, shots) : (activeStep?.shipsSunk ?? 0);
  const shotsFired = mode === "play" ? shotsFiredCount(shots) : (activeStep?.shotsFired ?? 0);

  const overlay =
    mode === "play"
      ? won
        ? { title: "FROTA AFUNDADA", subtitle: `Todos os 17 blocos de navio atingidos em ${shotsFiredCount(shots)} tiros` }
        : null
      : onLastFrame && activeStep?.action === "solved"
        ? { title: "FROTA AFUNDADA", subtitle: `Todos os 17 blocos de navio atingidos em ${activeStep.shotsFired} tiros (${MODE_LABELS[mode]})` }
        : null;

  const status = mode === "play" ? (won ? "VITÓRIA" : "JOGANDO") : stepPlaying ? "EXPLORANDO" : !activeSteps ? "AGUARDANDO EXECUÇÃO" : onLastFrame ? (activeStep?.action ?? "").toUpperCase() : "PRONTO";

  const currentStats: [string, string][] | null = useMemo(() => {
    if (mode === "play") return null;
    const run = mode === "heuristico" ? heuristicoRun : probRun;
    if (!run) return null;
    const elapsedMs = mode === "heuristico" ? heuristicoElapsedMs : probElapsedMs;
    const final = run[run.length - 1];
    const hits = final.shots.filter((s) => s === "hit").length;
    const misses = final.shots.filter((s) => s === "miss").length;
    return [
      ["Tiros disparados", String(final.shotsFired)],
      ["Acertos", String(hits)],
      ["Erros", String(misses)],
      ["% de acerto", final.shotsFired > 0 ? `${((hits / final.shotsFired) * 100).toFixed(1)}%` : "—"],
      ["Navios afundados", `${final.shipsSunk}/${FLEET.length}`],
      ["Tempo", elapsedMs !== null ? `${elapsedMs.toFixed(2)}ms` : "—"],
    ];
  }, [mode, heuristicoRun, probRun, heuristicoElapsedMs, probElapsedMs]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Batalha Naval</span>
            <span>/</span>
            <span className="accent">{MODE_LABELS[mode]}</span>
          </div>
          <h1 className="content-title">Batalha Naval</h1>
          <p className="content-sub">
            Afunde toda a frota inimiga disparando num tabuleiro 10×10. Compare Caça e Alvo — que
            varre em paridade de tabuleiro de xadrez e depois isola a linha de um navio atingido —
            com Mapa de Densidade, que enumera todos os posicionamentos válidos da frota restante e
            sempre dispara na célula mais coberta, ou jogue você mesmo.
          </p>
        </div>
        <div className="content-actions">
          {mode !== "play" && (
            <>
              <button className="btn-pill" onClick={runComparison}>
                <Icon name="compare_arrows" className="text-[15px]" /> Comparar
              </button>
              <button className="btn-pill btn-pill-primary" onClick={runActive}>
                <Icon name="play_arrow" className="text-[15px]" /> {mode === "heuristico" ? "Rodar caça e alvo" : "Rodar mapa de densidade"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="workspace-card">
        <div className="workspace-head">
          <Select
            value={mode}
            onChange={(v) => setMode(v as BattleshipMode)}
            options={(Object.keys(MODE_LABELS) as BattleshipMode[]).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
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
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(52,95,140,0.08),transparent_60%)]">
            <StageHint>
              NAVIOS <b className="readout-glow font-semibold text-primary">{shipsSunk}/{FLEET.length}</b> · TIROS{" "}
              <b className="readout-glow font-semibold text-primary">{shotsFired}</b> · MODO{" "}
              <b className="readout-glow font-semibold text-primary">{MODE_LABELS[mode]}</b>
            </StageHint>

            <div
              className="flex h-full w-full items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70"
              tabIndex={mode === "play" ? 0 : -1}
              role="application"
              aria-label="Batalha Naval. Clique ou tecle Enter/Espaço para disparar, setas para mover o cursor."
              onKeyDown={mode === "play" ? handleGridKeyDown : undefined}
              onFocus={() => mode === "play" && setFocusedIndex((i) => i ?? cellIndex(BOARD_SIZE, 5, 5))}
            >
              <BattleshipGrid
                shots={activeShots}
                ships={instance.placements}
                lastShot={mode === "play" ? lastPlayShot : null}
                focusedIndex={mode === "play" ? focusedIndex : null}
                heatmap={mode === "probabilistico" ? (activeStep?.heatmap ?? null) : null}
                bestIndex={mode !== "play" ? (activeStep?.index ?? null) : null}
                interactive={mode === "play"}
                onCellClick={mode === "play" ? handleCellClick : undefined}
                overlay={overlay}
              />
            </div>
          </div>

          {mode === "play" ? (
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 bg-background px-4 sm:px-5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${won ? "" : "animate-pulse"}`} style={{ background: "var(--tertiary)" }} />
                {won ? "FROTA AFUNDADA — VOCÊ VENCEU" : "CLIQUE OU ENTER/ESPAÇO PARA DISPARAR"}
              </span>
              <button className="btn-pill" onClick={() => setSeed(randomSeed())}>
                <Icon name="refresh" className="text-[15px]" /> Novo jogo
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
              speedMax={20}
            />
          )}
        </div>
      </div>

      <Modal open={statsOpen} onClose={() => setStatsOpen(false)} title="Última execução">
        {currentStats && <StatGrid cols={2} items={currentStats} />}
      </Modal>

      <Modal open={compareOpen} onClose={() => setCompareOpen(false)} title="Caça e Alvo vs. Mapa de Densidade" subtitle="Mesma frota para os dois - a comparação isola o efeito da estratégia de mira" wide>
        {!compare ? (
          <p className="text-xs text-on-surface-variant">Clique em &ldquo;Comparar&rdquo; para ver a diferença.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-on-surface-variant">
                  <th className="px-2 py-2 text-left font-medium">Algoritmo</th>
                  <th className="px-2 py-2 text-right font-medium">Tiros</th>
                  <th className="px-2 py-2 text-right font-medium">Acertos</th>
                  <th className="px-2 py-2 text-right font-medium">Erros</th>
                  <th className="px-2 py-2 text-right font-medium">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    { label: MODE_LABELS.heuristico, steps: compare.heuristico, ms: compare.heuristicoMs },
                    { label: MODE_LABELS.probabilistico, steps: compare.prob, ms: compare.probMs },
                  ] satisfies { label: string; steps: BattleshipStep[]; ms: number }[]
                ).map(({ label, steps, ms }) => {
                  const final = steps[steps.length - 1];
                  const hits = final.shots.filter((s) => s === "hit").length;
                  const misses = final.shots.filter((s) => s === "miss").length;
                  return (
                    <tr key={label} className="border-b border-white/5">
                      <td className="px-2 py-2">{label}</td>
                      <td className="px-2 py-2 text-right font-mono">{final.shotsFired}</td>
                      <td className="px-2 py-2 text-right font-mono">{hits}</td>
                      <td className="px-2 py-2 text-right font-mono">{misses}</td>
                      <td className="px-2 py-2 text-right font-mono">{ms.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal open={paramsOpen} onClose={() => setParamsOpen(false)} title="Parâmetros" subtitle="Seed do tabuleiro">
        <Field label="Seed">
          <div className="flex items-center gap-2">
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="w-full" />
            <button className="btn btn-secondary !px-2.5" onClick={() => setSeed(randomSeed())} title="Nova frota aleatória">
              <Icon name="casino" className="text-[16px]" />
            </button>
          </div>
        </Field>
        <p className="text-[11px] leading-relaxed text-on-surface-variant">
          A seed decide onde a frota clássica de 5 navios é posicionada. Jogar, Caça e Alvo e Mapa de
          Densidade sempre disputam a mesma frota, o que torna a comparação direta.
        </p>
      </Modal>
    </div>
  );
}
