"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Field, Icon } from "@/components/shared/Panel";
import { Toggle } from "@/components/shared/Toggle";
import { Select } from "@/components/shared/Select";
import { Modal } from "@/components/shared/Modal";
import { SearchStatsTable, ALGO_COLOR } from "@/components/shared/SearchStatsTable";
import {
  MazeState,
  CellKind,
  HeuristicId,
  buildMazeProblem,
  createEmptyMaze,
  generatePerfectMaze,
  generateRandomMaze,
  isConnected,
} from "@/lib/maze/model";
import { search, AlgorithmId, ALGORITHM_LABELS, SearchResult } from "@/lib/core/search";

// WebGL only exists in the browser; loading it as a dynamic, SSR-disabled component keeps the
// three.js/react-three-fiber bundle out of the server render entirely.
const MazeCanvas = dynamic(() => import("@/components/maze/Maze3D").then((m) => m.MazeCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] w-[720px] items-center justify-center text-xs text-on-surface-variant">
      Carregando labirinto 3D…
    </div>
  ),
});

type GenMode = "perfect" | "random" | "empty";
type Brush = CellKind | "start" | "goal";

const ALGOS: AlgorithmId[] = ["bfs", "dfs", "ucs", "greedy", "astar"];

export default function LabirintoPage() {
  const [rows, setRows] = useState(19);
  const [cols, setCols] = useState(27);
  const [genMode, setGenMode] = useState<GenMode>("perfect");
  const [wallDensity, setWallDensity] = useState(0.28);
  const [allowDiagonal, setAllowDiagonal] = useState(false);
  const [heuristic, setHeuristic] = useState<HeuristicId>("manhattan");
  const [algorithm, setAlgorithm] = useState<AlgorithmId>("astar");
  const [brush, setBrush] = useState<Brush>("wall");
  const [speed, setSpeed] = useState(40); // cells revealed per tick
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  // Deterministic placeholder for SSR (avoids a hydration mismatch); the mount effect below
  // immediately replaces it with a real randomly generated maze on the client.
  const [maze, setMaze] = useState<MazeState>(() => createEmptyMaze(19, 27));
  const [result, setResult] = useState<SearchResult<number, string> | null>(null);
  const [compareResults, setCompareResults] = useState<SearchResult<number, string>[]>([]);
  const [revealCount, setRevealCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showPath, setShowPath] = useState(false);

  // Algorithm race: all 5 algorithms run on the same maze and animate simultaneously in real
  // time, so the difference in nodes explored shows up directly as a difference in finish time.
  const [raceOpen, setRaceOpen] = useState(false);
  const [raceResults, setRaceResults] = useState<Record<AlgorithmId, SearchResult<number, string>> | null>(null);
  const [raceReveal, setRaceReveal] = useState<Record<AlgorithmId, number>>({} as Record<AlgorithmId, number>);
  const [racePlaying, setRacePlaying] = useState(false);
  const [raceSpeed, setRaceSpeed] = useState(6);
  const [raceFinishOrder, setRaceFinishOrder] = useState<{ algo: AlgorithmId; ms: number }[]>([]);
  const raceStartRef = useRef(0);

  const resetRace = () => {
    setRaceOpen(false);
    setRacePlaying(false);
    setRaceResults(null);
    setRaceFinishOrder([]);
  };

  const regenerate = (mode: GenMode = genMode) => {
    let next: MazeState;
    if (mode === "perfect") next = generatePerfectMaze(rows, cols);
    else if (mode === "random") next = generateRandomMaze(rows, cols, wallDensity);
    else next = createEmptyMaze(rows, cols);
    setMaze(next);
    setResult(null);
    setCompareResults([]);
    setRevealCount(0);
    setShowPath(false);
    setPlaying(false);
    resetRace();
  };

  // Regenerate whenever size/mode/density change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rebuild the maze whenever its config changes
    regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cols, genMode]);

  const runAlgorithm = (algo: AlgorithmId = algorithm) => {
    const problem = buildMazeProblem(maze, { allowDiagonal, heuristic });
    const res = search(problem, algo, { maxNodes: 300_000 });
    setResult(res);
    setCompareResults([]);
    setRevealCount(0);
    setShowPath(false);
    setPlaying(true);
  };

  const runComparison = () => {
    const problem = buildMazeProblem(maze, { allowDiagonal, heuristic });
    const results = ALGOS.map((a) => search(problem, a, { maxNodes: 300_000 }));
    setCompareResults(results);
    setResult(results.find((r) => r.algorithm === algorithm) ?? results[0]);
    setRevealCount(results[0].exploredOrder.length);
    setShowPath(true);
    setPlaying(false);
    setCompareOpen(true);
  };

  const startRace = () => {
    const problem = buildMazeProblem(maze, { allowDiagonal, heuristic });
    const results = Object.fromEntries(ALGOS.map((a) => [a, search(problem, a, { maxNodes: 300_000 })])) as Record<
      AlgorithmId,
      SearchResult<number, string>
    >;
    setRaceResults(results);
    setRaceReveal(Object.fromEntries(ALGOS.map((a) => [a, 0])) as Record<AlgorithmId, number>);
    setRaceFinishOrder([]);
    raceStartRef.current = performance.now();
    setRacePlaying(true);
    setRaceOpen(true);
  };

  // Playback timer.
  useEffect(() => {
    if (!playing || !result) return;
    if (revealCount >= result.exploredOrder.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setPlaying(false);
      setShowPath(true);
      return;
    }
    const t = setTimeout(() => setRevealCount((c) => Math.min(c + Math.max(1, speed), result.exploredOrder.length)), 16);
    return () => clearTimeout(t);
  }, [playing, revealCount, result, speed]);

  // Race playback timer: advances every algorithm's reveal count by the same step each tick, so
  // an algorithm that explores fewer nodes visibly finishes sooner - efficiency becomes duration.
  useEffect(() => {
    if (!racePlaying || !raceResults) return;
    const allDone = ALGOS.every((a) => (raceReveal[a] ?? 0) >= raceResults[a].exploredOrder.length);
    if (allDone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setRacePlaying(false);
      return;
    }
    const t = setTimeout(() => {
      setRaceReveal((prev) => {
        const next = { ...prev };
        for (const a of ALGOS) {
          const total = raceResults[a].exploredOrder.length;
          next[a] = Math.min((prev[a] ?? 0) + Math.max(1, raceSpeed), total);
        }
        return next;
      });
    }, 16);
    return () => clearTimeout(t);
  }, [racePlaying, raceReveal, raceResults, raceSpeed]);

  // Records finish times (relative to race start) the moment each algorithm's reveal catches up
  // to its own exploredOrder - kept separate from the tick effect so state updaters stay pure.
  useEffect(() => {
    if (!raceResults) return;
    const finished = new Set(raceFinishOrder.map((f) => f.algo));
    const newlyFinished = ALGOS.filter(
      (a) => !finished.has(a) && raceResults[a].found && (raceReveal[a] ?? 0) >= raceResults[a].exploredOrder.length
    );
    if (newlyFinished.length > 0) {
      const now = performance.now();
      setRaceFinishOrder((order) => [...order, ...newlyFinished.map((a) => ({ algo: a, ms: now - raceStartRef.current }))]);
    }
  }, [raceReveal, raceResults, raceFinishOrder]);

  const visited = useMemo(() => {
    if (!result) return new Set<number>();
    return new Set(result.exploredOrder.slice(0, revealCount));
  }, [result, revealCount]);

  const path = useMemo(() => {
    if (!result || !showPath) return [] as number[];
    return result.path;
  }, [result, showPath]);

  const handleCellClick = (i: number) => {
    setMaze((m) => {
      const next = { ...m, cells: [...m.cells] };
      if (brush === "start") {
        if (next.cells[i] === "wall") return m;
        next.start = i;
      } else if (brush === "goal") {
        if (next.cells[i] === "wall") return m;
        next.goal = i;
      } else {
        if (i === next.start || i === next.goal) return m;
        next.cells[i] = brush as CellKind;
      }
      // Refuse any edit that would seal off the only path between start and goal - the maze
      // must always stay solvable.
      if (!isConnected(next)) return m;
      return next;
    });
    setResult(null);
    setCompareResults([]);
    setRevealCount(0);
    setShowPath(false);
    resetRace();
  };

  const status = playing ? "ANIMANDO" : result ? (result.found ? "CONCLUÍDO" : "SEM SOLUÇÃO") : "PRONTO";

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Left floating sidebar: problem + brush + run controls */}
      <aside className="glass fixed left-6 top-20 bottom-20 z-40 flex w-[290px] flex-col gap-3 overflow-y-auto rounded-3xl p-4 shadow-2xl">
        <p className="text-[11px] leading-relaxed text-on-surface-variant">
          Início (lavanda) até o objetivo (laranja) num grid com paredes e lama (custo 5). Arraste
          com o botão esquerdo para pintar, botão direito para girar a câmera.
        </p>

        <div className="flex flex-col gap-2.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Configuração
          </h3>
          <Field label="Heurística (Gulosa / A*)">
            <Select
              value={heuristic}
              onChange={(v) => setHeuristic(v as HeuristicId)}
              options={[
                { value: "manhattan", label: "Manhattan" },
                { value: "euclidean", label: "Euclidiana" },
                { value: "chebyshev", label: "Chebyshev" },
                { value: "octile", label: "Octile" },
              ]}
            />
          </Field>
          <button className="btn btn-secondary" onClick={() => setAdvancedOpen(true)}>
            <Icon name="tune" className="text-[16px]" /> Parâmetros avançados
          </button>
        </div>

        <div className="border-t border-white/5 pt-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Edição do grid
          </h3>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ["wall", "Parede"],
                ["mud", "Lama"],
                ["empty", "Vazio"],
                ["start", "Início"],
                ["goal", "Objetivo"],
              ] as [Brush, string][]
            ).map(([b, label]) => (
              <button
                key={b}
                onClick={() => setBrush(b)}
                className={`btn ${brush === b ? "btn-primary" : "btn-secondary"} !px-2 !py-1.5 text-[11px]`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            {[
              ["#4a4f5c", "Parede"],
              ["#5b6070", "Explorado"],
              ["#8a5a2e", "Lama"],
              ["#f5f6fa", "Caminho"],
            ].map(([color, label]) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}66` }} />
                <span className="text-on-surface/80">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2.5 border-t border-white/5 pt-3">
          <Field label="Algoritmo">
            <Select
              value={algorithm}
              onChange={(v) => setAlgorithm(v as AlgorithmId)}
              options={ALGOS.map((a) => ({ value: a, label: ALGORITHM_LABELS[a] }))}
            />
          </Field>
          <Field label={`Velocidade: ${speed} células/quadro`}>
            <input type="range" min={1} max={200} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
          </Field>
          <button className="btn btn-primary" onClick={() => runAlgorithm()}>
            <Icon name="play_arrow" /> Executar e animar
          </button>
          <div className="grid grid-cols-3 gap-1.5">
            <button className="btn btn-secondary" onClick={() => setPlaying((p) => !p)} disabled={!result}>
              <Icon name={playing ? "pause" : "play_arrow"} className="text-[18px]" />
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (!result) return;
                setRevealCount(result.exploredOrder.length);
                setShowPath(true);
                setPlaying(false);
              }}
              disabled={!result}
            >
              <Icon name="skip_next" className="text-[18px]" />
            </button>
            <button className="btn btn-secondary" onClick={runComparison}>
              <Icon name="compare_arrows" className="text-[18px]" />
            </button>
          </div>
          <button className="btn btn-secondary" onClick={startRace}>
            <Icon name="flag" className="text-[16px]" /> Corrida entre algoritmos
          </button>
        </div>
      </aside>

      {/* Center visualization */}
      <div className="flex h-full w-full items-center justify-center overflow-auto py-24 pl-[338px] pr-8">
        <div className="glass overflow-hidden rounded-2xl p-2 shadow-2xl">
          <div className="h-[560px] w-[720px] overflow-hidden rounded-xl">
            <MazeCanvas maze={maze} visited={visited} path={path} interactive onCellClick={handleCellClick} />
          </div>
        </div>
      </div>

      {/* Small floating stats panel (bottom-right) */}
      {result && (
        <aside className="glass fixed bottom-24 right-6 z-40 flex flex-col gap-3 rounded-2xl p-4 shadow-2xl">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Status", result.found ? "OK" : "falhou"],
              ["Custo", result.found ? result.cost.toFixed(2) : "—"],
              ["Expandidos", result.nodesExpanded.toLocaleString("pt-BR")],
              ["Gerados", result.nodesGenerated.toLocaleString("pt-BR")],
              ["Tempo", `${result.timeMs.toFixed(1)}ms`],
              ["Algoritmo", ALGORITHM_LABELS[result.algorithm].split(" ")[0]],
            ].map(([label, value]) => (
              <div key={label} className="flex min-w-[80px] flex-col items-center justify-center rounded-xl bg-white/5 px-4 py-2">
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant/70">{label}</div>
                <div className="truncate font-mono text-[14px] font-medium text-on-surface">{value}</div>
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* Floating status pill */}
      <footer className="glass-strong fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-6 rounded-full px-6 py-2 text-[11px] font-medium shadow-xl">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${playing ? "animate-pulse" : ""}`}
            style={{ background: "var(--tertiary)", boxShadow: "0 0 8px rgba(255,183,123,0.6)" }}
          />
          <span className="tracking-wide text-on-surface-variant/80">{status}</span>
        </div>
        <div className="flex items-center gap-2 border-l border-white/10 pl-4">
          <span className="uppercase text-on-surface-variant/60">Algoritmo:</span>
          <span className="font-mono text-primary/90">{ALGORITHM_LABELS[algorithm]}</span>
        </div>
        <div className="flex items-center gap-2 border-l border-white/10 pl-4">
          <span className="uppercase text-on-surface-variant/60">Grid:</span>
          <span className="font-mono text-on-surface/90">
            {rows}×{cols}
          </span>
        </div>
      </footer>

      <Modal
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        title="Parâmetros avançados"
        subtitle="Forma e geração do labirinto"
      >
        <Toggle checked={allowDiagonal} onChange={setAllowDiagonal} label="Movimento diagonal" />
        <Field label={`Linhas: ${rows}`}>
          <input type="range" min={7} max={35} value={rows} onChange={(e) => setRows(Number(e.target.value))} />
        </Field>
        <Field label={`Colunas: ${cols}`}>
          <input type="range" min={7} max={45} value={cols} onChange={(e) => setCols(Number(e.target.value))} />
        </Field>
        <Field label="Geração">
          <Select
            value={genMode}
            onChange={(v) => setGenMode(v as GenMode)}
            options={[
              { value: "perfect", label: "Labirinto perfeito" },
              { value: "random", label: "Obstáculos aleatórios" },
              { value: "empty", label: "Grid vazio" },
            ]}
          />
        </Field>
        {genMode === "random" && (
          <Field label={`Densidade de paredes: ${(wallDensity * 100).toFixed(0)}%`}>
            <input
              type="range"
              min={0.05}
              max={0.45}
              step={0.01}
              value={wallDensity}
              onChange={(e) => setWallDensity(Number(e.target.value))}
              onMouseUp={() => regenerate()}
              onTouchEnd={() => regenerate()}
            />
          </Field>
        )}
        <button
          className="btn btn-primary"
          onClick={() => {
            regenerate();
            setAdvancedOpen(false);
          }}
        >
          <Icon name="refresh" className="text-[16px]" /> Gerar novo labirinto
        </button>
      </Modal>

      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Comparação entre algoritmos"
        subtitle="Mesma instância do labirinto para todos"
        wide
      >
        <SearchStatsTable results={compareResults} />
      </Modal>

      {raceOpen && raceResults && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6"
          onClick={() => setRaceOpen(false)}
        >
          <div
            className="panel-flat flex max-h-[92vh] w-[min(1400px,96vw)] flex-col overflow-hidden rounded-3xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
              <div>
                <h3 className="text-sm font-semibold text-on-surface">Corrida entre algoritmos</h3>
                <p className="mt-0.5 text-[11px] text-on-surface-variant">
                  Mesmo labirinto, os 5 algoritmos explorando ao mesmo tempo, na mesma velocidade — quem expande menos
                  nós termina primeiro.
                </p>
              </div>
              <button
                onClick={() => setRaceOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-white/10 hover:text-on-surface"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-b border-outline-variant px-6 py-3">
              <button className="btn btn-secondary" onClick={() => setRacePlaying((p) => !p)}>
                <Icon name={racePlaying ? "pause" : "play_arrow"} className="text-[16px]" />
                {racePlaying ? "Pausar" : "Continuar"}
              </button>
              <button className="btn btn-secondary" onClick={startRace}>
                <Icon name="refresh" className="text-[16px]" /> Reiniciar corrida
              </button>
              <div className="flex min-w-[220px] flex-1 items-center gap-2">
                <span className="whitespace-nowrap text-[11px] text-on-surface-variant">Velocidade</span>
                <input
                  type="range"
                  min={1}
                  max={40}
                  value={raceSpeed}
                  onChange={(e) => setRaceSpeed(Number(e.target.value))}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2 xl:grid-cols-3">
              {ALGOS.map((a) => {
                const r = raceResults[a];
                const reveal = raceReveal[a] ?? 0;
                const total = r.exploredOrder.length;
                const done = reveal >= total;
                const finishIndex = raceFinishOrder.findIndex((f) => f.algo === a);
                const raceVisited = new Set(r.exploredOrder.slice(0, reveal));
                return (
                  <div key={a} className="flex flex-col overflow-hidden rounded-2xl bg-white/5">
                    <div className="flex items-center justify-between px-3 py-2 text-[11px]">
                      <span className="inline-flex items-center gap-1.5 font-medium text-on-surface">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: ALGO_COLOR[a], boxShadow: `0 0 6px ${ALGO_COLOR[a]}66` }}
                        />
                        {ALGORITHM_LABELS[a]}
                      </span>
                      {done ? (
                        r.found ? (
                          <span className="font-mono text-primary">
                            🏁 {finishIndex + 1}º · {(raceFinishOrder[finishIndex]?.ms ?? 0).toFixed(0)}ms
                          </span>
                        ) : (
                          <span className="text-error">sem solução</span>
                        )
                      ) : (
                        <span className="font-mono text-on-surface-variant">
                          {reveal}/{total}
                        </span>
                      )}
                    </div>
                    <div className="h-[220px] w-full">
                      <MazeCanvas
                        maze={maze}
                        visited={raceVisited}
                        path={done && r.found ? r.path : []}
                        controls={false}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
