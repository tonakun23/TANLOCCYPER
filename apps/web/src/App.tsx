import { useEffect, useState } from "react";
import { useGameStore, HUMAN_ID } from "./store";
import { CardView } from "./components/CardView";
import { TableCanvas } from "./components/TableCanvas";
import { parseCard, SUIT_NAME, SUIT_SYMBOL } from "../../../packages/game-core/src/engine";

export default function App() {
  const s = useGameStore();
  const [seconds, setSeconds] = useState(30);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  // Toast thông báo: hiện ~3 giây rồi tự ẩn.
  useEffect(() => {
    if (!s.notice) return;
    const id = setTimeout(() => s.clearNotice(), 3000);
    return () => clearTimeout(id);
  }, [s.noticeKey, s.notice, s]);
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

  const trumpMarker: Record<string, string> = { S: "spades", C: "clubs", H: "hearts", D: "diamonds" };
  // Phòng Tấn theo từng hạng — chỉ là điểm thưởng trong game, KHÔNG tiền thật.
  const [tier, setTier] = useState("tap-su");
  const [rooms, setRooms] = useState<Record<string, { id: number; bet: string; players: number; min: string }[]>>({
    "tap-su": [
      { id: 144459, bet: "20K", players: 3, min: "200K" },
      { id: 143122, bet: "5K", players: 3, min: "50K" },
      { id: 144530, bet: "5K", players: 3, min: "50K" },
      { id: 144738, bet: "5K", players: 2, min: "50K" },
      { id: 143314, bet: "5K", players: 3, min: "50K" },
    ],
    "nghiep-du": [
      { id: 145201, bet: "100K", players: 4, min: "1M" },
      { id: 145112, bet: "50K", players: 3, min: "500K" },
      { id: 145330, bet: "100K", players: 2, min: "1M" },
      { id: 145045, bet: "50K", players: 3, min: "500K" },
      { id: 145278, bet: "50K", players: 4, min: "500K" },
    ],
    "chuyen-nghiep": [
      { id: 146501, bet: "500K", players: 3, min: "5M" },
      { id: 146212, bet: "200K", players: 4, min: "2M" },
      { id: 146390, bet: "500K", players: 2, min: "5M" },
      { id: 146105, bet: "200K", players: 3, min: "2M" },
      { id: 146444, bet: "200K", players: 3, min: "2M" },
    ],
    "master": [
      { id: 147901, bet: "1M", players: 3, min: "6M" },
      { id: 147712, bet: "500K", players: 4, min: "5M" },
      { id: 147830, bet: "1M", players: 2, min: "6M" },
      { id: 147655, bet: "500K", players: 3, min: "5M" },
      { id: 147514, bet: "1M", players: 3, min: "6M" },
    ],
  });
  const tierNames: Record<string, string> = { "tap-su": "Tập Sự", "nghiep-du": "Nghiệp Dư", "chuyen-nghiep": "Chuyên Nghiệp", "master": "Master" };
  const joinRoom = (roomId: number) => {
    // Vào phòng = chơi ván Tấn VN-8 với bot lấp ghế trống (online realtime chưa làm).
    s.setPlayerCount(4);
    s.startGame();
  };
  const createRoom = () => {
    const id = 148000 + Math.floor(Math.random() * 899);
    const first = rooms[tier][0];
    setRooms((r) => ({ ...r, [tier]: [{ id, bet: first.bet, players: 1, min: first.min }, ...r[tier]] }));
  };
  const homeTop = (
    <div className="tan-top">
      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <button className="tan-icon" onClick={s.backToLobby}>✕</button>
        <button className="tan-icon">☰</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="tan-avatar">{(s.playerName.trim() || "B").charAt(0).toUpperCase()}</div>
        <div>
          <input className="bg-transparent font-bold outline-none" style={{ fontSize: "clamp(14px, 3.2vh, 22px)", width: 140 }} value={s.playerName} onChange={(e) => s.setPlayerName(e.target.value)} aria-label="Tên của bạn" />
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>♠ TẤN ONLINE · VN-8 · 2–4 người</div>
        </div>
      </div>
      <div className="tan-shop">
        <span className="tan-shop-label">CỬA HÀNG</span>
        <span className="tan-coins"><span className="tan-coin">◎</span> 6,417,098</span>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button className="tan-icon">👥</button>
        <button className="tan-icon">?</button>
        <button className="tan-icon">⚙️</button>
      </div>
    </div>
  );
  const homeBottom = (
    <div className="tan-bottom">
      <div className="tan-bottom-group">
        <button className="tan-bottom-btn"><span className="circle">👤+</span></button>
        <button className="tan-bottom-btn"><span className="circle">🏆</span></button>
        <button className="tan-bottom-btn"><span className="circle">🎁</span><span className="tan-badge">10</span></button>
        <button className="tan-bottom-btn"><span className="circle">📋</span></button>
      </div>
      <button className="tan-spin">SPIN</button>
      <div className="tan-bottom-group">
        <button className="tan-bottom-btn"><span className="circle">f</span></button>
        <button className="tan-bottom-btn"><span className="circle">👥</span></button>
        <button className="tan-bottom-btn"><span className="circle">🎒</span></button>
        <button className="tan-choose" onClick={s.goToRooms}>CHỌN<br />BÀN</button>
      </div>
    </div>
  );
  if (s.screen === "rooms") {
    return (
      <div className="tan-home h-screen w-screen overflow-hidden text-white flex flex-col">
        <div className="tan-rooms-top">
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <button className="tan-icon" onClick={s.backToLobby}>✕</button>
            <button className="tan-icon">☰</button>
          </div>
          <div style={{ margin: "0 auto", display: "flex", gap: 12 }}>
            <button className="tan-pill orange">CHƠI NGAY</button>
            <button className="tan-pill green" onClick={createRoom}>TẠO PHÒNG</button>
          </div>
          <button className="tan-icon" onClick={s.backToLobby}>⌂</button>
        </div>
        <div className="tan-table">
          <div className="tan-head"><span>Phòng</span><span>Mức điểm</span><span>Số người</span><span>Tối thiểu</span><span>Trạng thái</span></div>
          <div className="tan-list">
            {rooms[tier].map((r) => (
              <div className="tan-row" key={r.id}>
                <span className="tan-room-id">{r.id}</span>
                <span className="tan-bet">{r.bet}</span>
                <span className="tan-hearts">{[1, 2, 3, 4].map((i) => <span key={i} className={i <= r.players ? "on" : "off"}>♥</span>)}</span>
                <span className="tan-min">{r.min}</span>
                <button className="tan-join" onClick={() => joinRoom(r.id)}>Tham gia</button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "10px 20px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="tan-avatar">{(s.playerName.trim() || "B").charAt(0).toUpperCase()}</div>
            <div><b>{s.playerName || "Bạn"}</b><div style={{ color: "#ffd97a", fontWeight: 700 }}>6,417,098 điểm</div></div>
          </div>
          <div className="tan-tabs">
            {Object.keys(tierNames).map((t) => (
              <button key={t} className={`tan-tab ${tier === t ? "active" : ""}`} onClick={() => setTier(t)}>{tierNames[t]}</button>
            ))}
          </div>
        </div>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,.6)", fontSize: 13, paddingBottom: 8 }}>Xu trong Tấn chỉ là điểm thưởng, không nạp/rút hay đổi tiền thật. Vào phòng hiện chơi với bot lấp ghế trống.</p>
      </div>
    );
  }
  if (s.screen === "lobby" || !game) {
    return (
      <div className="tan-home h-screen w-screen overflow-hidden text-white flex flex-col">
        {homeTop}
        <div className="tan-center">
          <button className="tan-play" onClick={s.goToRooms}>
            <div className="tan-fan">
              <img src="/durak/cards/AS.png" alt="A bích" /><img src="/durak/cards/AD.png" alt="A rô" /><img src="/durak/cards/AC.png" alt="A chuồn" /><img src="/durak/cards/AH.png" alt="A cơ" />
            </div>
            <div className="tan-chips">
              <span className="tan-chip" style={{ background: "#dc2626" }}>●</span><span className="tan-chip" style={{ background: "#f8fafc", color: "#111" }}>●</span><span className="tan-chip" style={{ background: "#f97316" }}>●</span><span className="tan-chip" style={{ background: "#1f2937" }}>●</span>
            </div>
            <h2>CHƠI NGAY</h2>
          </button>
          <button className="tan-play" onClick={s.goToRooms}>
            <div className="tan-fan">
              <img src="/durak/cards/KS.png" alt="K bích" /><img src="/durak/cards/QD.png" alt="Q rô" /><img src="/durak/cards/JC.png" alt="J chuồn" /><img src="/durak/cards/AH.png" alt="A cơ" />
            </div>
            <div style={{ position: "absolute", bottom: "26%", right: "14%", width: "min(11vw, 17vh)", height: "min(11vw, 17vh)", minWidth: 54, minHeight: 54, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #fde68a, #f59e0b 60%, #b45309)", border: "5px dashed #7c2d12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "min(5vh, 32px)", fontWeight: 900, color: "#7c2d12" }}>◎</div>
            <h2>CHƠI VỚI BẠN</h2>
          </button>
        </div>
        <div style={{ textAlign: "center", paddingBottom: 8 }}>
          <label style={{ marginRight: 16 }}>Số người chơi
            <select className="text-black ml-2 px-3 py-2 rounded" value={s.playerCount} onChange={(e) => s.setPlayerCount(Number(e.target.value))}>
              <option value={2}>2 người</option><option value={3}>3 người</option><option value={4}>4 người</option>
            </select>
          </label>
          <label><input type="checkbox" checked={s.allowTransfer} onChange={(e) => s.setAllowTransfer(e.target.checked)} /> Cho phép chuyển tấn</label>
        </div>
        {homeBottom}
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
    <div className="h-screen w-screen overflow-hidden bg-[#1b3a1b] text-white flex flex-col relative">
      <div className="flex flex-wrap gap-3 bg-black/50 px-3 py-2 font-semibold items-center justify-between shrink-0">
        <span className="flex items-center gap-3">
          <button className="w-9 h-9 rounded-full bg-red-900 border border-white/30 text-xl" title="Về sảnh" onClick={s.backToLobby}>×</button>
          <span>{game.phase === "FINISHED" ? "Ván đã kết thúc" : `${game.players.find((p) => p.id === game.attackerId)?.name} tấn · ${game.players.find((p) => p.id === game.defenderId)?.name} đỡ`}</span>
          {myTurn && <span>⏱ {seconds}s</span>}
          <span className="flex items-center gap-1">Chủ: {SUIT_NAME[game.trumpSuit]} <img src={`/durak/ui/trump_marker_${trumpMarker[game.trumpSuit]}.png`} alt={SUIT_NAME[game.trumpSuit]} className="w-6 h-6" /></span>
          <span>Nọc: {game.drawPile.length} lá</span>
        </span>
        <span className="flex gap-2">
          <button className="px-4 h-9 rounded-full bg-red-900 border border-white/30 text-sm" onClick={() => setChatOpen((v) => !v)}>💬 Chat{s.chat.length > 1 ? ` (${s.chat.length - 1})` : ""}</button>
          <button className="w-9 h-9 rounded-full bg-red-900 border border-white/30 text-xs" title="Cài đặt chưa làm trong bản bot">Menu</button>
        </span>
      </div>
      {/* Toast thông báo ngắn gọn, thay khung log dài cũ (đã bỏ). */}
      {s.notice && (
        <div key={s.noticeKey} className="toast-notice absolute top-14 left-1/2 -translate-x-1/2 z-40 bg-black/80 border border-yellow-400 text-yellow-100 text-sm font-semibold px-4 py-2 rounded-full shadow-lg whitespace-nowrap max-w-[92vw] overflow-hidden text-ellipsis">
          {s.notice}
        </div>
      )}
      {/* Lá vừa đánh bay từ tay người đánh lên giữa bàn. */}
      {s.flying && (
        <div key={s.flying.key} className={`flying-card ${s.flying.by === HUMAN_ID ? "flying-human" : "flying-bot"}`}>
          <CardView card={parseCard(s.flying.cardId)} />
        </div>
      )}
      <div className="flex gap-2 justify-center py-2 flex-wrap shrink-0">
        {game.players.filter((p) => p.id !== HUMAN_ID).map((p, idx) => (
          <div key={p.id} className={`flex items-center gap-2 bg-black/40 px-3 py-1 rounded-xl text-sm ${p.id === game.attackerId || p.id === game.defenderId ? "outline outline-yellow-400" : ""}`}>
            <img src={`/durak/ui/avatar_${(idx % 3) + 1}.png`} alt={p.name} className="w-8 h-8 rounded-full" />
            <span>{p.name} {p.id === game.attackerId ? "⚔️ tấn" : ""} {p.id === game.defenderId ? "🛡️ đỡ" : ""} {p.finished ? "✅ xong" : ""} · {p.hand.length} lá</span>
          </div>
        ))}
      </div>
      <TableCanvas game={game} />
      <div className="text-center space-x-2 py-2 shrink-0">
        <button className="bg-white text-black font-semibold px-4 py-2 rounded-full disabled:opacity-40" disabled={!(iAmAttacker && allDefended)} onClick={s.finishAttackAction}>Kết thúc đợt</button>
        <button className="bg-white text-black font-semibold px-4 py-2 rounded-full disabled:opacity-40" disabled={!(iAmDefender && game.table.length > 0)} onClick={s.takeCards}>Nhận bài</button>
        <button className="bg-white text-black font-semibold px-4 py-2 rounded-full disabled:opacity-40" disabled={!(iAmDefender && s.selected && game.table.length > 0 && !game.table.some((x) => x.defense) && game.table.some((x) => x.attack.rank === parseCard(s.selected as string).rank))} onClick={s.transferCard}>Chuyển tấn</button>
        <button className="bg-white text-black font-semibold px-4 py-2 rounded-full disabled:opacity-40" disabled={!(game.table.length > 0 && !iAmDefender)} onClick={s.passAdd}>Không thêm nữa</button>
        <button className="bg-yellow-400 text-black font-semibold px-4 py-2 rounded-full" onClick={s.backToLobby}>Ván mới</button>
      </div>
      <div className="flex justify-center flex-wrap shrink-0 px-2 pb-2">
        {me?.hand.map((c, i) => (
          <div key={c.id} className={i === 0 ? "" : "-ml-6"}>
            <CardView card={c} selected={s.selected === c.id} onClick={() => s.playCard(c.id)} />
          </div>
        ))}
      </div>
      <p className="text-center text-yellow-200 text-sm pb-2 shrink-0">{hint}</p>
      {/* Chat trong ván: chỉ ở bộ nhớ, thoát ván là mất, không lưu DB. */}
      {chatOpen && (
        <div className="absolute bottom-2 right-2 z-50 w-80 max-w-[92vw] bg-black/90 border border-yellow-400/60 rounded-2xl overflow-hidden shadow-2xl">
          <div className="flex justify-between items-center px-3 py-2 bg-red-950 font-semibold text-sm">
            <span>💬 Chat trong ván</span>
            <button onClick={() => setChatOpen(false)}>×</button>
          </div>
          <div className="h-56 overflow-auto p-3 space-y-2 text-sm">
            {s.chat.map((m) => (
              <div key={m.id} className={m.from === (s.playerName.trim() || "Bạn") ? "text-right" : ""}>
                <span className="text-yellow-300 text-xs font-semibold">{m.from}: </span>
                <span>{m.text}</span>
              </div>
            ))}
          </div>
          <form className="flex gap-2 p-2 border-t border-white/20" onSubmit={(e) => { e.preventDefault(); s.sendChat(chatText); setChatText(""); }}>
            <input className="flex-1 min-w-0 text-black px-3 py-2 rounded-full text-sm" placeholder="Nhắn trong ván này…" value={chatText} onChange={(e) => setChatText(e.target.value)} />
            <button className="bg-yellow-400 text-black font-bold px-4 rounded-full text-sm" type="submit">Gửi</button>
          </form>
          <p className="text-center text-white/50 text-xs pb-2">Thoát ván là mất chat, không lưu lại.</p>
        </div>
      )}
      {game.phase === "FINISHED" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="max-w-xl mx-4 bg-red-900 border border-yellow-400 rounded-2xl p-6 text-center">
            <img src={game.loserId === HUMAN_ID ? "/durak/ui/you_lose.png" : "/durak/ui/you_won.png"} alt="Kết quả" className="w-48 mx-auto mb-3" />
            <h2 className="text-xl font-bold">Kết quả</h2>
            <p>Người thua: <b>{game.players.find((p) => p.id === game.loserId)?.name}</b></p>
            <p>Thứ tự hoàn thành: {game.finishOrder.map((id) => game.players.find((p) => p.id === id)?.name).join(" → ") || "—"}</p>
            <button className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-full mt-3" onClick={s.backToLobby}>Chơi ván mới</button>
          </div>
        </div>
      )}
    </div>
  );
}
