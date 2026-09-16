"use client";

/** Side panel: "Passo N · [ação]" followed by the why-text from lib/tutorial/explain.ts. Purely a
 *  presentational shell - callers pass already-computed text, nothing is invented here. */
export function StepNarration({
  step,
  total,
  title,
  reason,
}: {
  step: number;
  total: number;
  title: string;
  reason: string;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="lab-narration-step">
        Passo {step} / {total}
      </div>
      <div className="lab-narration-title">{title}</div>
      <p className="lab-narration-reason">{reason}</p>
    </div>
  );
}
