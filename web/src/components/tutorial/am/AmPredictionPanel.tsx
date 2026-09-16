"use client";

import { Icon } from "@/components/shared/Panel";
import { MiniBoard } from "@/components/tutorial/am/MiniBoard";
import { Board, MinimaxResult, Player } from "@/lib/game/model";
import { explainPredictionChoice, playerLabel } from "@/lib/tutorial/am-explain";

/** `best` is a real minimax() result on this exact position - computed once by the page and passed
 *  down, never invented here. Before reveal only the board is shown; after reveal, the real best
 *  move is ringed green and the user's guess (if wrong) is ringed red. */
export function AmPredictionPanel({
  board,
  player,
  best,
  selectedMove,
  onSelect,
  revealed,
}: {
  board: Board;
  player: Player;
  best: MinimaxResult;
  selectedMove: number | null;
  onSelect: (move: number) => void;
  revealed: boolean;
}) {
  const feedback = revealed && selectedMove !== null ? explainPredictionChoice(selectedMove, best) : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-on-surface-variant">É a vez de {playerLabel(player)}. Clique na casa onde você acha que a melhor jogada está:</p>
      <MiniBoard
        board={board}
        cellPx={48}
        onCellClick={revealed ? undefined : onSelect}
        selected={!revealed ? selectedMove : null}
        correct={revealed ? best.move : null}
        wrong={revealed && selectedMove !== best.move ? selectedMove : null}
      />
      {revealed && feedback && (
        <div className="glass rounded-2xl p-4 text-[13px] leading-relaxed text-on-surface">
          {feedback.correct && <Icon name="check_circle" className="mr-1.5 align-middle text-[14px] text-primary" />}
          {feedback.message}
        </div>
      )}
    </div>
  );
}
