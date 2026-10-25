import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { SUIT_SYMBOL, RANK_LABEL } from "../../../../packages/game-core/src/engine";
import type { Card, GameState } from "../../../../packages/game-core/src/engine";
import { HUMAN_ID } from "../store";

// Ban Durak: nen xanh la, ban oval xanh dam, bai dung anh that tu /durak/cards/.
// La 2-5 la ban ve lai tu mau la 6 (xem CardView.tsx).
function cardFile(card: Card): string {
  const r = card.rank === 14 ? "A" : card.rank === 11 ? "J" : card.rank === 12 ? "Q" : card.rank === 13 ? "K" : String(card.rank);
  return `${r}${card.suit}.png`;
}

let textureCache: Map<string, PIXI.Texture> | null = null;
async function loadTextures() {
  if (textureCache) return textureCache;
  const map = new Map<string, PIXI.Texture>();
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const suits = ["S", "C", "H", "D"];
  const files = ["back.png", ...suits.flatMap((s) => ranks.map((r) => `${r}${s}.png`))];
  await Promise.all(files.map(async (f) => {
    try {
      const tex = await PIXI.Assets.load(`/durak/cards/${f}`);
      map.set(f, tex);
    } catch {
      // fallback: ve text
    }
  }));
  textureCache = map;
  return map;
}

function drawCard(container: PIXI.Container, x: number, y: number, card: Card | null, back = false, textures?: Map<string, PIXI.Texture>) {
  const file = back ? "back.png" : card ? cardFile(card) : "back.png";
  const tex = textures?.get(file);
  if (tex) {
    const sp = new PIXI.Sprite(tex);
    sp.x = x; sp.y = y; sp.width = 64; sp.height = 88;
    container.addChild(sp);
    return;
  }
  // Fallback text neu anh chua load duoc
  const g = new PIXI.Graphics();
  if (back) {
    g.rect(x, y, 64, 88);
    g.fill(0x8b0000);
    g.stroke({ color: 0xfacc15, width: 2 });
    container.addChild(g);
    return;
  }
  g.rect(x, y, 64, 88);
  g.fill(0xffffff);
  g.stroke({ color: 0x111111, width: 2 });
  container.addChild(g);
  if (card) {
    const red = card.suit === "H" || card.suit === "D";
    const color = red ? 0xdc2626 : 0x111111;
    const t = new PIXI.Text({ text: `${RANK_LABEL[card.rank] || card.rank}\n${SUIT_SYMBOL[card.suit]}`, style: { fontSize: 20, fill: color, fontWeight: "bold" } });
    t.x = x + 8; t.y = y + 8; container.addChild(t);
    const big = new PIXI.Text({ text: SUIT_SYMBOL[card.suit], style: { fontSize: 36, fill: color } });
    big.x = x + 16; big.y = y + 48; container.addChild(big);
  }
}

function drawTable(app: PIXI.Application, game: GameState, textures?: Map<string, PIXI.Texture>) {
  app.stage.removeChildren();
  const w = app.screen.width, h = app.screen.height;
  // Responsive full màn hình: bàn tự giãn theo khung chứa, không còn khung cố định.
  // Tâm bàn lệch xuống 20px, bán kính dọc = h/2 - 100, nên viền trên cách đầu bàn 120px
  // (không đè bot trên) và viền dưới nằm đúng giữa lá bài tay mình (tay ở cuối màn hình, giữa tay cách đáy 80px).
  const cx = w / 2, cy = h / 2 + 20;
  const rx = Math.min(620, w * 0.49), ry = Math.max(60, h / 2 - 100);
  // Bàn hình chữ nhật bo tròn 2 đầu (capsule): cạnh trên/dưới thẳng,
  // 2 đầu là nửa hình tròn, không còn oval tròn như trước.
  const table = new PIXI.Graphics();
  table.roundRect(cx - rx, cy - ry, rx * 2, ry * 2, ry);
  table.fill(0x2e7d32);
  table.stroke({ color: 0xfacc15, width: 4 });
  app.stage.addChild(table);
  // Đã bỏ dòng chữ ở đầu bàn (Chủ / Bỏ) vì nó che tầm nhìn chỗ bot trên cùng.
  // Chất chủ vẫn nhận biết được qua lá chủ lật ngửa dưới nọc + dòng Chủ ở header trên cùng.
  // Đối thủ KHÔNG vẽ ở đây nữa: App vẽ dải avatar + bài úp cho từng người,
  // để avatar nằm trái, thẳng hàng với đúng bộ bài của người đó + số lá.
  void w; void textures;
  // Nọc ở góc trên trái trong bàn (không còn ở giữa trái, tránh bị bài bot trái đè lên).
  const pileX = cx - rx + 16, pileY = cy - ry + 16;
  if (game.drawPile.length > 0) {
    const trump = game.drawPile.find((c) => c.id === game.trumpCardId) || game.drawPile[game.drawPile.length - 1];
    drawCard(app.stage, pileX, pileY, trump, false, textures);
    const backs = Math.min(3, game.drawPile.length - 1);
    for (let j = 0; j < backs; j++) drawCard(app.stage, pileX + 6 + j * 3, pileY - 4 - j * 2, null, true, textures);
    const count = new PIXI.Text({ text: `Nọc: ${game.drawPile.length} lá`, style: { fontSize: 16, fill: 0xfde68a, fontWeight: "bold" } });
    count.x = pileX - 4; count.y = pileY + 94; app.stage.addChild(count);
    // Đã bỏ chữ "Chủ:" dưới nọc: lá chủ lật ngửa dưới chồng bài đã nói rõ chất chủ.
  } else {
    const emptyPile = new PIXI.Text({ text: "Hết nọc", style: { fontSize: 16, fill: 0xfecaca } });
    emptyPile.x = pileX; emptyPile.y = cy; app.stage.addChild(emptyPile);
  }
  // Bài trên bàn ở giữa
  if (!game.table.length) {
    const empty = new PIXI.Text({ text: "Chưa có bài trên bàn", style: { fontSize: 18, fill: 0xfecaca } });
    empty.x = cx - empty.width / 2; empty.y = cy - 10; app.stage.addChild(empty);
  } else {
    const totalW = game.table.length * 90;
    game.table.forEach((pair, i) => {
      const x = cx + 50 - totalW / 2 + i * 90;
      drawCard(app.stage, x, cy - 30, pair.attack, false, textures);
      if (pair.defense) drawCard(app.stage, x + 20, cy - 12, pair.defense, false, textures);
      else {
        const wait = new PIXI.Text({ text: "chờ đỡ…", style: { fontSize: 14, fill: 0xfde68a } });
        wait.x = x + 20; wait.y = cy - 12; app.stage.addChild(wait);
      }
    });
  }
}

export function TableCanvas({ game }: { game: GameState }) {
  const ref = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const texturesRef = useRef<Map<string, PIXI.Texture> | undefined>(undefined);
  const gameRef = useRef(game);
  gameRef.current = game;
  useEffect(() => {
    let cancelled = false;
    let app: PIXI.Application | null = null;
    let observer: ResizeObserver | null = null;
    (async () => {
      const el = ref.current; if (!el) return;
      app = new PIXI.Application();
      await app.init({ width: Math.max(320, el.clientWidth), height: Math.max(240, el.clientHeight), background: "#1b3a1b", antialias: true });
      if (cancelled) { app.destroy(true); return; }
      appRef.current = app;
      el.appendChild(app.canvas);
      const textures = await loadTextures();
      if (cancelled) return;
      texturesRef.current = textures;
      drawTable(app, gameRef.current, textures);
      // Bàn full màn: canvas co giãn theo khung chứa, vẽ lại khi đổi kích thước.
      observer = new ResizeObserver(() => {
        if (!app || !el) return;
        app.renderer.resize(Math.max(320, el.clientWidth), Math.max(240, el.clientHeight));
        drawTable(app, gameRef.current, texturesRef.current);
      });
      observer.observe(el);
    })();
    return () => { cancelled = true; observer?.disconnect(); app?.destroy(true); appRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (appRef.current) drawTable(appRef.current, game, texturesRef.current); }, [game]);
  return <div ref={ref} className="flex-1 min-h-0 w-full [&>canvas]:block [&>canvas]:w-full [&>canvas]:h-full" />;
}
