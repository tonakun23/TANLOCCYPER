import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { SUIT_SYMBOL, RANK_LABEL, SUIT_NAME } from "../../../../packages/game-core/src/engine";
import type { Card, GameState } from "../../../../packages/game-core/src/engine";
import { HUMAN_ID } from "../store";

function drawCard(container: PIXI.Container, x: number, y: number, card: Card | null, back = false) {
  const g = new PIXI.Graphics();
  if (back) {
    // Mặt sau theo bộ standard-deck: nền xám nhạt với lưới thoi đậm, gần với back.png gốc.
    g.rect(x, y, 64, 88);
    g.fill(0xffffff);
    g.stroke({ color: 0x111111, width: 2 });
    container.addChild(g);
    const inner = new PIXI.Graphics();
    inner.rect(x + 3, y + 3, 58, 82);
    inner.fill(0xe5e5e5);
    inner.stroke({ color: 0xffffff, width: 1 });
    container.addChild(inner);
    const grid = new PIXI.Graphics();
    for (let d = -88; d <= 152; d += 8) {
      grid.moveTo(x + 3 + d, y + 3);
      grid.lineTo(x + 3 + d + 82, y + 85);
      grid.moveTo(x + 3 + d + 82, y + 3);
      grid.lineTo(x + 3 + d, y + 85);
    }
    grid.stroke({ color: 0x555555, width: 1 });
    container.addChild(grid);
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

function drawTable(app: PIXI.Application, game: GameState) {
  app.stage.removeChildren();
  const table = new PIXI.Graphics();
  table.ellipse(430, 180, 390, 150);
  table.fill(0x991b1b);
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
    p.hand.slice(0, 5).forEach((_, j) => drawCard(app.stage, baseX + j * 18, 75, null, true));
  });
  // Bài trên bàn ở giữa
  if (!game.table.length) {
    const empty = new PIXI.Text({ text: "Chưa có bài trên bàn", style: { fontSize: 18, fill: 0xfecaca } });
    empty.x = 330; empty.y = 170; app.stage.addChild(empty);
  } else {
    const totalW = game.table.length * 90;
    game.table.forEach((pair, i) => {
      const x = 430 - totalW / 2 + i * 90;
      drawCard(app.stage, x, 150, pair.attack);
      if (pair.defense) drawCard(app.stage, x + 20, 168, pair.defense);
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
  useEffect(() => {
    let cancelled = false;
    let app: PIXI.Application | null = null;
    (async () => {
      app = new PIXI.Application();
      await app.init({ width: 860, height: 360, background: "#450a0a", antialias: true });
      if (cancelled) { app.destroy(true); return; }
      appRef.current = app;
      ref.current?.appendChild(app.canvas);
      drawTable(app, game);
    })();
    return () => { cancelled = true; app?.destroy(true); appRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (appRef.current) drawTable(appRef.current, game); }, [game]);
  return <div ref={ref} className="flex justify-center overflow-x-auto" />;
}
