import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { SUIT_SYMBOL, RANK_LABEL, SUIT_NAME } from "../../../../packages/game-core/src/engine";
import type { Card, GameState } from "../../../../packages/game-core/src/engine";
import { HUMAN_ID } from "../store";

function drawCard(container: PIXI.Container, x: number, y: number, card: Card | null, back = false) {
  const g = new PIXI.Graphics();
  g.rect(x, y, 64, 88);
  g.fill(back ? 0x7c2d12 : 0xffffff);
  g.stroke({ color: 0x111111, width: 2 });
  container.addChild(g);
  if (!back && card) {
    const red = card.suit === "H" || card.suit === "D";
    const t = new PIXI.Text({ text: `${RANK_LABEL[card.rank] || card.rank}\n${SUIT_SYMBOL[card.suit]}`, style: { fontSize: 20, fill: red ? 0xdc2626 : 0x111111, fontWeight: "bold" } });
    t.x = x + 8; t.y = y + 8; container.addChild(t);
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
