"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

/**
 * Scroll-snap container for the tutorial's screens, plus the reveal-on-scroll machinery: each
 * <TutorialScreen> fades/slides in the first time it crosses 50% into view (tracked by index, not
 * re-triggered on scroll-back-up), and the side progress dots track whichever screen is currently
 * centered. Kept as a single client island - unlike the home page, nearly every element on this
 * page needs the same scroll observation, so splitting into many small islands wouldn't help.
 */
export function TutorialScroller({ children }: { children: ReactNode[] }) {
  const count = children.length;
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>(() => Array(count).fill(false));
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time reduced-motion bypass
      setRevealed(Array(count).fill(true));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = sectionRefs.current.indexOf(entry.target as HTMLElement);
          if (idx === -1) return;
          setRevealed((prev) => (prev[idx] ? prev : prev.map((v, i) => (i === idx ? true : v))));
          setActive(idx);
        });
      },
      { threshold: 0.5 }
    );
    sectionRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [count]);

  return (
    <div className="tut-scroller">
      <div className="tut-progress">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={`tut-dot ${i === active ? "active" : ""}`} />
        ))}
      </div>
      {children.map((child, i) => (
        <section
          key={i}
          ref={(el) => {
            sectionRefs.current[i] = el;
          }}
          className="tut-screen"
          data-revealed={revealed[i]}
        >
          {child}
        </section>
      ))}
    </div>
  );
}

/** A reveal-tracked block within a screen - opacity/translate driven by the parent section's
 *  `data-revealed` attribute (see CSS), staggered via the `delay` prop. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: 0 | 1 | 2 | 3; className?: string }) {
  return <div className={`tut-reveal tut-d${delay} ${className}`}>{children}</div>;
}
