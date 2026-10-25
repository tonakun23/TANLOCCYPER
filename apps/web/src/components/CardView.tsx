import { parseCard, SUIT_SYMBOL, RANK_LABEL } from "../../../../packages/game-core/src/engine";
import type { Card } from "../../../../packages/game-core/src/engine";

// La bai tu repo deck-of-cards/standard-deck, cat tu sprite 4400x2800 thanh la rieng.
// Ten file: <hang><chat>.png, S=Bich, C=Chuon, H=Co, D=Ro, hang A,2-10,J,Q,K.
// Luu y giay phep goc: suit icons tu Font Awesome Pro, la hinh sua tu Wikimedia Commons.
function fileName(rank: number, suit: string): string {
  const r = rank === 14 ? "A" : rank === 11 ? "J" : rank === 12 ? "Q" : rank === 13 ? "K" : String(rank);
  return `${r}${suit}.png`;
}

export function CardView({ card, selected, onClick }: { card: Card | string; selected?: boolean; onClick?: () => void }) {
  const c = typeof card === "string" ? parseCard(card) : card;
  const rank = RANK_LABEL[c.rank] || c.rank;
  const sym = SUIT_SYMBOL[c.suit];
  const file = fileName(c.rank, c.suit);
  return (
    <div className={`card card-img ${selected ? "selected" : ""}`} onClick={onClick} title={`${rank}${sym}`}>
      <img src={`/cards-standard/${file}`} alt={`${rank}${sym}`} draggable={false} />
    </div>
  );
}
