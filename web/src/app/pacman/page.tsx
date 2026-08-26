"use client";

import { useEffect, useRef, useState } from "react";
import { Field, Icon } from "@/components/shared/Panel";
import { Modal } from "@/components/shared/Modal";
import { Select } from "@/components/shared/Select";
import { StageHint } from "@/components/shared/Stage";
import { StatGrid } from "@/components/shared/StatGrid";
import { randomSeed, seededRng } from "@/lib/core/rng";
import { PacmanGrid } from "@/components/pacman/PacmanGrid";
import { BfsPlan, bfsPathDir, createInitialState, Dir, DungeonState, tick } from "@/lib/pacman/model";

type PacmanMode = "play" | "especializados" | "gulosos" | "aiVsAi";
type RaceWinner = "especializados" | "gulosos" | "tie";

const MODE_LABELS: Record<PacmanMode, string> = {
  play: "Jogar você mesmo",
  especializados: "Monstros Especializados",
  gulosos: "Monstros Gulosos",
  aiVsAi: "Especializados vs Gulosos",
};

export default function PacmanPage() {
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState<PacmanMode>("play");
  const [tickMs, setTickMs] = useState(180);

  const [paramsOpen, setParamsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [lastBfsStats, setLastBfsStats] = useState<BfsPlan["stats"] | null>(null);
  const [lastBfsStatsA, setLastBfsStatsA] = useState<BfsPlan["stats"] | null>(null);
  const [lastBfsStatsB, setLastBfsStatsB] = useState<BfsPlan["stats"] | null>(null);

  const rngRef = useRef<() => number>(seededRng(1));
  // Placeholder só até o efeito de [mode, seed] rodar (troca pra uma seed real) - por isso usa um
  // gerador descartável em vez de ler rngRef.current durante a renderização.
  const [live, setLive] = useState<DungeonState>(() => createInitialState(seededRng(1)));
  const pendingDirectionRef = useRef<Dir>("left");
  // Igual ao fliperama original que inspirou a mecânica: o herói fica parado (sem andar sozinho pra
  // dentro de uma parede) até a primeira tecla de direção do jogador.
  const startedRef = useRef(false);

  const rngARef = useRef<() => number>(seededRng(1));
  const rngBRef = useRef<() => number>(seededRng(1));
  const [vsEspecializados, setVsEspecializados] = useState<DungeonState>(() => createInitialState(seededRng(1)));
  const [vsGulosos, setVsGulosos] = useState<DungeonState>(() => createInitialState(seededRng(1)));
  const [raceWinner, setRaceWinner] = useState<RaceWinner | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time swap from the SSR placeholder seed to a real random one
    setSeed(randomSeed());
  }, []);

  useEffect(() => {
    rngRef.current = seededRng(seed);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fresh dungeon (nova geração de labirinto) sempre que o modo ou a seed mudam
    setLive(createInitialState(rngRef.current));
    pendingDirectionRef.current = "left";
    startedRef.current = false;
    setLastBfsStats(null);
  }, [mode, seed]);

  useEffect(() => {
    if (mode !== "aiVsAi") return;
    rngARef.current = seededRng(seed);
    rngBRef.current = seededRng(seed);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- os dois tabuleiros nascem do mesmo labirinto (mesma seed)
    setVsEspecializados(createInitialState(rngARef.current));
    setVsGulosos(createInitialState(rngBRef.current));
    setRaceWinner(null);
    setLastBfsStatsA(null);
    setLastBfsStatsB(null);
  }, [mode, seed]);

  // Modo play: sempre roda o conjunto especializado completo de monstros.
  useEffect(() => {
    if (mode !== "play" || live.over || live.won) return;
    const t = setInterval(() => {
      if (!startedRef.current) return;
      setLive((prev) =>
        prev.over || prev.won ? prev : tick(prev, { playerDir: pendingDirectionRef.current, autopilot: false, ensemble: "especializados" }, rngRef.current),
      );
    }, tickMs);
    return () => clearInterval(t);
  }, [mode, tickMs, live.over, live.won]);

  useEffect(() => {
    if (mode !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      let dir: Dir | null = null;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") dir = "up";
      else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") dir = "down";
      else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") dir = "left";
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") dir = "right";
      if (!dir) return;
      e.preventDefault();
      pendingDirectionRef.current = dir;
      startedRef.current = true;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  const touchDirection = (dir: Dir) => {
    pendingDirectionRef.current = dir;
    startedRef.current = true;
  };

  useEffect(() => {
    if (mode !== "especializados" || live.over || live.won) return;
    const t = setTimeout(() => {
      const plan = bfsPathDir(live.maze, live.hero.pos, live.pellets);
      setLastBfsStats(plan.stats);
      setLive((prev) => (prev.over || prev.won ? prev : tick(prev, { autopilot: true, ensemble: "especializados" }, rngRef.current)));
    }, tickMs);
    return () => clearTimeout(t);
  }, [mode, tickMs, live]);

  useEffect(() => {
    if (mode !== "gulosos" || live.over || live.won) return;
    const t = setTimeout(() => {
      const plan = bfsPathDir(live.maze, live.hero.pos, live.pellets);
      setLastBfsStats(plan.stats);
      setLive((prev) => (prev.over || prev.won ? prev : tick(prev, { autopilot: true, ensemble: "gulosos" }, rngRef.current)));
    }, tickMs);
    return () => clearTimeout(t);
  }, [mode, tickMs, live]);

  useEffect(() => {
    if (mode !== "aiVsAi" || raceWinner) return;
    const t = setTimeout(() => {
      if (!vsEspecializados.over && !vsEspecializados.won) {
        const plan = bfsPathDir(vsEspecializados.maze, vsEspecializados.hero.pos, vsEspecializados.pellets);
        setLastBfsStatsA(plan.stats);
        setVsEspecializados((prev) => (prev.over || prev.won ? prev : tick(prev, { autopilot: true, ensemble: "especializados" }, rngARef.current)));
      }
      if (!vsGulosos.over && !vsGulosos.won) {
        const plan = bfsPathDir(vsGulosos.maze, vsGulosos.hero.pos, vsGulosos.pellets);
        setLastBfsStatsB(plan.stats);
        setVsGulosos((prev) => (prev.over || prev.won ? prev : tick(prev, { autopilot: true, ensemble: "gulosos" }, rngBRef.current)));
      }
    }, tickMs);
    return () => clearTimeout(t);
  }, [mode, tickMs, vsEspecializados, vsGulosos, raceWinner]);

  useEffect(() => {
    if (mode !== "aiVsAi" || raceWinner) return;
    if (!vsEspecializados.over && !vsEspecializados.won && !vsGulosos.over && !vsGulosos.won) return;
    const effEspecializados = vsEspecializados.over ? vsEspecializados.ticks : Infinity;
    const effGulosos = vsGulosos.over ? vsGulosos.ticks : Infinity;
    let winner: RaceWinner;
    if (effEspecializados === Infinity && effGulosos === Infinity) winner = "tie";
    else if (effEspecializados < effGulosos) winner = "especializados";
    else if (effGulosos < effEspecializados) winner = "gulosos";
    else winner = "tie";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the race-ending condition just computed above
    setRaceWinner(winner);
  }, [mode, vsEspecializados, vsGulosos, raceWinner]);

  const resetRace = () => setSeed(randomSeed());

  const overlay = live.won
    ? { title: "VOCÊ VENCEU", subtitle: "Todos os itens foram coletados" }
    : live.over
      ? { title: "HERÓI FOI CAPTURADO", subtitle: mode === "play" ? "Um monstro te alcançou" : "Um monstro alcançou o piloto automático" }
      : null;

  const vsEspecializadosOverlay = vsEspecializados.won
    ? { title: "VITÓRIA", subtitle: "Labirinto zerado" }
    : vsEspecializados.over
      ? { title: "CAPTURADO", subtitle: `${vsEspecializados.ticks} tiques` }
      : null;
  const vsGulososOverlay = vsGulosos.won
    ? { title: "VITÓRIA", subtitle: "Labirinto zerado" }
    : vsGulosos.over
      ? { title: "CAPTURADO", subtitle: `${vsGulosos.ticks} tiques` }
      : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Masmorra</span>
            <span>/</span>
            <span className="accent">{MODE_LABELS[mode]}</span>
          </div>
          <h1 className="content-title">Masmorra</h1>
          <p className="content-sub">
            Fuja dos monstros e colete todos os itens de um labirinto gerado por algoritmo a cada
            partida. O herói sempre segue o mesmo piloto automático (busca em largura até o item mais
            próximo, cego a perigo) — o que muda é o conjunto de monstros: Especializados usa uma regra
            de alvo própria por monstro (perseguição direta, emboscada, flanco e recuo), Gulosos faz os
            quatro perseguirem diretamente a posição atual do herói.
          </p>
        </div>
      </div>

      <div className="workspace-card">
        <div className="workspace-head">
          <Select
            value={mode}
            onChange={(v) => setMode(v as PacmanMode)}
            options={(Object.keys(MODE_LABELS) as PacmanMode[]).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
            className="!w-auto shrink-0"
          />
          <div className="workspace-links">
            <button className="workspace-link" onClick={() => setParamsOpen(true)}>
              <Icon name="tune" className="text-[13px]" /> Parâmetros
            </button>
            <button
              className="workspace-link"
              onClick={() => setStatsOpen(true)}
              disabled={mode === "play" || (mode === "aiVsAi" ? !lastBfsStatsA && !lastBfsStatsB : !lastBfsStats)}
            >
              <Icon name="query_stats" className="text-[13px]" /> Última execução
            </button>
          </div>
        </div>

        <div className="canvas-body">
          <div className="canvas-stage bg-[radial-gradient(ellipse_at_50%_35%,rgba(201,106,61,0.08),transparent_60%)]">
            <StageHint>
              {mode === "aiVsAi" ? (
                <>
                  ESPECIALIZADOS <b className="readout-glow font-semibold text-primary">{vsEspecializados.ticks}t</b> · GULOSOS{" "}
                  <b className="readout-glow font-semibold text-primary">{vsGulosos.ticks}t</b>
                  {raceWinner && (
                    <>
                      {" "}
                      ·{" "}
                      <b className="readout-glow font-semibold text-primary">
                        {raceWinner === "especializados" ? "ESPECIALIZADOS CAPTUROU MAIS RÁPIDO" : raceWinner === "gulosos" ? "GULOSOS CAPTUROU MAIS RÁPIDO" : "EMPATE"}
                      </b>
                    </>
                  )}
                </>
              ) : (
                <>
                  PONTUAÇÃO <b className="readout-glow font-semibold text-primary">{live.score}</b> · TIQUES{" "}
                  <b className="readout-glow font-semibold text-primary">{live.ticks}</b> · ITENS{" "}
                  <b className="readout-glow font-semibold text-primary">
                    {live.totalPellets - live.pellets.size}/{live.totalPellets}
                  </b>
                </>
              )}
            </StageHint>

            {mode === "aiVsAi" ? (
              <div className="flex h-full w-full items-stretch justify-center gap-4">
                <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="shrink-0 font-mono text-[11px] text-on-surface-variant">ESPECIALIZADOS</span>
                  <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                    <PacmanGrid
                      maze={vsEspecializados.maze}
                      hero={vsEspecializados.hero}
                      monsters={vsEspecializados.monsters}
                      pellets={vsEspecializados.pellets}
                      potions={vsEspecializados.potions}
                      className="pacman-grid--vs"
                      overlay={vsEspecializadosOverlay}
                    />
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="shrink-0 font-mono text-[11px] text-on-surface-variant">GULOSOS</span>
                  <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                    <PacmanGrid
                      maze={vsGulosos.maze}
                      hero={vsGulosos.hero}
                      monsters={vsGulosos.monsters}
                      pellets={vsGulosos.pellets}
                      potions={vsGulosos.potions}
                      className="pacman-grid--vs"
                      overlay={vsGulososOverlay}
                      uniformMonsters
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <PacmanGrid
                  maze={live.maze}
                  hero={live.hero}
                  monsters={live.monsters}
                  pellets={live.pellets}
                  potions={live.potions}
                  overlay={overlay}
                  paused={mode === "play" && live.ticks === 0}
                  uniformMonsters={mode === "gulosos"}
                />
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
                {live.won ? "TODOS OS ITENS COLETADOS — VITÓRIA" : live.over ? "FIM DE JOGO — VOCÊ FOI CAPTURADO" : "WASD OU SETAS PARA MOVER"}
              </span>
              <button className="btn-pill" onClick={() => setSeed(randomSeed())}>
                <Icon name="refresh" className="text-[15px]" /> Novo jogo
              </button>
            </div>
          ) : mode === "aiVsAi" ? (
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 bg-background px-4 sm:px-5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${!raceWinner ? "animate-pulse" : ""}`} style={{ background: "var(--tertiary)" }} />
                {raceWinner === "especializados"
                  ? "MONSTROS ESPECIALIZADOS CAPTURARAM MAIS RÁPIDO"
                  : raceWinner === "gulosos"
                    ? "MONSTROS GULOSOS CAPTURARAM MAIS RÁPIDO"
                    : raceWinner === "tie"
                      ? "EMPATE"
                      : "OS DOIS TABULEIROS RODAM EM LOCKSTEP"}
              </span>
              <button className="btn-pill" onClick={resetRace}>
                <Icon name="refresh" className="text-[15px]" /> Nova corrida
              </button>
            </div>
          ) : (
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 bg-background px-4 sm:px-5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${live.over || live.won ? "" : "animate-pulse"}`} style={{ background: "var(--tertiary)" }} />
                {live.won
                  ? "TODOS OS ITENS COLETADOS — VITÓRIA"
                  : live.over
                    ? "HERÓI FOI CAPTURADO"
                    : mode === "especializados"
                      ? "MONSTROS ESPECIALIZADOS PERSEGUINDO"
                      : "MONSTROS GULOSOS PERSEGUINDO"}
              </span>
              <button className="btn-pill" onClick={() => setSeed(randomSeed())}>
                <Icon name="refresh" className="text-[15px]" /> Reiniciar
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal open={statsOpen} onClose={() => setStatsOpen(false)} title="Última execução">
        {mode === "aiVsAi" ? (
          <div className="flex flex-col gap-4">
            {lastBfsStatsA && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Especializados</p>
                <StatGrid
                  cols={2}
                  items={[
                    ["Caminho encontrado?", lastBfsStatsA.found ? "Sim" : "Não"],
                    ["Nós expandidos", String(lastBfsStatsA.nodesExpanded)],
                    ["Tempo", `${lastBfsStatsA.timeMs.toFixed(2)}ms`],
                    ["Passos até o item", String(lastBfsStatsA.pathLength)],
                  ]}
                />
              </div>
            )}
            {lastBfsStatsB && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Gulosos</p>
                <StatGrid
                  cols={2}
                  items={[
                    ["Caminho encontrado?", lastBfsStatsB.found ? "Sim" : "Não"],
                    ["Nós expandidos", String(lastBfsStatsB.nodesExpanded)],
                    ["Tempo", `${lastBfsStatsB.timeMs.toFixed(2)}ms`],
                    ["Passos até o item", String(lastBfsStatsB.pathLength)],
                  ]}
                />
              </div>
            )}
          </div>
        ) : (
          lastBfsStats && (
            <StatGrid
              cols={2}
              items={[
                ["Caminho encontrado?", lastBfsStats.found ? "Sim" : "Não"],
                ["Nós expandidos", String(lastBfsStats.nodesExpanded)],
                ["Tempo", `${lastBfsStats.timeMs.toFixed(2)}ms`],
                ["Passos até o item", String(lastBfsStats.pathLength)],
              ]}
            />
          )
        )}
      </Modal>

      <Modal open={paramsOpen} onClose={() => setParamsOpen(false)} title="Parâmetros" subtitle="O labirinto é gerado por algoritmo a partir da seed, sempre 21×21, sem túnel nas laterais">
        <Field label="Seed">
          <div className="flex items-center gap-2">
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="w-full" />
            <button className="btn btn-secondary !px-2.5" onClick={() => setSeed(randomSeed())} title="Novo labirinto aleatório">
              <Icon name="casino" className="text-[16px]" />
            </button>
          </div>
        </Field>
        <Field label={`Velocidade (${tickMs}ms por tique)`}>
          <input type="range" min={60} max={400} step={10} value={tickMs} onChange={(e) => setTickMs(Number(e.target.value))} className="w-full" />
        </Field>
        <p className="text-[11px] leading-relaxed text-on-surface-variant">
          A seed determina o labirinto inteiro: ele é gerado do zero (recursive-backtracker mais um
          pós-processamento de &quot;braiding&quot; que abre alguns loops extras pra dar chance de fuga),
          e a mesma seed também controla o desempate de movimento em modo assustado. Trocar a seed muda o
          labirinto, o covil dos monstros e a posição das poções.
        </p>
      </Modal>
    </div>
  );
}
