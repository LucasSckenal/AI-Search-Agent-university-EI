"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Field, Icon } from "@/components/shared/Panel";
import { Toggle } from "@/components/shared/Toggle";
import { Select } from "@/components/shared/Select";
import { Modal } from "@/components/shared/Modal";
import { SearchStatsTable, ALGO_COLOR } from "@/components/shared/SearchStatsTable";
import { Sidebar } from "@/components/shared/Sidebar";
import { CanvasStage, CanvasBox } from "@/components/shared/CanvasStage";
import { StatsPanel } from "@/components/shared/StatsPanel";
import { StatusFooter } from "@/components/shared/StatusFooter";
import { WebGLGate } from "@/components/shared/WebGLGate";
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
import { effectiveBranchingFactor } from "@/lib/core/metrics";
import { seededRng, randomSeed } from "@/lib/core/rng";
import { summarizeBatch, AlgorithmBatchSummary } from "@/lib/core/batch";
import { BatchStatsTable } from "@/components/shared/BatchStatsTable";

// WebGL only exists in the browser; loading it as a dynamic, SSR-disabled component keeps the
// three.js/react-three-fiber bundle out of the server render entirely.
const MazeCanvas = dynamic(() => import("@/components/maze/Maze3D").then((m) => m.MazeCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">
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

  // Reproducibility: off by default (plain Math.random, like before). When enabled, maze
  // generation draws from a seeded PRNG instead, so a specific seed number can be cited in a
  // report and regenerate the exact same maze later - "this instance" becomes a citable thing.
  const [useSeed, setUseSeed] = useState(false);
  const [seed, setSeed] = useState(() => randomSeed());

  // Monte Carlo batch comparison: a single instance is anecdotal (a different random maze could
  // flip which algorithm "looks better"); this runs every algorithm over N independent random
  // instances and aggregates mean/std per metric instead.
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchTrials, setBatchTrials] = useState(20);
  const [batchSummaries, setBatchSummaries] = useState<AlgorithmBatchSummary[] | null>(null);

  // Deterministic placeholder for SSR (avoids a hydration mismatch); the mount effect below
  // immediately replaces it with a real randomly generated maze on the client.
  const [maze, setMaze] = useState<MazeState>(() => createEmptyMaze(19, 27));
  const [result, setResult] = useState<SearchResult<number, string> | null>(null);
  const [compareResults, setCompareResults] = useState<SearchResult<number, string>[]>([]);
  const [revealCount, setRevealCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showPath, setShowPath] = useState(false);

  // Keyboard operability for the grid: the maze paint interaction was previously mouse/touch-only
  // (drag-to-paint over a WebGL canvas has no native keyboard equivalent). Arrow keys move a
  // highlighted "cursor" cell (rendered by Maze3D as a ring - see focusIndex), Enter/Space applies
  // the current brush to it, same as a click.
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

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
    const rng = useSeed ? seededRng(seed) : Math.random;
    let next: MazeState;
    if (mode === "perfect") next = generatePerfectMaze(rows, cols, rng);
    else if (mode === "random") next = generateRandomMaze(rows, cols, wallDensity, rng);
    else next = createEmptyMaze(rows, cols);
    setMaze(next);
    setResult(null);
    setCompareResults([]);
    setRevealCount(0);
    setShowPath(false);
    setPlaying(false);
    setFocusIndex(null);
    resetRace();
  };

  // Regenerate whenever size/mode/density change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rebuild the maze whenever its config changes
    regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cols, genMode]);

  // Manhattan is inadmissible once diagonal shortcuts exist (see the Select's options above) - if
  // the user turns diagonal movement on while it's selected, fall back to Octile (its diagonal-
  // aware counterpart) instead of silently letting A* run with a broken optimality guarantee.
  useEffect(() => {
    if (allowDiagonal && heuristic === "manhattan") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- keeps the heuristic valid whenever diagonal movement is toggled on
      setHeuristic("octile");
    }
  }, [allowDiagonal, heuristic]);

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

  const runBatch = () => {
    setBatchOpen(true);
    setBatchRunning(true);
    setBatchSummaries(null);
    setTimeout(() => {
      const rng = useSeed ? seededRng(seed) : Math.random;
      const perAlgo: Record<AlgorithmId, SearchResult<number, string>[]> = {
        bfs: [],
        dfs: [],
        ucs: [],
        greedy: [],
        astar: [],
      };
      for (let t = 0; t < batchTrials; t++) {
        let m: MazeState;
        if (genMode === "perfect") m = generatePerfectMaze(rows, cols, rng);
        else if (genMode === "random") m = generateRandomMaze(rows, cols, wallDensity, rng);
        else m = createEmptyMaze(rows, cols);
        const problem = buildMazeProblem(m, { allowDiagonal, heuristic });
        for (const a of ALGOS) perAlgo[a].push(search(problem, a, { maxNodes: 300_000 }));
      }
      setBatchSummaries(ALGOS.map((a) => summarizeBatch(a, perAlgo[a])));
      setBatchRunning(false);
    }, 20);
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

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    const i = focusIndex ?? maze.start;
    const [row, col] = [Math.floor(i / maze.cols), i % maze.cols];
    let next = i;
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (row > 0) next = i - maze.cols;
        break;
      case "ArrowDown":
        e.preventDefault();
        if (row < maze.rows - 1) next = i + maze.cols;
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (col > 0) next = i - 1;
        break;
      case "ArrowRight":
        e.preventDefault();
        if (col < maze.cols - 1) next = i + 1;
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        handleCellClick(i);
        return;
      default:
        return;
    }
    setFocusIndex(next);
  };

  const status = playing ? "ANIMANDO" : result ? (result.found ? "CONCLUÍDO" : "SEM SOLUÇÃO") : "PRONTO";

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Left floating sidebar: problem + brush + run controls */}
      <Sidebar>
        <div>
          <h1 className="text-sm font-semibold tracking-tight">Labirinto</h1>
          <p className="mt-1 text-[11px] leading-relaxed text-on-surface-variant">
            Início (lavanda) até o objetivo (laranja) num grid com paredes e lama (custo 5).
            Arraste com o botão esquerdo para pintar, botão direito para girar a câmera.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={() => setAdvancedOpen(true)}>
          <Icon name="tune" className="text-[16px]" /> Parâmetros ({rows}×{cols}, {ALGORITHM_LABELS[algorithm].split(" ")[0]})
        </button>

        <div>
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
          <button className="btn btn-secondary" onClick={runBatch}>
            <Icon name="query_stats" className="text-[16px]" /> Comparação em lote (N execuções)
          </button>
        </div>
      </Sidebar>

      {/* Center visualization */}
      <CanvasStage>
        <CanvasBox width={720} height={560}>
          <div
            className="h-full w-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            tabIndex={0}
            role="application"
            aria-label="Grade do labirinto. Use as setas para mover o cursor e Enter ou espaço para pintar a célula selecionada com o pincel atual."
            onKeyDown={handleGridKeyDown}
            onFocus={() => setFocusIndex((f) => f ?? maze.start)}
          >
            <WebGLGate>
              <MazeCanvas
                maze={maze}
                visited={visited}
                path={path}
                interactive
                onCellClick={handleCellClick}
                focusIndex={focusIndex}
              />
            </WebGLGate>
          </div>
        </CanvasBox>
      </CanvasStage>

      {/* Small floating stats panel (bottom-right) */}
      {result && (
        <StatsPanel
          items={[
            ["Status", result.found ? "OK" : "falhou"],
            ["Custo", result.found ? result.cost.toFixed(2) : "—"],
            ["Expandidos", result.nodesExpanded.toLocaleString("pt-BR")],
            ["Gerados", result.nodesGenerated.toLocaleString("pt-BR")],
            [
              "b*",
              result.found
                ? (effectiveBranchingFactor(result.nodesGenerated, result.actions.length)?.toFixed(2) ?? "—")
                : "—",
            ],
            ["Tempo", `${result.timeMs.toFixed(1)}ms`],
            ["Algoritmo", ALGORITHM_LABELS[result.algorithm].split(" ")[0]],
          ]}
        />
      )}

      {/* Floating status pill */}
      <StatusFooter
        status={status}
        pulsing={playing}
        segments={[
          { label: "Algoritmo", value: ALGORITHM_LABELS[algorithm], accent: true },
          { label: "Grid", value: `${rows}×${cols}` },
        ]}
      />

      <Modal
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        title="Parâmetros avançados"
        subtitle="Algoritmo, heurística e forma do labirinto"
      >
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
        <div className="border-t border-outline-variant pt-4">
          <Toggle checked={allowDiagonal} onChange={setAllowDiagonal} label="Movimento diagonal" />
        </div>
        <Field label="Heurística (Gulosa / A*)">
          <Select
            value={heuristic}
            onChange={(v) => setHeuristic(v as HeuristicId)}
            options={[
              // Manhattan overestimates the real cost once diagonal shortcuts exist (a diagonal
              // step covers 2 units of Manhattan distance for only √2× the cost of one orthogonal
              // step) - not admissible there, so it's hidden instead of quietly returning
              // suboptimal paths. See the README's heuristic-consistency section.
              ...(allowDiagonal ? [] : [{ value: "manhattan", label: "Manhattan" }]),
              { value: "euclidean", label: "Euclidiana" },
              { value: "chebyshev", label: "Chebyshev" },
              { value: "octile", label: "Octile" },
            ]}
          />
        </Field>
        {allowDiagonal && (
          <p className="text-[11px] leading-relaxed text-on-surface-variant">
            Manhattan fica indisponível com movimento diagonal ligado: ela superestima a distância
            real quando existe atalho diagonal, o que quebra a garantia de otimalidade do A*.
          </p>
        )}
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

        <div className="border-t border-outline-variant pt-4">
          <Toggle checked={useSeed} onChange={setUseSeed} label="Reprodutibilidade (seed fixo)" />
          <p className="mt-1.5 text-[11px] leading-relaxed text-on-surface-variant">
            Desligado: cada geração é aleatória, como antes. Ligado: o mesmo número de seed sempre
            gera o mesmo labirinto — cite o seed no relatório para que os resultados sejam
            reproduzíveis por quem reler.
          </p>
          {useSeed && (
            <div className="mt-2 flex items-center gap-2">
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
          )}
        </div>

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

      <Modal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        title="Comparação em lote (Monte Carlo)"
        subtitle="Cada algoritmo roda em N labirintos aleatórios independentes"
        wide
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label={`Execuções por algoritmo: ${batchTrials}`}>
            <input
              type="range"
              min={5}
              max={50}
              value={batchTrials}
              onChange={(e) => setBatchTrials(Number(e.target.value))}
            />
          </Field>
          <button className="btn btn-primary" onClick={runBatch} disabled={batchRunning}>
            <Icon name="play_arrow" className="text-[16px]" /> {batchRunning ? "Rodando…" : "Rodar lote"}
          </button>
        </div>
        {batchRunning ? (
          <p className="text-xs text-on-surface-variant">Rodando {batchTrials} instâncias por algoritmo…</p>
        ) : (
          <BatchStatsTable summaries={batchSummaries ?? []} />
        )}
      </Modal>

      {raceOpen && raceResults && (
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 p-6"
          onClick={() => setRaceOpen(false)}
        >
          <div className="flex min-h-full items-center justify-center">
          <div
            className="panel-flat flex max-h-[90vh] w-[min(1400px,96vw)] flex-col overflow-hidden rounded-3xl shadow-2xl"
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
                    <div className="h-[190px] w-full">
                      <WebGLGate>
                        <MazeCanvas
                          maze={maze}
                          visited={raceVisited}
                          path={done && r.found ? r.path : []}
                          controls={false}
                          view="top"
                        />
                      </WebGLGate>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
