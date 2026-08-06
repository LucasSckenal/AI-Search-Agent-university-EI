"use client";

import { useEffect, useState } from "react";

const ALGOS = ["A*", "BFS", "DFS", "UCS", "Gulosa", "Minimax"];

/** Cycles through algorithm names in the hero's status readout, a small "system is alive" touch.
 *  Isolated as its own client island so the rest of the home page stays server-rendered. */
export function HeroTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % ALGOS.length), 1400);
    return () => clearInterval(id);
  }, []);

  return <span className="inline-block min-w-[6ch] text-on-surface">{ALGOS[index]}</span>;
}
