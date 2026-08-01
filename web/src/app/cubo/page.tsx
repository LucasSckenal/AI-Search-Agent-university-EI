"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Field, Icon } from "@/components/shared/Panel";
import { Select } from "@/components/shared/Select";
import { Modal } from "@/components/shared/Modal";
import { Toggle } from "@/components/shared/Toggle";
import { SearchStatsTable, ALGO_COLOR } from "@/components/shared/SearchStatsTable";
import { Sidebar } from "@/components/shared/Sidebar";
import { CanvasStage, CanvasBox } from "@/components/shared/CanvasStage";
import { StatsPanel } from "@/components/shared/StatsPanel";
import { StatusFooter } from "@/components/shared/StatusFooter";
import { WebGLGate } from "@/components/shared/WebGLGate";
import {
  CubeSize,
  CubeState,
  MoveId,
  solvedCube,
  applyMove,
  applyMoves,
  generateScramble,
  buildCubeProblem,
  isSolved,
  piecesPerMove,
} from "@/lib/cube/model";

// WebGL only exists in the browser; loading it as a dynamic, SSR-disabled component keeps the
// three.js/react-three-fiber bundle out of the server render entirely.
const CubeCanvas = dynamic(() => import("@/components/cube/Cube3D").then((m) => m.CubeCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">
      Carregando cubo 3D…
    </div>
  ),
});
import { search, AlgorithmId, ALGORITHM_LABELS, SearchResult } from "@/lib/core/search";
import { effectiveBranchingFactor } from "@/lib/core/metrics";

const ALGOS: AlgorithmId[] = ["bfs", "ucs", "greedy", "astar"];

/** Picks up to `maxFrames` evenly spaced indices from [0, length), always including the last one. */
function sampleIndices(length: number, maxFrames: number): number[] {
  if (length <= maxFrames) return Array.from({ length }, (_, i) => i);
  return Array.from({ length: maxFrames }, (_, i) => Math.round((i * (length - 1)) / (maxFrames - 1)));
}

export default function CuboPage() {
  const [size, setSize] = useState<CubeSize>(2);
  const [scrambleLen, setScrambleLen] = useState(4);
  const [scramble, setScramble] = useState<MoveId[]>([]);
  const [startCube, setStartCube] = useState<CubeState>(() => solvedCube(2));
  const [displayCube, setDisplayCube] = useState<CubeState>(() => solvedCube(2));
  const [algorithm, setAlgorithm] = useState<AlgorithmId>("astar");
  const [result, setResult] = useState<SearchResult<CubeState, MoveId> | null>(null);
  const [compareResults, setCompareResults] = useState<SearchResult<CubeState, MoveId>[]>([]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [animatingMove, setAnimatingMove] = useState<MoveId | null>(null);
  const [maxNodes, setMaxNodes] = useState(260_000);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  // Search-exploration preview: before playing the real solution, flip rapidly through a sample of
  // the states the algorithm actually visited (result.exploredOrder, already full cube snapshots
  // from the shared search() engine) - the same "make the search process visible" idea as the
  // maze's cell-reveal animation and race mode, adapted to a state-space search instead of a grid.
  // Off by default: a full-board flicker at ~35 frames/second is well above the WCAG threshold for
  // photosensitive-epilepsy triggers (3 flashes/second), so it must be an explicit opt-in.
  const [exploreEnabled, setExploreEnabled] = useState(false);
  const [exploreFrames, setExploreFrames] = useState<CubeState[] | null>(null);
  const [exploreRealIndices, setExploreRealIndices] = useState<number[]>([]);
  const [exploreStep, setExploreStep] = useState(0);
  const [exploring, setExploring] = useState(false);

  const doScramble = (forSize: CubeSize = size) => {
    const moves = generateScramble(scrambleLen, forSize);
    const cube = applyMoves(solvedCube(forSize), moves);
    setScramble(moves);
    setStartCube(cube);
    setDisplayCube(cube);
    setResult(null);
    setCompareResults([]);
    setStep(0);
    setPlaying(false);
    setAnimatingMove(null);
    setExploring(false);
    setExploreFrames(null);
  };

  // Re-scrambles on mount and whenever the cube size changes (a 2x2 scramble makes no sense once
  // the pieces have changed shape entirely).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rebuilds the cube for the current size
    doScramble(size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  const runSolve = (algo: AlgorithmId = algorithm) => {
    setBusy(true);
    setTimeout(() => {
      const problem = buildCubeProblem(startCube, size);
      const res = search(problem, algo, { maxNodes });
      setResult(res);
      setCompareResults([]);
      setStep(0);
      setAnimatingMove(null);
      setBusy(false);
      if (exploreEnabled && res.found && res.exploredOrder.length > 1) {
        const indices = sampleIndices(res.exploredOrder.length, 90);
        setExploreRealIndices(indices);
        setExploreFrames(indices.map((i) => res.exploredOrder[i]));
        setExploreStep(0);
        setExploring(true);
        setPlaying(false);
      } else {
        setDisplayCube(startCube);
        setExploring(false);
        setPlaying(res.found);
      }
    }, 20);
  };

  const runComparison = () => {
    setBusy(true);
    setTimeout(() => {
      const problem = buildCubeProblem(startCube, size);
      const results = ALGOS.map((a) => search(problem, a, { maxNodes }));
      setCompareResults(results);
      const chosen = results.find((r) => r.algorithm === algorithm) ?? results[0];
      setResult(chosen);
      setStep(chosen.actions.length);
      setDisplayCube(chosen.found ? applyMoves(startCube, chosen.actions) : startCube);
      setAnimatingMove(null);
      setExploring(false);
      setExploreFrames(null);
      setBusy(false);
      setPlaying(false);
      setCompareOpen(true);
    }, 20);
  };

  // Exploration-preview playback: snaps displayCube directly to each sampled state (there's no
  // single rotation that connects two arbitrary search states, so this is a hard cut, not a tween)
  // - once the sample is exhausted, hands off to the real move-by-move solve animation below.
  useEffect(() => {
    if (!exploring || !exploreFrames) return;
    if (exploreStep >= exploreFrames.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setExploring(false);
      setDisplayCube(startCube);
      setPlaying(true);
      return;
    }
    setDisplayCube(exploreFrames[exploreStep]);
    const t = setTimeout(() => setExploreStep((s) => s + 1), 28);
    return () => clearTimeout(t);
  }, [exploring, exploreStep, exploreFrames, startCube]);

  // Kicks off the 3D animation for the current step; the 3D component calls handleMoveSettled
  // once the turn finishes, which commits the move and advances to the next one (if still playing).
  useEffect(() => {
    if (!playing || exploring || !result || !result.found) return;
    if (step >= result.actions.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setPlaying(false);
      return;
    }
    setAnimatingMove(result.actions[step]);
  }, [playing, exploring, step, result]);

  const handleMoveSettled = () => {
    if (!result) return;
    const move = result.actions[step];
    setDisplayCube((c) => applyMove(c, move));
    setAnimatingMove(null);
    setStep((s) => s + 1);
  };

  const solved = isSolved(displayCube);
  const status = busy
    ? "CALCULANDO"
    : exploring
      ? "EXPLORANDO ESTADOS"
      : playing
        ? "ANIMANDO SOLUÇÃO"
        : result
          ? result.found
            ? "RESOLVIDO"
            : "SEM SOLUÇÃO"
          : "PRONTO";

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Left floating sidebar: actions only, all parameters live in the modal */}
      <Sidebar>
        <div>
          <h1 className="text-sm font-semibold tracking-tight">Cubo Mágico {size}x{size}</h1>
          <p className="mt-1 text-[11px] leading-relaxed text-on-surface-variant">
            {size === 2
              ? "Pocket Cube com 3.674.160 estados — pequeno o bastante para comparar busca cega com busca informada de verdade."
              : "Cubo padrão com ~4,3×10¹⁹ estados — bom demais para busca cega ir muito longe, ótimo para ver na prática por que heurística importa."}
          </p>
        </div>

        <button className="btn btn-secondary" onClick={() => setAdvancedOpen(true)}>
          <Icon name="tune" className="text-[16px]" /> Parâmetros ({size}x{size}, {scrambleLen} mov., {ALGORITHM_LABELS[algorithm].split(" ")[0]})
        </button>

        <div className="flex flex-col gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Ações
          </h3>
          <button className="btn btn-secondary" onClick={() => doScramble()} disabled={busy || exploring}>
            <Icon name="casino" className="text-[16px]" /> Embaralhar
          </button>
          <div className="rounded-xl bg-white/5 px-3 py-2 text-[12px]">
            <span className="text-on-surface-variant">Sequência: </span>
            <span className="font-mono text-on-surface">{scramble.join(" ") || "—"}</span>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-3 border-t border-white/5 pt-4">
          <button className="btn btn-primary" onClick={() => runSolve()} disabled={busy || exploring}>
            <Icon name="play_arrow" /> {busy ? "Calculando…" : "Resolver e animar"}
          </button>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              className="btn btn-secondary"
              onClick={() => setPlaying((p) => !p)}
              disabled={!result?.found || exploring}
            >
              <Icon name={playing ? "pause" : "play_arrow"} className="text-[18px]" />
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (!result?.found) return;
                setExploring(false);
                setDisplayCube(applyMoves(startCube, result.actions));
                setStep(result.actions.length);
                setAnimatingMove(null);
                setPlaying(false);
              }}
              disabled={!result?.found}
            >
              <Icon name="skip_next" className="text-[18px]" />
            </button>
          </div>
          <button className="btn btn-secondary" onClick={runComparison} disabled={busy || exploring}>
            <Icon name="compare_arrows" className="text-[16px]" /> Comparar algoritmos
          </button>
        </div>
      </Sidebar>

      {/* Center visualization */}
      <CanvasStage>
        <CanvasBox
          width={440}
          height={440}
          className="bg-[radial-gradient(circle_at_50%_38%,rgba(175,198,255,0.1),transparent_70%)]"
        >
          <WebGLGate>
            <CubeCanvas
              cube={displayCube}
              size={size}
              animatingMove={animatingMove}
              onMoveSettled={handleMoveSettled}
              idle={!busy && !exploring && !playing}
            />
            {exploring && (
              <>
                <div
                  className="pointer-events-none absolute inset-0 animate-pulse rounded-2xl"
                  style={{ boxShadow: `inset 0 0 42px ${ALGO_COLOR[algorithm]}66` }}
                />
                <div
                  className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-[11px] font-mono backdrop-blur-sm"
                  style={{ color: ALGO_COLOR[algorithm] }}
                >
                  🔍 Explorando nó {((exploreRealIndices[exploreStep] ?? 0) + 1).toLocaleString("pt-BR")} /{" "}
                  {(result?.nodesExpanded ?? 0).toLocaleString("pt-BR")}
                </div>
              </>
            )}
          </WebGLGate>
        </CanvasBox>
        <p
          className={`rounded-full px-3 py-1 text-[11px] font-medium ${
            solved ? "bg-primary/20 text-primary" : "bg-white/5 text-on-surface-variant"
          }`}
        >
          {solved ? "✓ Resolvido" : "Não resolvido"}
        </p>
      </CanvasStage>

      {/* Small floating stats panel (bottom-right) */}
      {result && (
        <StatsPanel
          items={[
            ["Status", result.found ? "OK" : result.truncated ? "limite" : "falhou"],
            ["Movimentos", result.found ? String(result.actions.length) : "—"],
            ["Expandidos", result.nodesExpanded.toLocaleString("pt-BR")],
            [
              "b*",
              result.found
                ? (effectiveBranchingFactor(result.nodesGenerated, result.actions.length)?.toFixed(2) ?? "—")
                : "—",
            ],
            ["Tempo", `${result.timeMs.toFixed(1)}ms`],
            ["Algoritmo", ALGORITHM_LABELS[result.algorithm].split(" ")[0]],
          ]}
        >
          {result.found && (
            <div className="rounded-xl bg-white/5 px-3 py-2 text-[12px]">
              <span className="text-on-surface-variant">Solução: </span>
              <span className="font-mono text-on-surface">{result.actions.join(" ")}</span>
            </div>
          )}
        </StatsPanel>
      )}

      {/* Floating status pill */}
      <StatusFooter
        status={status}
        pulsing={busy || exploring || playing}
        segments={[
          { label: "Algoritmo", value: ALGORITHM_LABELS[algorithm], accent: true },
          { label: "Embaralhamento", value: `${scrambleLen} movimentos` },
          { label: "Cubo", value: `${size}x${size}` },
        ]}
      />

      <Modal
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        title="Parâmetros avançados"
        subtitle="Tamanho do cubo, embaralhamento, algoritmo e limites de busca"
      >
        <Field label="Tamanho do cubo">
          <Select
            value={String(size)}
            onChange={(v) => setSize(Number(v) as CubeSize)}
            options={[
              { value: "2", label: "2x2 (Pocket Cube)" },
              { value: "3", label: "3x3 (padrão)" },
            ]}
          />
        </Field>
        <Field label={`Profundidade do embaralhamento: ${scrambleLen}`}>
          <input
            type="range"
            min={1}
            max={7}
            value={scrambleLen}
            onChange={(e) => setScrambleLen(Number(e.target.value))}
          />
        </Field>
        <p className="text-[11px] text-on-surface-variant">
          {size === 2
            ? "Acima de 5-6 movimentos, BFS/UCS podem levar vários segundos; A* e Gulosa permanecem rápidos graças à heurística."
            : "No 3x3, BFS/UCS praticamente sempre batem no limite de segurança acima de 1-2 movimentos — o espaço de estados é grande demais. A* e Gulosa ainda tentam, sem garantia de serem rápidos."}
        </p>
        <Field label="Algoritmo">
          <Select
            value={algorithm}
            onChange={(v) => setAlgorithm(v as AlgorithmId)}
            options={ALGOS.map((a) => ({ value: a, label: ALGORITHM_LABELS[a] }))}
          />
        </Field>
        <div className="border-t border-outline-variant pt-4">
          <Toggle
            checked={exploreEnabled}
            onChange={setExploreEnabled}
            label="Pré-visualização da busca (piscar rápido)"
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-on-surface-variant">
            Antes da solução, o cubo pisca por uma amostra dos estados explorados (~35 quadros/s).
            Desativado por padrão: acima de 3 flashes por segundo é um gatilho conhecido de
            epilepsia fotossensível. Ative só se souber que é seguro para quem for assistir.
          </p>
        </div>
        <div className="border-t border-outline-variant pt-4">
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Heurística (Gulosa / A*)
          </h4>
          <p className="text-[12px] leading-relaxed text-on-surface-variant">
            <span className="font-mono text-tertiary">⌈peças fora do lugar / {piecesPerMove(size)}⌉</span> —
            admissível pois cada movimento afeta no máximo {piecesPerMove(size)} peças (
            {size === 2 ? "os 4 cantos da camada" : "os 4 cantos + 4 arestas da camada; o centro não se move"}
            ), então nunca superestima a distância real até o estado resolvido.
          </p>
        </div>
        <Field label={`Limite de nós expandidos: ${maxNodes.toLocaleString("pt-BR")}`}>
          <input
            type="range"
            min={20_000}
            max={500_000}
            step={10_000}
            value={maxNodes}
            onChange={(e) => setMaxNodes(Number(e.target.value))}
          />
        </Field>
        <p className="text-[11px] text-on-surface-variant">
          Trava de segurança para BFS/UCS: acima desse número de nós expandidos a busca é
          interrompida e reportada como &ldquo;limite atingido&rdquo; em vez de travar a interface.
        </p>
      </Modal>

      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Comparação entre algoritmos"
        subtitle="Mesmo embaralhamento para todos"
        wide
      >
        <SearchStatsTable results={compareResults} />
      </Modal>
    </div>
  );
}
