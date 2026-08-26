/**
 * Single source of truth for site navigation, shared by Sidebar, MobileDock and CommandPalette so
 * the three menus never drift out of sync with each other or with which routes actually exist.
 *
 * Grouped by algorithm TYPE rather than by page (the user's own idea): the sidebar/mobile menu show
 * a short list of algorithm categories, and picking one opens a modal listing every page that
 * demonstrates that category. Most pages compare more than one algorithm family (2048 alone uses a
 * greedy heuristic, a Genetic Algorithm AND Expectimax), so a page legitimately appears in more than
 * one category's modal rather than being forced into a single "primary" bucket - that's intentional,
 * not duplication to clean up.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export interface NavCategory {
  title: string;
  icon: string;
  items: NavItem[];
}

export const NAV_HOME: NavItem[] = [
  { href: "/", label: "Início", icon: "home" },
  { href: "/tutorial", label: "Tutorial", icon: "school" },
];

// Canonical item objects, defined once and reused by reference across categories so every menu
// (and the flat NAV_PAGES list below) stays in sync automatically.
const LABIRINTO: NavItem = { href: "/labirinto", label: "Labirinto", icon: "route" };
const CUBO: NavItem = { href: "/cubo", label: "Cubo Mágico", icon: "grid_view" };
const JOGO_DA_VELHA: NavItem = { href: "/jogo", label: "Jogo da Velha", icon: "grid_4x4" };
const GOOSE: NavItem = { href: "/goose", label: "Goose (AG)", icon: "directions_run" };
const TSP: NavItem = { href: "/tsp", label: "Caixeiro Viajante", icon: "view_in_ar" };
const RAINHAS: NavItem = { href: "/rainhas", label: "N-Rainhas", icon: "extension" };
const RL: NavItem = { href: "/aprendizado", label: "Aprendizado por Reforço", icon: "psychology" };
const G2048: NavItem = { href: "/2048", label: "2048", icon: "sports_esports" };
const TETRIS: NavItem = { href: "/tetris", label: "Tetris", icon: "view_column_2" };
const LIG4: NavItem = { href: "/lig4", label: "Lig 4", icon: "grid_on" };
const SUDOKU: NavItem = { href: "/sudoku", label: "Sudoku", icon: "grid_3x3" };
const SNAKE: NavItem = { href: "/snake", label: "Cobrinha", icon: "polyline" };
const CAMPO_MINADO: NavItem = { href: "/campo-minado", label: "Campo Minado", icon: "flag" };
const BATALHA_NAVAL: NavItem = { href: "/batalha-naval", label: "Batalha Naval", icon: "radar" };
const MASMORRA: NavItem = { href: "/pacman", label: "Masmorra", icon: "castle" };

export const NAV_CATEGORIES: NavCategory[] = [
  {
    title: "Busca em Grafo",
    icon: "hub",
    items: [LABIRINTO, CUBO, SNAKE],
  },
  {
    title: "Busca Adversária & Multiagente",
    icon: "sports_esports",
    items: [JOGO_DA_VELHA, LIG4, G2048, MASMORRA],
  },
  {
    title: "Algoritmo Genético",
    icon: "biotech",
    items: [LABIRINTO, GOOSE, TSP, RAINHAS, G2048, TETRIS],
  },
  {
    title: "Restrições (CSP)",
    icon: "rule",
    items: [RAINHAS, SUDOKU],
  },
  {
    title: "Aprendizado por Reforço",
    icon: "psychology",
    items: [RL],
  },
  {
    title: "Heurísticas & Probabilidade",
    icon: "insights",
    items: [TSP, G2048, TETRIS, SNAKE, CAMPO_MINADO, BATALHA_NAVAL],
  },
];

/** Flat, deduplicated view for search/autocomplete (CommandPalette) - every page exactly once. */
export const NAV_PAGES: NavItem[] = (() => {
  const seen = new Set<string>();
  const flat = [...NAV_HOME, ...NAV_CATEGORIES.flatMap((c) => c.items)];
  return flat.filter((item) => (seen.has(item.href) ? false : (seen.add(item.href), true)));
})();
