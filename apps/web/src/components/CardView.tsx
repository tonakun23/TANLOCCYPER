import { parseCard, SUIT_SYMBOL, RANK_LABEL } from "../../../../packages/game-core/src/engine";
import type { Card } from "../../../../packages/game-core/src/engine";

// La bai tu repo yan-braslavsky/Card-Game-Durak (game Durak Android).
// Durak goc chi co 36 la (6-A); 2-5 duoc ve lai tu mau la 6 cung chat (doi hang o goc,
// giu nguyen khung, chat giua, mat sau) de du bo 52 la cho Tan VN-8.
// Ten file: <hang><chat>.png, S=Bich, C=Chuon, H=Co, D=Ro, hang A,2-10,J,Q,K.
// Luu y: repo Durak khong co file LICENSE rieng, nen chi ro nguon goc o README.
function fileName(rank: number, suit: string): string {
  const r = rank === 14 ? "A" : rank === 11 ? "J" : rank === 12 ? "Q" : rank === 13 ? "K" : String(rank);
  return `${r}${suit}.png`;
}

export function CardView({ card, selected, highlight, onClick }: { card: Card | string; selected?: boolean; highlight?: boolean; onClick?: () => void }) {
  const c = typeof card === "string" ? parseCard(card) : card;
  const rank = RANK_LABEL[c.rank] || c.rank;
  const sym = SUIT_SYMBOL[c.suit];
  const file = fileName(c.rank, c.suit);
  return (
    <div className={`card card-img ${selected ? "selected" : ""} ${highlight ? "addable" : ""}`} onClick={onClick} title={`${rank}${sym}`}>
      <img src={`/durak/cards/${file}`} alt={`${rank}${sym}`} draggable={false} />
    </div>
  );
}
