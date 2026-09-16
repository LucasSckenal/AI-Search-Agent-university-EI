import { BoardConfig, Difficulty, DIFFICULTY_CONFIG, Instance, centerIndex, floodReveal, makeShell, placeMines } from "@/lib/campo-minado/model";
import { seededRng } from "@/lib/core/rng";

function emptyArray(n: number): boolean[] {
  return new Array(n).fill(false);
}

export interface CmPreset {
  id: string;
  label: string;
  difficulty: Difficulty;
  seed: number;
}

/**
 * Each seed was found by sweeping real logicaSteps()/probabilidadeSteps() runs, filtering for
 * boards where pure logic genuinely stalls ("stuck") - never picked by eye. The three form a
 * deliberate arc through what a stall can actually mean once probability takes over:
 * - iniciante: the "stuck" cell turns out to have an exact 0% mine chance - logic's local rules
 *   just can't see the global mine count the way exact enumeration can.
 * - intermediário: a real, non-trivial calculated risk (~17%) that pays off.
 * - avançado: an equally real, equally well-calculated risk (~20%) that does NOT pay off - the
 *   honest reminder that the best possible decision under uncertainty can still go wrong.
 */
export const CM_PRESETS: CmPreset[] = [
  { id: "iniciante", label: "Iniciante (9×9)", difficulty: "iniciante", seed: 10 },
  { id: "intermediario", label: "Intermediário (16×16)", difficulty: "intermediario", seed: 7 },
  { id: "avancado", label: "Avançado (30×16)", difficulty: "avancado", seed: 1 },
];

export interface CmOpening {
  instance: Instance;
  board: BoardConfig;
  revealed: boolean[];
  flagged: boolean[];
}

/** Same deterministic opening the live /campo-minado page's AI modes use: mines placed around a
 *  fixed seed, then the center cell flood-revealed - so logica/probabilidade always start from an
 *  identical, reproducible position for a given preset. */
export function openingFor(preset: Pick<CmPreset, "difficulty" | "seed">): CmOpening {
  const board = DIFFICULTY_CONFIG[preset.difficulty];
  const n = board.width * board.height;
  const instance = placeMines(makeShell(board), centerIndex(board), seededRng(preset.seed));
  const { revealed } = floodReveal(instance, emptyArray(n), emptyArray(n), centerIndex(board));
  return { instance, board, revealed, flagged: emptyArray(n) };
}
