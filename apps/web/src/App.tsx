import { useEffect, useState } from "react";
import { useGameStore, HUMAN_ID } from "./store";
import { CardView } from "./components/CardView";
import { TableCanvas } from "./components/TableCanvas";
import { parseCard, SUIT_NAME, SUIT_SYMBOL } from "../../../packages/game-core/src/engine";

export default function App() {
  const s = useGameStore();
  const [seconds, setSeconds] = useState(30);
  const game = s.game;
  const me = game?.players.find((p) => p.id === HUMAN_ID);
  const iAmDefender = game?.defenderId === HUMAN_ID;
  const iAmAttacker = game?.attackerId === HUMAN_ID;
  const undefended = game?.table.filter((x) => !x.defense) ?? [];
  const allDefended = !!game && game.table.length > 0 && game.table.every((x) => x.defense);
  const myTurn = !!game && game.phase !== "FINISHED" && ((iAmDefender && undefended.length > 0) || (iAmAttacker && game.table.length === 0));

  useEffect(() => {
    if (!myTurn) { setSeconds(30); return; }
    const id = setInterval(() => setSeconds((v) => {
      if (v <= 1) {
        if (game && iAmDefender) s.takeCards();
        else if (game && me) s.autoLowestAttack();
        return 30;
      }
      return v - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [myTurn, game, iAmDefender, me, s]);

  if (s.screen === "lobby" || !game) {
    return (
      <div className="min-h-screen bg-[#2a0505] text-white p-6">
        <header className="mb-6"><h1 className="text-3xl font-bold">♠ TẤN ONLINE <span className="text-yellow-400 text-base">· TANLOCCYPER</span></h1>
        <p className="text-red-200">React + TypeScript + Vite + Tailwind + PixiJS + Zustand + PWA · Luật VN-8 · 2–4 người · Xu chỉ là điểm thưởng, không tiền thật</p></header>
        <section className="max-w-xl mx-auto bg-red-900 border border-yellow-400 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold">Bắt đầu ván mới (chơi với bot)</h2>
          <label className="block">Tên của bạn <input className="text-black ml-2 px-3 py-2 rounded" value={s.playerName} onChange={(e) => s.setPlayerName(e.target.value)} /></label>
          <label className="block">Số người chơi
            <select className="text-black ml-2 px-3 py-2 rounded" value={s.playerCount} onChange={(e) => s.setPlayerCount(Number(e.target.value))}>
              <option value={2}>2 người</option><option value={3}>3 người</option><option value={4}>4 người</option>
            </select>
          </label>
          <label className="block"><input type="checkbox" checked={s.allowTransfer} onChange={(e) => s.setAllowTransfer(e.target.checked)} /> Cho phép chuyển tấn</label>
          <button className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-full" onClick={s.startGame}>Chơi ngay</button>
          <p className="text-red-200 text-sm">Bản React này chơi offline với bot để kiểm luật. Phòng online realtime (Colyseus) là sprint tiếp theo.</p>
        </section>
      </div>
    );
  }

  let hint = "Đang chờ bot đánh…";
  if (game.phase === "FINISHED") hint = game.loserId === HUMAN_ID ? "Bạn là người thua ván này." : `${game.players.find((p) => p.id === game.loserId)?.name} thua ván này.`;
  else if (iAmDefender && undefended.length) hint = "Tới lượt bạn đỡ: bấm lá bài của bạn để đỡ, hoặc bấm Nhận bài / Chuyển tấn.";
  else if (iAmAttacker && game.table.length === 0) hint = "Tới lượt bạn tấn: bấm 1 lá bài để đánh ra.";
  else if (iAmAttacker && allDefended) hint = "Bạn có thể thêm bài cùng hạng, hoặc bấm Kết thúc đợt.";
  else if (!iAmDefender && game.table.length > 0) hint = "Bạn có thể thêm bài cùng hạng, hoặc bấm Không thêm nữa.";

  return (
    <div className="min-h-screen bg-[#2a0505] text-white p-4">
      <div className="flex flex-wrap gap-4 bg-red-950 px-4 py-3 font-semibold rounded">
        <span>{game.phase === "FINISHED" ? "Ván đã kết thúc" : `${game.players.find((p) => p.id === game.attackerId)?.name} tấn · ${game.players.find((p) => p.id === game.defenderId)?.name} đỡ`}</span>
        {myTurn && <span>⏱ {seconds}s</span>}
        <span>Chủ: {SUIT_NAME[game.trumpSuit]} {SUIT_SYMBOL[game.trumpSuit]}</span>
        <span>Nọc: {game.drawPile.length} lá</span>
      </div>
      <TableCanvas game={game} />
      <div className="flex gap-3 justify-center my-3 flex-wrap">
        {game.players.filter((p) => p.id !== HUMAN_ID).map((p) => (
          <div key={p.id} className={`bg-black/40 px-4 py-2 rounded-xl ${p.id === game.attackerId || p.id === game.defenderId ? "outline outline-yellow-400" : ""}`}>
            {p.name} {p.id === game.attackerId ? "⚔️ tấn" : ""} {p.id === game.defenderId ? "🛡️ đỡ" : ""} {p.finished ? "✅ xong" : ""} · {p.hand.length} lá
          </div>
        ))}
      </div>
      <div className="text-center space-x-2 my-3">
        <button className="bg-white text-black font-semibold px-4 py-2 rounded-full disabled:opacity-40" disabled={!(iAmAttacker && allDefended)} onClick={s.finishAttackAction}>Kết thúc đợt</button>
        <button className="bg-white text-black font-semibold px-4 py-2 rounded-full disabled:opacity-40" disabled={!(iAmDefender && game.table.length > 0)} onClick={s.takeCards}>Nhận bài</button>
        <button className="bg-white text-black font-semibold px-4 py-2 rounded-full disabled:opacity-40" disabled={!(iAmDefender && s.selected && game.table.length > 0 && !game.table.some((x) => x.defense) && game.table.some((x) => x.attack.rank === parseCard(s.selected as string).rank))} onClick={s.transferCard}>Chuyển tấn</button>
        <button className="bg-white text-black font-semibold px-4 py-2 rounded-full disabled:opacity-40" disabled={!(game.table.length > 0 && !iAmDefender)} onClick={s.passAdd}>Không thêm nữa</button>
        <button className="bg-yellow-400 text-black font-semibold px-4 py-2 rounded-full" onClick={s.backToLobby}>Ván mới</button>
      </div>
      <div className="flex gap-2 justify-center flex-wrap min-h-[120px] p-4">
        {me?.hand.map((c) => <CardView key={c.id} card={c} selected={s.selected === c.id} onClick={() => s.playCard(c.id)} />)}
      </div>
      <p className="text-center text-yellow-200">{hint}</p>
      <div className="max-w-3xl mx-auto bg-black/40 p-3 rounded-xl max-h-40 overflow-auto text-sm my-4">
        {s.log.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      {game.phase === "FINISHED" && (
        <div className="max-w-xl mx-auto bg-red-900 border border-yellow-400 rounded-2xl p-6 text-center">
          <h2 className="text-xl font-bold">Kết quả</h2>
          <p>Người thua: <b>{game.players.find((p) => p.id === game.loserId)?.name}</b></p>
          <p>Thứ tự hoàn thành: {game.finishOrder.map((id) => game.players.find((p) => p.id === id)?.name).join(" → ") || "—"}</p>
          <button className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-full mt-3" onClick={s.backToLobby}>Chơi ván mới</button>
        </div>
      )}
    </div>
  );
}
