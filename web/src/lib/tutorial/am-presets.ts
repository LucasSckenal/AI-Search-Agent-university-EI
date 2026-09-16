import { Board, GameConfig, Player } from "@/lib/game/model";

export interface AmPreset {
  id: string;
  label: string;
  board: Board;
  player: Player;
}

export const AM_GAME_CONFIG: GameConfig = { size: 3, winLength: 3, maxDepth: 9 };

// Reused verbatim from app/minimax/page.tsx's hand-verified presets (neither already won/drawn -
// checked by hand there) - small enough that the full unheuristicized tree stays legible node by
// node in the 3D reveal (a few hundred nodes at most).
export const AM_PRESETS: AmPreset[] = [
  { id: "quase-decidida", label: "Quase decidida (3 casas vazias)", board: [1, -1, 1, -1, 1, -1, 0, 0, 0], player: 1 },
  { id: "meio-de-jogo", label: "Meio de jogo (5 casas vazias)", board: [1, -1, 0, 0, 1, 0, 0, 0, -1], player: 1 },
];

// Bigger positions, used only where the tree is summarized through minimax()'s aggregate counters
// (nodesExplored/prunedBranches), never animated node by node - a 7- or 9-empty-cell tree can reach
// hundreds of thousands of nodes, far too many to reveal legibly one at a time, but perfectly cheap
// to run synchronously to completion for a final count.
export const AM_CHALLENGE_PRESETS: AmPreset[] = [
  ...AM_PRESETS,
  { id: "abertura", label: "Abertura (7 casas vazias)", board: [-1, 0, 0, 0, 1, 0, 0, 0, 0], player: 1 },
  { id: "tabuleiro-vazio", label: "Tabuleiro vazio (9 casas vazias)", board: [0, 0, 0, 0, 0, 0, 0, 0, 0], player: 1 },
];
