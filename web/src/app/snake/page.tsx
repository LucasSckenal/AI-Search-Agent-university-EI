"use client";

import { useEffect, useRef, useState } from "react";
import { Field, Icon } from "@/components/shared/Panel";
import { Modal } from "@/components/shared/Modal";
import { Select } from "@/components/shared/Select";
import { StageHint } from "@/components/shared/Stage";
import { StatGrid } from "@/components/shared/StatGrid";
import { randomSeed, seededRng } from "@/lib/core/rng";
import { SnakeGrid } from "@/components/snake/SnakeGrid";
import {
  AstarPlan,
  buildCycleIndex,
  buildHamiltonianCycle,
  COLS,
  createInitialSnake,
  Direction,
  isReversal,
  nextHamiltonianMove,
  planAstarMove,
  ROWS,
  SnakeState,
  tick,
} from "@/lib/snake/model";

type SnakeMode = "play" | "astar" | "hamiltonian" | "aiVsAi";
type RaceWinner = "astar" | "hamiltonian" | "tie";

const MODE_LABELS: Record<SnakeMode, string> = {
  play: "Jogar você mesmo",
  astar: "A* (replaneja a cada passo)",
  hamiltonian: "Ciclo Hamiltoniano",
  aiVsAi: "A* vs Ciclo Hamiltoniano",
};

// Fixed 20x20 board (even rows, required for the Hamiltonian cycle to close) - computed once at
// module scope, not recalculated on every render or mode switch.
const HAM_CYCLE = buildHamiltonianCycle(COLS, ROWS);
const HAM_CYCLE_INDEX = buildCycleIndex(HAM_CYCLE);

export default function SnakePage() {
  // Deterministic placeholder for SSR (same precedent as every other page's own seed placeholder);
  // the mount effect below immediately swaps it for a real random seed.
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState<SnakeMode>("play");
  const [tickMs, setTickMs] = useState(120);

  const [paramsOpen, setParamsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [lastAstarStats, setLastAstarStats] = useState<AstarPlan["stats"] | null>(null);

  // Manual play + astar + hamiltonian all share one live board; aiVsAi gets its own pair below.
  const rngRef = useRef<() => number>(seededRng(1));
  const [live, setLive] = useState<SnakeState>(() => createInitialSnake(COLS, ROWS, seededRng(1)));

  // Direction pending application on the next tick - a ref (not state) so keystrokes between ticks
  // don't get lost, and reversal is checked against THIS (not live.direction), so a fast double-tap
  // in the opposite direction can't sneak a real 180-degree reversal through before the previous
  // tick applies.
  const pendingDirectionRef = useRef<Direction>("right");

  const rngARef = useRef<() => number>(seededRng(1));
  const rngHRef = useRef<() => number>(seededRng(1));
  const [vsA, setVsA] = useState<SnakeState>(() => createInitialSnake(COLS, ROWS, seededRng(1)));
  const [vsH, setVsH] = useState<SnakeState>(() => createInitialSnake(COLS, ROWS, seededRng(1)));
  const [raceWinner, setRaceWinner] = useState<RaceWinner | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time swap from the SSR placeholder seed to a real random one
    setSeed(randomSeed());
  }, []);

  // Fresh game whenever mode or seed changes (mode switches always start clean; seed changes are a
  // deliberate "novo jogo"/"nova seed" request from Parâmetros).
  useEffect(() => {
    rngRef.current = seededRng(seed);
    const state = createInitialSnake(COLS, ROWS, rngRef.current);
    pendingDirectionRef.current = state.direction;
    setLive(state);
    setLastAstarStats(null);
  }, [mode, seed]);

  // aiVsAi race: both sides start from the exact same seed (fair race - identical starting food).
  useEffect(() => {
    if (mode !== "aiVsAi") return;
    rngARef.current = seededRng(seed);
    rngHRef.current = seededRng(seed);
    setVsA(createInitialSnake(COLS, ROWS, rngARef.current));
    setVsH(createInitialSnake(COLS, ROWS, rngHRef.current));
    setRaceWinner(null);
  }, [mode, seed]);

  // Manual play: gravity-style tick loop, applies whatever direction is currently pending.
  useEffect(() => {
    if (mode !== "play" || live.over || live.won) return;
    const t = setInterval(() => {
      setLive((prev) => (prev.over || prev.won ? prev : tick(prev, pendingDirectionRef.current, rngRef.current)));
    }, tickMs);
    return () => clearInterval(t);
  }, [mode, tickMs, live.over, live.won]);

  useEffect(() => {
    if (mode !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      if (live.over || live.won) return;
      let dir: Direction | null = null;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") dir = "up";
      else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") dir = "down";
      else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") dir = "left";
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") dir = "right";
      if (!dir) return;
      e.preventDefault();
      if (isReversal(pendingDirectionRef.current, dir)) return;
      pendingDirectionRef.current = dir;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, live.over, live.won]);

  const touchDirection = (dir: Direction) => {
    if (live.over || live.won) return;
    if (isReversal(pendingDirectionRef.current, dir)) return;
    pendingDirectionRef.current = dir;
  };

  // astar/hamiltonian: live replan-and-apply loop (not a precomputed trace) - recalculates on top of
  // the current `live` state every tick, and re-fires because `live` is its own dependency, the same
  // "recompute-and-apply, redispatch on the state it just changed" shape Lig4's AI-turn effect uses.
  useEffect(() => {
    if (mode !== "astar" || live.over || live.won) return;
    const t = setTimeout(() => {
      const plan = planAstarMove(live);
      setLastAstarStats(plan.stats);
      const dir = plan.direction ?? live.direction;
      setLive((prev) => (prev.over || prev.won ? prev : tick(prev, dir, rngRef.current)));
    }, tickMs);
    return () => clearTimeout(t);
  }, [mode, tickMs, live]);

  useEffect(() => {
    if (mode !== "hamiltonian" || live.over || live.won) return;
    const t = setTimeout(() => {
      setLive((prev) => {
        if (prev.over || prev.won) return prev;
        const dir = nextHamiltonianMove(prev, HAM_CYCLE, HAM_CYCLE_INDEX);
        return tick(prev, dir, rngRef.current);
      });
    }, tickMs);
    return () => clearTimeout(t);
  }, [mode, tickMs, live]);

  // aiVsAi: one shared clock advances both boards each tick, instead of two independent timers -
  // keeps them visibly in lockstep when the speed slider changes.
  useEffect(() => {
    if (mode !== "aiVsAi" || raceWinner) return;
    const t = setTimeout(() => {
      if (!vsA.over && !vsA.won) {
        setVsA((prev) => {
          if (prev.over || prev.won) return prev;
          const plan = planAstarMove(prev);
          const dir = plan.direction ?? prev.direction;
          return tick(prev, dir, rngARef.current);
        });
      }
      if (!vsH.over && !vsH.won) {
        setVsH((prev) => {
          if (prev.over || prev.won) return prev;
          const dir = nextHamiltonianMove(prev, HAM_CYCLE, HAM_CYCLE_INDEX);
          return tick(prev, dir, rngHRef.current);
        });
      }
    }, tickMs);
    return () => clearTimeout(t);
  }, [mode, tickMs, vsA, vsH, raceWinner]);

  // Race ends the moment either side finishes (collides or fills the board) - Hamiltonian never
  // collides by construction, so waiting for both to finish would mean waiting for it to fill all
  // 400 cells; ending on the first finisher lets "A* eventually gets trapped while the Hamiltonian
  // cycle is still going" resolve the race on its own, which is the whole pedagogical point.
  useEffect(() => {
    if (mode !== "aiVsAi" || raceWinner) return;
    if (!vsA.over && !vsA.won && !vsH.over && !vsH.won) return;
    let winner: RaceWinner;
    if (vsA.won && vsH.won) winner = vsA.score >= vsH.score ? "astar" : "hamiltonian";
    else if (vsA.won) winner = "astar";
    else if (vsH.won) winner = "hamiltonian";
    else if (vsA.over && vsH.over) winner = vsA.score === vsH.score ? "tie" : vsA.score > vsH.score ? "astar" : "hamiltonian";
    else if (vsA.over) winner = "hamiltonian";
    else winner = "astar";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the race-ending condition just computed above
    setRaceWinner(winner);
  }, [mode, vsA, vsH, raceWinner]);

  const resetRace = () => setSeed(randomSeed());

  const overlay =
    live.won
      ? { title: "TABULEIRO PREENCHIDO", subtitle: "Vitória — a cobra ocupou todas as células" }
      : live.over
        ? { title: mode === "play" ? "VOCÊ PERDEU" : "A COBRA COLIDIU", subtitle: mode === "play" ? "Colidiu com a parede ou consigo mesma" : "Sem caminho seguro restante" }
        : null;

  const vsAOverlay = vsA.won ? { title: "VITÓRIA", subtitle: "Tabuleiro preenchido" } : vsA.over ? { title: "COLIDIU", subtitle: "A* ficou sem caminho seguro" } : null;
  const vsHOverlay = vsH.won ? { title: "VITÓRIA", subtitle: "Tabuleiro preenchido" } : vsH.over ? { title: "COLIDIU", subtitle: "Ciclo interrompido" } : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Cobrinha</span>
            <span>/</span>
            <span className="accent">{MODE_LABELS[mode]}</span>
          </div>
          <h1 className="content-title">Cobrinha</h1>
          <p className="content-sub">
            Guie a cobra até a comida sem colidir. Compare A* — que replaneja o caminho mais curto a
            cada passo, mas pode se prender sozinho conforme cresce — com um Ciclo Hamiltoniano, que
            visita todas as células numa rota fixa e comprovadamente nunca colide.
          </p>
        </div>
      </div>

      <div className="workspace-card">
        <div className="workspace-head">
          <Select
            value={mode}
            onChange={(v) => setMode(v as SnakeMode)}
            options={(Object.keys(MODE_LABELS) as SnakeMode[]).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
            className="!w-auto shrink-0"
          />
          <div className="workspace-links">
            <button className="workspace-link" onClick={() => setParamsOpen(true)}>
              <Icon name="tune" className="text-[13px]" /> Parâmetros
            </button>
            <button className="workspace-link" onClick={() => setStatsOpen(true)} disabled={mode !== "astar" || !lastAstarStats}>
              <Icon name="query_stats" className="text-[13px]" /> Última execução
            </button>
          </div>
        </div>

        <div className="canvas-body">
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(139,212,80,0.06),transparent_60%)]">
            <StageHint>
              {mode === "aiVsAi" ? (
                <>
                  A* <b className="readout-glow font-semibold text-primary">{vsA.score}</b> · HAMILTONIANO{" "}
                  <b className="readout-glow font-semibold text-primary">{vsH.score}</b>
                  {raceWinner && (
                    <>
                      {" "}
                      ·{" "}
                      <b className="readout-glow font-semibold text-primary">
                        {raceWinner === "astar" ? "A* VENCEU" : raceWinner === "hamiltonian" ? "HAMILTONIANO VENCEU" : "EMPATE"}
                      </b>
                    </>
                  )}
                </>
              ) : (
                <>
                  PONTUAÇÃO <b className="readout-glow font-semibold text-primary">{live.score}</b> · PASSOS{" "}
                  <b className="readout-glow font-semibold text-primary">{live.ticks}</b>
                </>
              )}
            </StageHint>

            {mode === "aiVsAi" ? (
              <div className="flex h-full w-full items-stretch justify-center gap-4">
                <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="shrink-0 font-mono text-[11px] text-on-surface-variant">A*</span>
                  <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                    <SnakeGrid cols={COLS} rows={ROWS} body={vsA.body} food={vsA.food} direction={vsA.direction} className="snake-grid--vs" overlay={vsAOverlay} />
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="shrink-0 font-mono text-[11px] text-on-surface-variant">CICLO HAMILTONIANO</span>
                  <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                    <SnakeGrid cols={COLS} rows={ROWS} body={vsH.body} food={vsH.food} direction={vsH.direction} className="snake-grid--vs" overlay={vsHOverlay} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <SnakeGrid cols={COLS} rows={ROWS} body={live.body} food={live.food} direction={live.direction} overlay={overlay} />
              </div>
            )}

            {mode === "play" && (
              <div className="pointer-events-auto absolute bottom-4 right-4 z-[1] grid grid-cols-3 grid-rows-3 gap-1">
                <span />
                <button className="g2048-dpad-btn" onClick={() => touchDirection("up")} aria-label="Cima">
                  <Icon name="keyboard_arrow_up" className="text-[18px]" />
                </button>
                <span />
                <button className="g2048-dpad-btn" onClick={() => touchDirection("left")} aria-label="Esquerda">
                  <Icon name="keyboard_arrow_left" className="text-[18px]" />
                </button>
                <button className="g2048-dpad-btn" onClick={() => touchDirection("down")} aria-label="Baixo">
                  <Icon name="keyboard_arrow_down" className="text-[18px]" />
                </button>
                <button className="g2048-dpad-btn" onClick={() => touchDirection("right")} aria-label="Direita">
                  <Icon name="keyboard_arrow_right" className="text-[18px]" />
                </button>
                <span />
                <span />
                <span />
                <span />
              </div>
            )}
          </div>

          {mode === "play" ? (
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 bg-background px-4 sm:px-5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${live.over || live.won ? "" : "animate-pulse"}`} style={{ background: "var(--tertiary)" }} />
                {live.won ? "TABULEIRO PREENCHIDO — VITÓRIA" : live.over ? "FIM DE JOGO — VOCÊ COLIDIU" : "WASD OU SETAS PARA MOVER"}
              </span>
              <button className="btn-pill" onClick={() => setSeed(randomSeed())}>
                <Icon name="refresh" className="text-[15px]" /> Novo jogo
              </button>
            </div>
          ) : mode === "aiVsAi" ? (
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 bg-background px-4 sm:px-5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${!raceWinner ? "animate-pulse" : ""}`} style={{ background: "var(--tertiary)" }} />
                {raceWinner === "astar"
                  ? "A* VENCEU A CORRIDA"
                  : raceWinner === "hamiltonian"
                    ? "O CICLO HAMILTONIANO VENCEU — SOBREVIVEU MAIS TEMPO"
                    : raceWinner === "tie"
                      ? "EMPATE"
                      : "A* PODE SE PRENDER SOZINHO — O HAMILTONIANO NUNCA COLIDE"}
              </span>
              <button className="btn-pill" onClick={resetRace}>
                <Icon name="refresh" className="text-[15px]" /> Nova corrida
              </button>
            </div>
          ) : (
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 bg-background px-4 sm:px-5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${live.over || live.won ? "" : "animate-pulse"}`} style={{ background: "var(--tertiary)" }} />
                {live.won ? "TABULEIRO PREENCHIDO — VITÓRIA" : live.over ? "A COBRA COLIDIU" : mode === "astar" ? "REPLANEJANDO A CADA PASSO" : "SEGUINDO O CICLO HAMILTONIANO"}
              </span>
              <button className="btn-pill" onClick={() => setSeed(randomSeed())}>
                <Icon name="refresh" className="text-[15px]" /> Reiniciar
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal open={statsOpen} onClose={() => setStatsOpen(false)} title="Última execução">
        {lastAstarStats && (
          <StatGrid
            cols={2}
            items={[
              ["Caminho encontrado?", lastAstarStats.found ? "Sim" : "Não (recorreu ao espaço aberto)"],
              ["Nós expandidos", String(lastAstarStats.nodesExpanded)],
              ["Tempo", `${lastAstarStats.timeMs.toFixed(2)}ms`],
              ["Truncado?", lastAstarStats.truncated ? "Sim" : "Não"],
            ]}
          />
        )}
      </Modal>

      <Modal open={paramsOpen} onClose={() => setParamsOpen(false)} title="Parâmetros" subtitle="O tabuleiro é sempre 20×20">
        <Field label="Seed">
          <div className="flex items-center gap-2">
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="w-full" />
            <button className="btn btn-secondary !px-2.5" onClick={() => setSeed(randomSeed())} title="Novo jogo aleatório">
              <Icon name="casino" className="text-[16px]" />
            </button>
          </div>
        </Field>
        <Field label={`Velocidade (${tickMs}ms por passo)`}>
          <input type="range" min={40} max={400} step={10} value={tickMs} onChange={(e) => setTickMs(Number(e.target.value))} className="w-full" />
        </Field>
        <p className="text-[11px] leading-relaxed text-on-surface-variant">
          A seed decide a posição da comida (cada comida seguinte também depende dela). O tabuleiro é
          sempre 20×20 — par×par, necessário para o Ciclo Hamiltoniano fechar.
        </p>
      </Modal>
    </div>
  );
}
