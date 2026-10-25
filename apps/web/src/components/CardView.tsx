import { parseCard, SUIT_SYMBOL, RANK_LABEL } from "../../../../packages/game-core/src/engine";
import type { Card } from "../../../../packages/game-core/src/engine";
export function CardView({ card, selected, onClick }: { card: Card | string; selected?: boolean; onClick?: () => void }) {
  const c = typeof card === "string" ? parseCard(card) : card;
  const red = c.suit === "H" || c.suit === "D";
  return (
    <div className={`card ${red ? "red" : ""} ${selected ? "selected" : ""}`} onClick={onClick}>
      <div>{RANK_LABEL[c.rank] || c.rank}</div>
      <div style={{ fontSize: 28 }}>{SUIT_SYMBOL[c.suit]}</div>
    </div>
  );
}
