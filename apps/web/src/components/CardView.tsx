import { parseCard, SUIT_SYMBOL, RANK_LABEL } from "../../../../packages/game-core/src/engine";
import type { Card } from "../../../../packages/game-core/src/engine";

// Lá kiểu ảnh mẫu: hạng lớn ở trên, chất ngay dưới hạng, chất lớn ở dưới
// (lá hình J/Q/K có panel hình ở dưới, vẽ đơn giản mới, không sao chép tranh gốc).
export function CardView({ card, selected, onClick }: { card: Card | string; selected?: boolean; onClick?: () => void }) {
  const c = typeof card === "string" ? parseCard(card) : card;
  const red = c.suit === "H" || c.suit === "D";
  const rank = RANK_LABEL[c.rank] || c.rank;
  const sym = SUIT_SYMBOL[c.suit];
  const isFace = c.rank === 11 || c.rank === 12 || c.rank === 13;
  const faceBg = c.rank === 12 ? "linear-gradient(#fde68a,#f59e0b)" : c.rank === 13 ? "linear-gradient(#bfdbfe,#2563eb)" : "linear-gradient(#bbf7d0,#16a34a)";
  return (
    <div className={`card ${red ? "red" : ""} ${selected ? "selected" : ""}`} onClick={onClick} title={`${rank}${sym}`}>
      <div className="card-rank">{rank}</div>
      <div className="card-suit">{sym}</div>
      {isFace ? (
        <div className="card-face" style={{ background: faceBg, color: c.rank === 13 ? "#fff" : "#111" }}>
          <span>♛</span>{rank}
        </div>
      ) : (
        <div className="card-big">{sym}</div>
      )}
    </div>
  );
}
