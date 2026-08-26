"use client";

import { Dir, MonsterState, keyOf, Vec } from "@/lib/pacman/model";
import { CellKind, MazeState } from "@/lib/maze/model";

const MONSTER_SPRITE: Record<MonsterState["name"], string> = {
  fantasma: "/sprites/dungeon/monster-ghost.png",
  limo: "/sprites/dungeon/monster-slime.png",
  morcego: "/sprites/dungeon/monster-bat.png",
  aranha: "/sprites/dungeon/monster-spider.png",
};

function cellKindAt(maze: MazeState, r: number, c: number): CellKind {
  return maze.cells[r * maze.cols + c];
}

/**
 * Plain CSS Grid in natural row-major DOM order, same reasoning as SnakeGrid/Sudoku: recomputed from
 * scratch on every render straight off the live state. Células renderizam sprites reais (Tiny Dungeon,
 * CC0) via <img>/background-image em vez de formas desenhadas em CSS.
 */
export function PacmanGrid({
  maze,
  hero,
  monsters,
  pellets,
  potions,
  className = "",
  overlay,
  paused = false,
  uniformMonsters = false,
}: {
  maze: MazeState;
  hero: { pos: Vec; dir: Dir };
  monsters: MonsterState[];
  pellets: Set<string>;
  potions: Set<string>;
  className?: string;
  overlay?: { title: string; subtitle: string } | null;
  /** Congela a "respiração" do herói - true enquanto o modo "play" espera o primeiro toque do jogador. */
  paused?: boolean;
  /** Modo "gulosos": renderiza os 4 monstros com o MESMO sprite, deixando visualmente óbvio que são
   * perseguidores idênticos (em vez dos 4 sprites distintos do modo "especializados"). */
  uniformMonsters?: boolean;
}) {
  const rows = maze.rows;
  const cols = maze.cols;
  const monsterByCell = new Map<string, MonsterState>();
  for (const m of monsters) monsterByCell.set(keyOf(m.pos), m);
  const heroKey = keyOf(hero.pos);
  const heroFacingLeft = hero.dir === "left";

  return (
    <div
      className={`pacman-grid ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
    >
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const key = keyOf({ r, c });
          const kind = cellKindAt(maze, r, c);
          const isWallCell = kind === "wall";
          const isHero = key === heroKey;
          const monster = !isHero ? monsterByCell.get(key) : undefined;
          const hasPotion = !isHero && !monster && potions.has(key);
          const hasPellet = !isHero && !monster && !hasPotion && pellets.has(key);

          if (isWallCell) return <div key={key} className="pacman-cell pacman-cell-wall" />;

          return (
            <div key={key} className="pacman-cell pacman-cell-floor">
              {hasPellet && <span className="pacman-pellet" />}
              {hasPotion && <img src="/sprites/dungeon/potion.png" alt="" className="pacman-potion" draggable={false} />}
              {monster && (
                <img
                  src={MONSTER_SPRITE[uniformMonsters ? "fantasma" : monster.name]}
                  alt=""
                  draggable={false}
                  className={`pacman-monster ${monster.mode === "frightened" ? "pacman-monster-frightened" : monster.mode === "eaten" ? "pacman-monster-eaten" : ""}`}
                  style={{ "--flip": monster.dir === "left" ? -1 : 1 } as React.CSSProperties}
                />
              )}
              {isHero && (
                <img
                  src="/sprites/dungeon/hero.png"
                  alt=""
                  draggable={false}
                  className={`pacman-hero ${paused ? "pacman-hero-paused" : ""}`}
                  style={{ "--flip": heroFacingLeft ? -1 : 1 } as React.CSSProperties}
                />
              )}
            </div>
          );
        }),
      )}
      {overlay && (
        <div className="board-overlay">
          <span className="board-overlay-title">{overlay.title}</span>
          <span className="board-overlay-subtitle">{overlay.subtitle}</span>
        </div>
      )}
    </div>
  );
}
