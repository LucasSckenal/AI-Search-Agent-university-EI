"use client";

import { CSSProperties } from "react";
import { GOAL_REWARD, PIT_REWARD, SPIKE_REWARD, STEP_REWARD } from "@/lib/rl/model";

/** The building blocks of Q-learning - same `.lab-formula-piece` visual language as the other three
 *  labs' breakdowns. Reward values are imported directly from lib/rl/model.ts's own constants, never
 *  retyped, so they can never drift from what the real simulation actually pays out. */
export function RlBreakdown() {
  return (
    <div className="flex flex-col gap-4">
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#afc6ff" } as CSSProperties}>
          <span className="lab-formula-piece-label">Estado</span>
          <span className="lab-formula-piece-value">posição (linha, coluna)</span>
        </div>
        <p className="lab-formula-explain">Onde o agente está na grade agora - é só isso que ele observa, nunca o mapa inteiro.</p>
      </div>
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#7ee0a8" } as CSSProperties}>
          <span className="lab-formula-piece-label">Ação</span>
          <span className="lab-formula-piece-value">N / S / L / O</span>
        </div>
        <p className="lab-formula-explain">Uma de quatro direções. Paredes e a borda da grade simplesmente devolvem o agente à mesma célula.</p>
      </div>
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#ffb77b" } as CSSProperties}>
          <span className="lab-formula-piece-label">Recompensa</span>
          <span className="lab-formula-piece-value">
            {STEP_REWARD} por passo · {GOAL_REWARD} no objetivo · {PIT_REWARD} num buraco · {SPIKE_REWARD} num espinho
          </span>
        </div>
        <p className="lab-formula-explain">
          Cada passo custa um pouco (incentivo a caminhos curtos); o objetivo paga bem; um buraco é fatal e termina o episódio; um espinho machuca mas
          o agente continua andando.
        </p>
      </div>
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#ff9b9b" } as CSSProperties}>
          <span className="lab-formula-piece-label">Atualização Q</span>
          <span className="lab-formula-piece-value">Q(s,a) += α·(r + γ·max Q(s&apos;,·) − Q(s,a))</span>
        </div>
        <p className="lab-formula-explain">
          Depois de cada ação, o valor estimado de tê-la tomado é ajustado na direção do erro entre o que o agente esperava (Q(s,a)) e o que realmente
          aconteceu (a recompensa r mais o melhor valor estimado do próximo estado, descontado por γ). α controla o tamanho do ajuste.
        </p>
      </div>
      <div className="lab-formula">
        <div className="lab-formula-piece active" style={{ "--accent": "#cebdff" } as CSSProperties}>
          <span className="lab-formula-piece-label">Política ε-greedy</span>
          <span className="lab-formula-piece-value">aleatória com prob. ε, gulosa com prob. 1−ε</span>
        </div>
        <p className="lab-formula-explain">
          ε decai ao longo do treino: no início o agente explora bastante (ações aleatórias, para descobrir o mapa); no fim ele majoritariamente segue
          a melhor ação que já conhece. Diferente da Iteração de Valor, que nunca precisa &ldquo;explorar&rdquo; - ela já conhece o mapa inteiro de
          antemão e calcula a política ótima diretamente.
        </p>
      </div>
    </div>
  );
}
