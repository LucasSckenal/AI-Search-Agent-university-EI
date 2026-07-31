"use client";

import { useEffect, useState } from "react";
import { Field, Icon } from "@/components/shared/Panel";
import { Select } from "@/components/shared/Select";
import { Modal } from "@/components/shared/Modal";
import { SearchStatsTable } from "@/components/shared/SearchStatsTable";
import { CubeNet } from "@/components/cube/CubeNet";
import {
  CubeState,
  MoveId,
  solvedCube,
  applyMove,
  applyMoves,
  generateScramble,
  buildCubeProblem,
  isSolved,
} from "@/lib/cube/model";
import { search, AlgorithmId, ALGORITHM_LABELS, SearchResult } from "@/lib/core/search";

const ALGOS: AlgorithmId[] = ["bfs", "ucs", "greedy", "astar"];

export default function CuboPage() {
  const [scrambleLen, setScrambleLen] = useState(4);
  const [scramble, setScramble] = useState<MoveId[]>([]);
  const [startCube, setStartCube] = useState<CubeState>(solvedCube());
  const [displayCube, setDisplayCube] = useState<CubeState>(solvedCube());
  const [algorithm, setAlgorithm] = useState<AlgorithmId>("astar");
  const [result, setResult] = useState<SearchResult<CubeState, MoveId> | null>(null);
  const [compareResults, setCompareResults] = useState<SearchResult<CubeState, MoveId>[]>([]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [maxNodes, setMaxNodes] = useState(260_000);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const doScramble = () => {
    const moves = generateScramble(scrambleLen);
    const cube = applyMoves(solvedCube(), moves);
    setScramble(moves);
    setStartCube(cube);
    setDisplayCube(cube);
    setResult(null);
    setCompareResults([]);
    setStep(0);
    setPlaying(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time init from a pure generator, not derived from external state
    doScramble();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSolve = (algo: AlgorithmId = algorithm) => {
    setBusy(true);
    setTimeout(() => {
      const problem = buildCubeProblem(startCube);
      const res = search(problem, algo, { maxNodes });
      setResult(res);
      setCompareResults([]);
      setStep(0);
      setDisplayCube(startCube);
      setBusy(false);
      setPlaying(res.found);
    }, 20);
  };

  const runComparison = () => {
    setBusy(true);
    setTimeout(() => {
      const problem = buildCubeProblem(startCube);
      const results = ALGOS.map((a) => search(problem, a, { maxNodes }));
      setCompareResults(results);
      const chosen = results.find((r) => r.algorithm === algorithm) ?? results[0];
      setResult(chosen);
      setStep(chosen.actions.length);
      setDisplayCube(chosen.found ? applyMoves(startCube, chosen.actions) : startCube);
      setBusy(false);
      setPlaying(false);
      setCompareOpen(true);
    }, 20);
  };

  useEffect(() => {
    if (!playing || !result || !result.found) return;
    if (step >= result.actions.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stopping the playback loop it owns
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => {
      setDisplayCube((c) => applyMove(c, result.actions[step]));
      setStep((s) => s + 1);
    }, 500);
    return () => clearTimeout(t);
  }, [playing, step, result]);

  const solved = isSolved(displayCube);
  const status = busy ? "CALCULANDO" : playing ? "ANIMANDO" : result ? (result.found ? "RESOLVIDO" : "SEM SOLUÇÃO") : "PRONTO";

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Left floating sidebar */}
      <aside className="glass fixed left-6 top-24 bottom-24 z-40 flex w-[290px] flex-col gap-5 overflow-y-auto rounded-3xl p-5 shadow-2xl">
        <div>
          <h1 className="text-sm font-semibold tracking-tight">Cubo Mágico 2x2</h1>
          <p className="mt-1 text-[11px] leading-relaxed text-on-surface-variant">
            Pocket Cube com 3.674.160 estados — pequeno o bastante para comparar busca cega com
            busca informada de verdade.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Configuração
          </h3>
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
            Acima de 5-6 movimentos, BFS/UCS podem levar vários segundos; A* e Gulosa permanecem
            rápidos graças à heurística.
          </p>
          <button className="btn btn-secondary" onClick={doScramble}>
            <Icon name="casino" className="text-[16px]" /> Embaralhar
          </button>
          <div className="rounded-xl bg-white/5 px-3 py-2 text-[12px]">
            <span className="text-on-surface-variant">Sequência: </span>
            <span className="font-mono text-on-surface">{scramble.join(" ") || "—"}</span>
          </div>
          <button className="btn btn-secondary" onClick={() => setAdvancedOpen(true)}>
            <Icon name="tune" className="text-[16px]" /> Parâmetros avançados
          </button>
        </div>

        <div className="mt-auto flex flex-col gap-3 border-t border-white/5 pt-4">
          <Field label="Algoritmo">
            <Select
              value={algorithm}
              onChange={(v) => setAlgorithm(v as AlgorithmId)}
              options={ALGOS.map((a) => ({ value: a, label: ALGORITHM_LABELS[a] }))}
            />
          </Field>
          <button className="btn btn-primary" onClick={() => runSolve()} disabled={busy}>
            <Icon name="play_arrow" /> {busy ? "Calculando…" : "Resolver e animar"}
          </button>
          <div className="grid grid-cols-2 gap-1.5">
            <button className="btn btn-secondary" onClick={() => setPlaying((p) => !p)} disabled={!result?.found}>
              <Icon name={playing ? "pause" : "play_arrow"} className="text-[18px]" />
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (!result?.found) return;
                setDisplayCube(applyMoves(startCube, result.actions));
                setStep(result.actions.length);
                setPlaying(false);
              }}
              disabled={!result?.found}
            >
              <Icon name="skip_next" className="text-[18px]" />
            </button>
          </div>
          <button className="btn btn-secondary" onClick={runComparison} disabled={busy}>
            <Icon name="compare_arrows" className="text-[16px]" /> Comparar algoritmos
          </button>
        </div>
      </aside>

      {/* Center visualization */}
      <div className="flex h-full w-full items-center justify-center overflow-auto py-24 pl-[338px] pr-8">
        <div className="glass flex flex-col items-center gap-6 rounded-3xl p-12 shadow-2xl">
          <CubeNet cube={displayCube} size={46} />
          <p
            className={`rounded-full px-3 py-1 text-[11px] font-medium ${
              solved ? "bg-primary/20 text-primary" : "bg-white/5 text-on-surface-variant"
            }`}
          >
            {solved ? "✓ Resolvido" : "Não resolvido"}
          </p>
        </div>
      </div>

      {/* Small floating stats panel (bottom-right) */}
      {result && (
        <aside className="glass fixed bottom-24 right-6 z-40 flex flex-col gap-3 rounded-2xl p-4 shadow-2xl">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Status", result.found ? "OK" : result.truncated ? "limite" : "falhou"],
              ["Movimentos", result.found ? String(result.actions.length) : "—"],
              ["Expandidos", result.nodesExpanded.toLocaleString("pt-BR")],
              ["Tempo", `${result.timeMs.toFixed(1)}ms`],
              ["Algoritmo", ALGORITHM_LABELS[result.algorithm].split(" ")[0]],
            ].map(([label, value]) => (
              <div key={label} className="flex min-w-[80px] flex-col items-center justify-center rounded-xl bg-white/5 px-4 py-2">
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant/70">{label}</div>
                <div className="truncate font-mono text-[14px] font-medium text-on-surface">{value}</div>
              </div>
            ))}
          </div>
          {result.found && (
            <div className="rounded-xl bg-white/5 px-3 py-2 text-[12px]">
              <span className="text-on-surface-variant">Solução: </span>
              <span className="font-mono text-on-surface">{result.actions.join(" ")}</span>
            </div>
          )}
        </aside>
      )}

      {/* Floating status pill */}
      <footer className="glass-strong fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-6 rounded-full px-6 py-2 text-[11px] font-medium shadow-xl">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${busy || playing ? "animate-pulse" : ""}`}
            style={{ background: "var(--tertiary)", boxShadow: "0 0 8px rgba(255,183,123,0.6)" }}
          />
          <span className="tracking-wide text-on-surface-variant/80">{status}</span>
        </div>
        <div className="flex items-center gap-2 border-l border-white/10 pl-4">
          <span className="uppercase text-on-surface-variant/60">Algoritmo:</span>
          <span className="font-mono text-primary/90">{ALGORITHM_LABELS[algorithm]}</span>
        </div>
        <div className="flex items-center gap-2 border-l border-white/10 pl-4">
          <span className="uppercase text-on-surface-variant/60">Embaralhamento:</span>
          <span className="font-mono text-on-surface/90">{scrambleLen} movimentos</span>
        </div>
      </footer>

      <Modal
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        title="Parâmetros avançados"
        subtitle="Heurística e limites de busca"
      >
        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Heurística (Gulosa / A*)
          </h4>
          <p className="text-[12px] leading-relaxed text-on-surface-variant">
            <span className="font-mono text-tertiary">⌈peças fora do lugar / 4⌉</span> — admissível
            pois cada movimento afeta no máximo 4 peças, então nunca superestima a distância real
            até o estado resolvido.
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
