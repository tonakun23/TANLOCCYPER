import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { SUIT_SYMBOL, RANK_LABEL, SUIT_NAME } from "../../../../packages/game-core/src/engine";
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
  const table = new PIXI.Graphics();
  table.ellipse(430, 180, 390, 150);
  table.fill(0x2e7d32);
  table.stroke({ color: 0xfacc15, width: 4 });
  app.stage.addChild(table);
  const info = new PIXI.Text({ text: `Chủ: ${SUIT_NAME[game.trumpSuit]} ${SUIT_SYMBOL[game.trumpSuit]}  •  Nọc: ${game.drawPile.length} lá  •  Bỏ: ${game.discardPile.length}`, style: { fontSize: 18, fill: 0xfde68a } });
  info.x = 180; info.y = 20; app.stage.addChild(info);
  // Đối thủ: mặt sau bài ở phía trên
  const opps = game.players.filter((p) => p.id !== HUMAN_ID);
  opps.forEach((p, i) => {
    const baseX = 120 + i * 220;
    const name = new PIXI.Text({ text: `${p.name} (${p.hand.length} lá)`, style: { fontSize: 16, fill: 0xffffff } });
    name.x = baseX; name.y = 50; app.stage.addChild(name);
    p.hand.slice(0, 5).forEach((_, j) => drawCard(app.stage, baseX + j * 18, 75, null, true, textures));
  });
  // Bài trên bàn ở giữa
  if (!game.table.length) {
    const empty = new PIXI.Text({ text: "Chưa có bài trên bàn", style: { fontSize: 18, fill: 0xfecaca } });
    empty.x = 330; empty.y = 170; app.stage.addChild(empty);
  } else {
    const totalW = game.table.length * 90;
    game.table.forEach((pair, i) => {
      const x = 430 - totalW / 2 + i * 90;
      drawCard(app.stage, x, 150, pair.attack, false, textures);
      if (pair.defense) drawCard(app.stage, x + 20, 168, pair.defense, false, textures);
      else {
        const wait = new PIXI.Text({ text: "chờ đỡ…", style: { fontSize: 14, fill: 0xfde68a } });
        wait.x = x + 20; wait.y = 168; app.stage.addChild(wait);
      }
    });
  }
}

export function TableCanvas({ game }: { game: GameState }) {
  const ref = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const texturesRef = useRef<Map<string, PIXI.Texture> | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    let app: PIXI.Application | null = null;
    (async () => {
      app = new PIXI.Application();
      await app.init({ width: 860, height: 360, background: "#1b3a1b", antialias: true });
      if (cancelled) { app.destroy(true); return; }
      appRef.current = app;
      ref.current?.appendChild(app.canvas);
      const textures = await loadTextures();
      if (cancelled) return;
      texturesRef.current = textures;
      drawTable(app, game, textures);
    })();
    return () => { cancelled = true; app?.destroy(true); appRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (appRef.current) drawTable(appRef.current, game, texturesRef.current); }, [game]);
  return <div ref={ref} className="flex justify-center overflow-x-auto" />;
}
