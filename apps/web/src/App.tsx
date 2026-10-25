import { useEffect, useState } from "react";
import { useGameStore, HUMAN_ID } from "./store";
import { CardView } from "./components/CardView";
import { TableCanvas } from "./components/TableCanvas";
import { parseCard, SUIT_NAME, SUIT_SYMBOL, canBeat, cardLabel } from "../../../packages/game-core/src/engine";
import { X, Users, HelpCircle, Settings, UserPlus, Trophy, Gift, ClipboardList, Backpack, Home, MessageCircle, Timer, Minus, Plus, Swords, Shield, Check, Volume2, ArrowDownWideNarrow, } from "lucide-react";
import { playDealSound, playCardSound, playTrumpAceSound, setSoundEnabled, setSoundVolume } from "./game/sound";
const ic = { size: 22, strokeWidth: 2 };

export default function App() {
  const s = useGameStore();
  const [seconds, setSeconds] = useState(30);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [soundVol, setSoundVol] = useState(70);
  const [lastSort, setLastSort] = useState<"suit" | "rank" | null>(null);
  const [bubble, setBubble] = useState<{ text: string; key: number } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // Bong bóng chat trên avatar: hiện 6 giây rồi tự ẩn.
  useEffect(() => {
    if (!bubble) return;
    const id = setTimeout(() => setBubble(null), 6000);
    return () => clearTimeout(id);
  }, [bubble]);
  // Toast thông báo: hiện ~3 giây rồi tự ẩn.
  useEffect(() => {
    if (!s.notice) return;
    const id = setTimeout(() => s.clearNotice(), 3000);
    return () => clearTimeout(id);
  }, [s.noticeKey, s.notice, s]);
  const game = s.game;
  // A chủ ra bàn: phát âm thanh dồn riêng, bất kể người đánh là mình hay bot.
  useEffect(() => {
    if (!s.flying || !game) return;
    const c = parseCard(s.flying.cardId);
    if (c.rank === 14 && c.suit === game.trumpSuit) playTrumpAceSound();
  }, [s.flying, game]);
  const me = game?.players.find((p) => p.id === HUMAN_ID);
  const iAmDefender = game?.defenderId === HUMAN_ID;
  const iAmAttacker = game?.attackerId === HUMAN_ID;
  const undefended = game?.table.filter((x) => !x.defense) ?? [];
  const allDefended = !!game && game.table.length > 0 && game.table.every((x) => x.defense);
  // Thời gian đỡ: 30 giây, tính cho MỌI người đỡ (cả bot, để vẽ vòng sáng).
  // Khóa reset: đổi người đỡ, hoặc số lá trên bàn tăng (có người tấn thêm) thì
  // reset về 30. Đỡ 1 lá (số lá không đổi) thì KHÔNG reset.
  const isDefending = !!game && game.phase !== "FINISHED" && game.phase !== "DRAWING" && game.table.length > 0 && undefended.length > 0;
  const defendKey = isDefending && game ? `${game.defenderId}-${game.table.length}` : "";
  const [defendSeconds, setDefendSeconds] = useState(30);
  useEffect(() => { if (defendKey) setDefendSeconds(30); }, [defendKey]);
  useEffect(() => {
    if (!isDefending) return;
    const id = setInterval(() => setDefendSeconds((v) => {
      if (v <= 1) {
        // Hết giờ đỡ mà không đỡ: coi như tự lên bài (chỉ áp dụng cho người chơi).
        if (game && game.defenderId === HUMAN_ID) s.takeCards();
        return 30;
      }
      return v - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [isDefending, game, s]);
  const defendFraction = defendSeconds / 30;

  // Đồng hồ tấn: tính cả lúc tấn đầu (bàn trống) lẫn lúc thêm bài (mọi lá đã được đỡ).
  // Lá tấn mới (số lá trên bàn tăng, hoặc vừa đỡ xong để tấn tiếp) thì reset về 30s.
  // Hết giờ tấn thì hết lượt tấn: bàn trống -> chuyển lượt tấn cho người khác;
  // đã tấn xong và đỡ hết -> tự kết thúc đợt.
  const myAttackTurn = !!game && game.phase !== "FINISHED" && game.phase !== "DRAWING" && iAmAttacker && (game.table.length === 0 || allDefended);
  const attackKey = myAttackTurn && game ? `${game.attackerId}-${game.table.length}-${allDefended}` : "";
  useEffect(() => { if (attackKey) setSeconds(30); }, [attackKey]);
  useEffect(() => {
    if (!myAttackTurn) { setSeconds(30); return; }
    const id = setInterval(() => setSeconds((v) => {
      if (v <= 1) {
        if (game) { if (game.table.length === 0) s.passAttack(); else if (allDefended) s.finishAttackAction(); }
        return 30;
      }
      return v - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [myAttackTurn, game, allDefended, s]);

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
  // Màn Tạo phòng (ảnh mẫu): slider mức điểm, chọn số người, nút TẠO PHÒNG.
  const BET_LEVELS = ["5K", "20K", "50K", "100K", "200K", "500K", "1M"];
  const BET_MINS: Record<string, string> = { "5K": "50K", "20K": "200K", "50K": "500K", "100K": "1M", "200K": "2M", "500K": "5M", "1M": "6M" };
  const BET_TIERS: Record<string, string> = { "5K": "tap-su", "20K": "tap-su", "50K": "nghiep-du", "100K": "nghiep-du", "200K": "chuyen-nghiep", "500K": "chuyen-nghiep", "1M": "master" };
  const [betIdx, setBetIdx] = useState(0);
  const [createCount, setCreateCount] = useState(4);
  const submitCreateRoom = () => {
    const id = 148000 + Math.floor(Math.random() * 899);
    const bet = BET_LEVELS[betIdx];
    if (s.createPrivate) {
      // Phòng riêng chơi với bạn: tạo mã phòng, vào ván luôn, mã hiện góc phải trong ván.
      s.setRoomCode(String(id));
      s.setPlayerCount(createCount);
      s.startGame();
    } else {
      const t = BET_TIERS[bet];
      setTier(t);
      setRooms((r) => ({ ...r, [t]: [{ id, bet, players: 1, min: BET_MINS[bet] }, ...r[t]] }));
      s.goToRooms();
    }
  };
  const homeTop = (
    <div className="tan-top">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="tan-avatar">{(s.playerName.trim() || "B").charAt(0).toUpperCase()}</div>
        <div>
          <input className="bg-transparent font-bold outline-none" style={{ fontSize: "clamp(14px, 3.2vh, 22px)", width: 140 }} value={s.playerName} onChange={(e) => s.setPlayerName(e.target.value)} aria-label="Tên của bạn" />
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>TẤN ONLINE · VN-8 · 2–4 người</div>
        </div>
      </div>
      <div className="tan-shop">
        <span className="tan-coins"><img src="/icons/coin.svg" alt="Xu" style={{ width: "min(7vh, 44px)", height: "min(7vh, 44px)" }} /> 6,417,098</span>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button className="tan-icon" style={{ cursor: "default" }} aria-label="Bạn bè (chưa mở)"><Users {...ic} /></button>
        <button className="tan-icon" aria-label="Hướng dẫn luật chơi" onClick={() => setHelpOpen(true)}><HelpCircle {...ic} /></button>
        <button className="tan-icon" style={{ cursor: "default" }} aria-label="Cài đặt (chưa mở ở sảnh)"><Settings {...ic} /></button>
      </div>
    </div>
  );
  const homeBottom = (
    <div className="tan-bottom">
      <div className="tan-bottom-group">
        <button className="tan-bottom-btn" style={{ cursor: "default" }}><span className="circle"><UserPlus {...ic} /></span></button>
        <button className="tan-bottom-btn" style={{ cursor: "default" }}><span className="circle"><Trophy {...ic} /></span></button>
        <button className="tan-bottom-btn" style={{ cursor: "default" }}><span className="circle"><Gift {...ic} /></span><span className="tan-badge">10</span></button>
        <button className="tan-bottom-btn" style={{ cursor: "default" }}><span className="circle"><ClipboardList {...ic} /></span></button>
      </div>
      <button className="tan-spin" style={{ cursor: "default" }}>SPIN</button>
      <div className="tan-bottom-group">
        <button className="tan-bottom-btn" style={{ cursor: "default" }}><span className="circle">f</span></button>
        <button className="tan-bottom-btn" style={{ cursor: "default" }}><span className="circle"><Users {...ic} /></span></button>
        <button className="tan-bottom-btn" style={{ cursor: "default" }}><span className="circle"><Backpack {...ic} /></span></button>
        <button className="tan-choose" onClick={s.goToRooms}>CHỌN<br />BÀN</button>
      </div>
    </div>
  );
  if (s.screen === "create") {
    const pct = BET_LEVELS.length > 1 ? (betIdx / (BET_LEVELS.length - 1)) * 100 : 0;
    return (
      <div className="tan-home h-full w-full overflow-hidden text-white flex flex-col">
        <div className="tan-rooms-top">
          <h1 style={{ margin: "0 auto", fontSize: "clamp(20px, 5vh, 34px)", letterSpacing: 1, color: "#fef3c7" }}>TẠO PHÒNG CHƠI</h1>
          <button className="tan-icon" onClick={s.backToLobby} aria-label="Đóng"><X size={22} /></button>
        </div>
        <div style={{ padding: "min(4vh, 28px) min(6vw, 60px) 0" }}>
          <p style={{ fontSize: "clamp(15px, 3.4vh, 22px)", color: "#fef3c7", marginBottom: 12 }}>
            Mức điểm: {s.createPrivate ? " (phòng riêng chơi với bạn)" : ""}
          </p>
          <div style={{ background: "rgba(0,0,0,.3)", border: "1px solid rgba(239,68,68,.5)", borderRadius: 12, padding: "min(3vh, 20px) min(3vw, 24px)" }}>
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <span style={{ background: "#9f1239", padding: "8px 28px", borderRadius: 8, fontWeight: 900, fontSize: "clamp(15px, 3.4vh, 22px)" }}>{BET_LEVELS[betIdx]}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button className="tan-icon" style={{ background: "#9f1239" }} onClick={() => setBetIdx((v) => Math.max(0, v - 1))} aria-label="Giảm mức điểm"><Minus size={22} /></button>
              <div style={{ flex: 1, position: "relative", height: 40, display: "flex", alignItems: "center" }}>
                <div style={{ position: "absolute", left: 0, right: 0, height: 10, borderRadius: 99, background: "rgba(0,0,0,.6)" }} />
                <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: 10, borderRadius: 99, background: "#f59e0b" }} />
                <img src="/icons/chip-gold.png" alt="Chip" style={{ position: "absolute", left: `calc(${pct}% - 20px)`, width: 40, height: 40 }} />
              </div>
              <button className="tan-icon" style={{ background: "#9f1239" }} onClick={() => setBetIdx((v) => Math.min(BET_LEVELS.length - 1, v + 1))} aria-label="Tăng mức điểm"><Plus size={22} /></button>
            </div>
            <p style={{ textAlign: "center", color: "rgba(255,255,255,.7)", fontSize: 13, marginTop: 8 }}>Tối thiểu vào phòng: {BET_MINS[BET_LEVELS[betIdx]]} điểm · Điểm chỉ là điểm thưởng, không tiền thật</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: "min(6vh, 40px)", flexWrap: "wrap" }}>
            <span style={{ fontSize: "clamp(15px, 3.4vh, 22px)", color: "#fef3c7" }}>Số người:</span>
            {[2, 3, 4].map((n) => (
              <button key={n} onClick={() => setCreateCount(n)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "clamp(16px, 3.6vh, 24px)", fontWeight: 700 }}>
                <span style={{ width: 34, height: 34, borderRadius: "50%", background: createCount === n ? "#f59e0b" : "rgba(0,0,0,.5)", border: "2px solid rgba(255,255,255,.3)" }} />
                {n}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: "center", paddingBottom: "min(6vh, 40px)" }}>
          <button className="tan-pill" style={{ background: "#2f9e8f", color: "#fff", fontSize: "clamp(15px, 3.4vh, 22px)" }} onClick={submitCreateRoom}>TẠO PHÒNG</button>
        </div>
      </div>
    );
  }
  if (s.screen === "rooms") {
    return (
      <div className="tan-home h-full w-full overflow-hidden text-white flex flex-col">
        <div className="tan-rooms-top">
          <div style={{ margin: "0 auto", display: "flex", gap: 12 }}>
            <button className="tan-pill orange">CHƠI NGAY</button>
            <button className="tan-pill green" onClick={() => s.goToCreate(false)}>TẠO PHÒNG</button>
          </div>
          <button className="tan-icon" onClick={s.backToLobby} aria-label="Về trang chủ"><Home {...ic} /></button>
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
      <div className="tan-home h-full w-full overflow-hidden text-white flex flex-col">
        {homeTop}
        <div className="tan-center">
          <button className="tan-play" onClick={s.goToRooms}>
            <div className="tan-fan">
              <img src="/durak/cards/AS.png" alt="A bích" /><img src="/durak/cards/AD.png" alt="A rô" /><img src="/durak/cards/AC.png" alt="A chuồn" /><img src="/durak/cards/AH.png" alt="A cơ" />
            </div>
            <img src="/icons/chips-stack.png" alt="Chip bài" style={{ position: "absolute", bottom: "22%", left: "50%", transform: "translateX(-50%)", width: "min(22vw, 30vh)" }} />
            <h2>CHƠI NGAY</h2>
          </button>
          <button className="tan-play" onClick={() => s.goToCreate(true)}>
            <div className="tan-fan">
              <img src="/durak/cards/KS.png" alt="K bích" /><img src="/durak/cards/QD.png" alt="Q rô" /><img src="/durak/cards/JC.png" alt="J chuồn" /><img src="/durak/cards/AH.png" alt="A cơ" />
            </div>
            <img src="/icons/chip-gold.png" alt="Chip vàng" style={{ position: "absolute", bottom: "26%", right: "14%", width: "min(11vw, 17vh)", minWidth: 54 }} />
            <h2>CHƠI VỚI BẠN</h2>
          </button>
        </div>
        <div style={{ textAlign: "center", paddingBottom: 8 }}>
          <label style={{ marginRight: 16 }}>Số người chơi
            <select className="text-black ml-2 px-3 py-2 rounded" value={s.playerCount} onChange={(e) => s.setPlayerCount(Number(e.target.value))}>
              <option value={2}>2 người</option><option value={3}>3 người</option><option value={4}>4 người</option>
            </select>
          </label>
         
        </div>
        {homeBottom}
                {helpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setHelpOpen(false)}>
            <div className="w-full max-w-lg max-h-[85vh] overflow-auto bg-red-900 border border-yellow-400 rounded-2xl p-5 text-sm leading-relaxed" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-3"><h2 className="font-bold text-lg">Hướng dẫn luật chơi Tấn (VN-8)</h2><button onClick={() => setHelpOpen(false)} aria-label="Đóng hướng dẫn"><X size={18} /></button></div>
              <p><b>Mục tiêu:</b> đánh hết bài trên tay trước khi nọc hết. Người cuối cùng còn bài trên tay là người thua ván.</p>
              <p className="mt-2"><b>Chia bài:</b> 2–4 người, mỗi người 8 lá, bộ Tây 52 lá không Joker. Lá cuối nọc lật ngửa làm chất chủ (ví dụ Cơ là chủ thì Cơ mạnh nhất).</p>
              <p className="mt-2"><b>Người tấn đầu:</b> người có lá chủ nhỏ nhất. Sau đó tấn theo vòng ngược chiều kim đồng hồ: Mình → Bot 3 (phải) → Bot 1 (trên) → Bot 2 (trái) → Mình; người vừa đỡ xong sẽ tấn tiếp, người ngồi kế tiếp sau người tấn là người đỡ.</p>
              <p className="mt-2"><b>Tấn:</b> tấn 1 lá đầu, sau đó chỉ được thêm lá cùng hạng với lá đã có trên bàn. Một đợt tối đa 6 lá, và không vượt số lá người đỡ có lúc đợt bắt đầu.</p>
              <p className="mt-2"><b>Đỡ:</b> đỡ bằng lá cùng chất cao hơn, hoặc bằng lá chủ nếu lá tấn không phải chủ. Lá tấn là chủ thì chỉ đỡ bằng lá chủ cao hơn. Người đỡ có 30 giây, quanh avatar có vòng sáng đếm ngược, hết giờ tự lên bài.</p><p className="mt-2"><b>Tấn cũng tính giờ:</b> người tấn có 30 giây, tấn lá mới thì reset lại 30 giây. Hết giờ tấn thì hết lượt tấn: chưa tấn lá nào thì chuyển lượt tấn cho người khác, đã tấn và đỡ hết thì tự kết thúc đợt.</p>
              <p className="mt-2"><b>Lên bài:</b> không đỡ được (hoặc muốn lên) thì bấm Lên bài, nhận hết bài trên bàn, mất lượt tấn tiếp theo.</p>
              <p className="mt-2"><b>Bốc bài:</b> đỡ thành công và kết thúc đợt thì mọi người bốc từng lá cho đủ 8 lá, theo thứ tự người tấn, người thêm, người đỡ cuối. Hết nọc thì ai hết bài trước là xong, người còn bài cuối cùng thua.</p>
              <p className="mt-2"><b>Nút trong ván:</b> Kết thúc đợt (người tấn chính, khi mọi lá đã được đỡ), Lên bài, Bốc bài (khi tới lượt bốc), Xếp bài (theo chất hoặc theo hạng, từ A xuống 2).</p>
              <p className="mt-2 text-yellow-200">Lưu ý: điểm/xu trong game chỉ là điểm thưởng, không nạp/rút hay đổi tiền thật. Bản này không còn chức năng chuyển tấn.</p>
              <button className="bg-yellow-400 text-black font-bold px-6 py-2 rounded-full mt-4" onClick={() => setHelpOpen(false)}>Đã hiểu</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  let hint = "Đang chờ bot đánh…";
  if (game.phase === "FINISHED") hint = game.loserId === HUMAN_ID ? "Bạn là người thua ván này." : `${game.players.find((p) => p.id === game.loserId)?.name} thua ván này.`;
  else if (iAmDefender && undefended.length) hint = "Tới lượt bạn đỡ: bấm lá bài để đỡ, hoặc bấm Lên bài bất cứ lúc nào (kể cả khi đỡ được).";
  else if (game.phase === "DRAWING" && game.pendingDraw[0] === HUMAN_ID) hint = "Tới lượt bạn bốc bài: bấm Bốc bài để bốc từng lá cho đủ 8 lá.";
  else if (game.phase === "DRAWING") hint = "Đang bốc bài: chờ người khác bốc đủ 8 lá…";
  else if (iAmAttacker && game.table.length === 0) hint = "Tới lượt bạn tấn: bấm 1 lá bài để đánh ra.";
  else if (iAmAttacker && allDefended) hint = "Bạn có thể thêm bài cùng hạng, hoặc bấm Kết thúc đợt.";
  else if (!iAmDefender && game.table.length > 0) hint = "Bạn có thể thêm bài cùng hạng.";

  return (
    <div className="h-full w-full overflow-hidden bg-[#1b3a1b] text-white flex flex-col relative">
      <div className="flex gap-3 bg-black/50 px-3 py-2 font-semibold items-center justify-between shrink-0">
        <span className="flex items-center gap-3">
          <button className="w-9 h-9 rounded-full bg-red-900 border border-white/30 flex items-center justify-center" title="Về sảnh" onClick={s.backToLobby}><X size={18} /></button>
          <span>{game.phase === "FINISHED" ? "Ván đã kết thúc" : `${game.players.find((p) => p.id === game.attackerId)?.name} tấn · ${game.players.find((p) => p.id === game.defenderId)?.name} đỡ`}</span>
          {isDefending ? <span className="flex items-center gap-1"><Timer size={18} /> Đỡ: {defendSeconds}s</span> : myAttackTurn ? <span className="flex items-center gap-1"><Timer size={18} /> {seconds}s</span> : null}
          <span className="flex items-center gap-1">Chủ: {SUIT_NAME[game.trumpSuit]} <img src={`/durak/ui/trump_marker_${trumpMarker[game.trumpSuit]}.png`} alt={SUIT_NAME[game.trumpSuit]} className="w-6 h-6" /></span>
          <span>Nọc: {game.drawPile.length} lá</span>
        </span>
        <span className="flex gap-2 items-center">
          {s.roomCode && <span className="bg-yellow-400 text-black font-bold px-3 h-9 rounded-full flex items-center text-sm">Mã phòng: {s.roomCode}</span>}
          <button className="px-4 h-9 rounded-full bg-red-900 border border-white/30 text-sm" onClick={() => setChatOpen((v) => !v)}><span className="flex items-center gap-1"><MessageCircle size={18} /> Chat{s.chat.length > 1 ? ` (${s.chat.length - 1})` : ""}</span></button>
          <button className="w-9 h-9 rounded-full bg-red-900 border border-white/30 flex items-center justify-center" title="Cài đặt âm thanh" onClick={() => setSettingsOpen(true)}><Settings size={18} /></button>
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
      {/* Hiệu ứng tấn công khi bất kỳ ai ra A chủ: tia vàng xoay + vòng sóng + chữ A CHỦ! */}
      {s.flying && game && (() => { const c = parseCard(s.flying.cardId); return c.rank === 14 && c.suit === game.trumpSuit; })() && (
        <div key={`ace-${s.flying.key}`} className="trump-ace-effect">
          <div className="trump-ace-rays" />
          <div className="trump-ace-ring" />
          <span className="trump-ace-text">A CHỦ!</span>
        </div>
      )}
      {/* Đối thủ đối diện nhau, vòng tấn đi NGƯỢC chiều kim đồng hồ:
          Mình (dưới) -> Bot3 (phải) -> Bot1 (trên) -> Bot2 (trái) -> Mình.
          Người đỡ luôn là người ngồi kế tiếp sau người tấn theo vòng này. */}
      <div className="w-full relative flex flex-col" style={{ height: 660, flexShrink: 0 }}>
        <TableCanvas game={game} />
        {game.players.filter((p) => p.id !== HUMAN_ID).map((p, idx) => {
          const pos = p.name === "Bot 3" ? "absolute right-2 top-1/2 -translate-y-1/2" : p.name === "Bot 2" ? "absolute left-2 top-1/2 -translate-y-1/2" : "absolute top-2 left-1/2 -translate-x-1/2";
          return (
            <div key={p.id} className={`${pos} z-20 flex items-center gap-2 bg-black/55 px-2 py-1 rounded-xl text-sm ${p.id === game.attackerId || p.id === game.defenderId ? "outline outline-yellow-400" : ""}`}>
              <div className="relative shrink-0" style={p.id === game.defenderId && isDefending ? { padding: 3, borderRadius: "50%", background: `conic-gradient(#facc15 ${defendFraction * 100}%, rgba(255,255,255,0.2) 0)`, boxShadow: "0 0 16px rgba(250,204,21,0.9)" } : undefined}>
                <img src={`/durak/ui/avatar_${(p.name.replace("Bot ", "") || "1")}.png`} alt={p.name} className="w-[100px] h-[100px] rounded-full block" />
                {p.id === game.defenderId && isDefending && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-400 text-black font-black text-[11px] px-1.5 rounded-full border border-white">{defendSeconds}s</span>}
              </div>
              <div className="relative shrink-0">
                <img src="/durak/cards/back.png" alt="Bài úp" className="w-[72px] h-[100px] rounded" />
                <span className="absolute inset-0 flex items-center justify-center"><span className="bg-yellow-400 text-black font-black text-lg w-9 h-9 rounded-full flex items-center justify-center border-2 border-white shadow">{p.hand.length}</span></span>
              </div>
              <span className="whitespace-nowrap flex flex-col leading-tight"><b>{p.name}</b><span className="flex items-center gap-1">{p.id === game.attackerId ? <Swords size={15} /> : null} {p.id === game.defenderId ? <Shield size={15} /> : null} {p.finished ? <Check size={15} /> : null} {p.hand.length} lá</span></span>
            </div>
          );
        })}
        {/* Hiệu ứng bốc bài: lá bay từ nọc giữa bàn tới góc người bốc */}
        {s.drawFlying && (() => {
          const opps = game.players.filter((p) => p.id !== HUMAN_ID);
          const corner = s.drawFlying.toId === HUMAN_ID ? "bottom" : (() => { const nm = opps.find((p) => p.id === s.drawFlying!.toId)?.name; return nm === "Bot 3" ? "right" : nm === "Bot 2" ? "left" : "top"; })();
          return (
            <div key={s.drawFlying.key} className={`flying-draw flying-draw-${corner}`}>
              {s.drawFlying.toId === HUMAN_ID ? <CardView card={parseCard(s.drawFlying.cardId)} /> : <img src="/durak/cards/back.png" alt="" className="w-[72px] h-[100px] rounded-[10px]" />}
            </div>
          );
        })()}
      </div>
      {/* Khi 1 lá đỡ được nhiều lá tấn: hiện nút chọn lá tấn để đỡ (bàn vẽ bằng canvas nên không bấm trực tiếp được). */}
      {iAmDefender && s.selected && (() => {
        const sel = parseCard(s.selected as string);
        const beatable = game.table.filter((x) => !x.defense && canBeat(x.attack, sel, game.trumpSuit));
        if (beatable.length <= 1) return null;
        return (
          <div className="text-center py-1 shrink-0 bg-black/50">
            <span className="font-semibold text-yellow-200 text-sm mr-2">Dùng {cardLabel(sel)} đỡ lá nào?</span>
            {beatable.map((x) => (
              <button key={x.attack.id} className="bg-yellow-400 text-black font-bold px-3 py-1 rounded-full text-sm mx-1" onClick={() => s.defendPair(x.attack.id, s.selected as string)}>{cardLabel(x.attack)}</button>
            ))}
          </div>
        );
      })()}
      {/* Kéo nút + tay bài lên 190px: viền dưới bàn (660px, đáy ở 610px) nằm đúng giữa lá bài tay mình (tay từ 560-660, giữa 610). */}
      <div className="text-center space-x-2 py-2 shrink-0 relative" style={{ marginTop: -190 }}>
        <button className="bg-white text-black font-semibold px-4 py-2 rounded-full" title="Bấm là tự xếp, bấm lại đổi kiểu" onClick={() => { const next = lastSort === "suit" ? "rank" : "suit"; s.sortHand(next); setLastSort(next); }}><span className="flex items-center gap-1"><ArrowDownWideNarrow size={16} /> Xếp bài</span></button>
        <button className="bg-white text-black font-semibold px-4 py-2 rounded-full disabled:opacity-40" disabled={!(iAmAttacker && allDefended)} onClick={s.finishAttackAction}>Kết thúc đợt</button>
        <button className="bg-red-500 text-white font-bold px-4 py-2 rounded-full disabled:opacity-40" disabled={!(iAmDefender && game.table.length > 0)} onClick={s.takeCards}>Lên bài</button>
        <button className="bg-green-500 text-white font-bold px-4 py-2 rounded-full disabled:opacity-40" disabled={!(game.phase === "DRAWING" && game.pendingDraw[0] === HUMAN_ID && !s.drawing)} onClick={s.drawCards}>Bốc bài</button>
      </div>
      <div className="flex justify-center items-center flex-wrap shrink-0 px-2 pb-2 gap-2">
        <div className="relative shrink-0" style={iAmDefender && isDefending ? { padding: 3, borderRadius: "50%", background: `conic-gradient(#facc15 ${defendFraction * 100}%, rgba(255,255,255,0.2) 0)`, boxShadow: "0 0 16px rgba(250,204,21,0.9)" } : undefined}>
          {/* Bong bóng chat của mình: hiện trên avatar, không cần mở hội thoại. */}
          {bubble && (
            <div key={bubble.key} className="absolute bottom-full left-0 mb-2 z-50 max-w-[220px] bg-white text-black text-sm font-medium px-3 py-2 rounded-2xl rounded-bl-sm shadow-lg break-words">{bubble.text}</div>
          )}
          {/* Đồng hồ góc trên trái avatar khi đến lượt mình đánh/đỡ. */}
          {((iAmDefender && isDefending) || myAttackTurn) && (
            <span className="absolute -top-2 -left-2 z-50 bg-black/85 text-yellow-300 font-black text-xs px-2 py-1 rounded-full border border-yellow-400 flex items-center gap-1 shadow"><Timer size={13} /> {iAmDefender && isDefending ? defendSeconds : seconds}s</span>
          )}
          <div className="tan-avatar" style={{ width: 100, height: 100, fontSize: 36 }}>{(s.playerName.trim() || "B").charAt(0).toUpperCase()}</div>
          {iAmDefender && isDefending && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-400 text-black font-black text-[11px] px-1.5 rounded-full border border-white">{defendSeconds}s</span>}
        </div>
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
            <span className="flex items-center gap-1"><MessageCircle size={16} /> Chat trong ván</span>
            <button onClick={() => setChatOpen(false)} aria-label="Đóng chat"><X size={18} /></button>
          </div>
          <div className="h-56 overflow-auto p-3 space-y-2 text-sm">
            {s.chat.map((m) => (
              <div key={m.id} className={m.from === (s.playerName.trim() || "Bạn") ? "text-right" : ""}>
                <span className="text-yellow-300 text-xs font-semibold">{m.from}: </span>
                <span>{m.text}</span>
              </div>
            ))}
          </div>
          <form className="flex gap-2 p-2 border-t border-white/20" onSubmit={(e) => { e.preventDefault(); const msg = chatText.trim(); if (msg) { s.sendChat(msg); setBubble({ text: msg, key: Date.now() }); } setChatText(""); }}>
            <input className="flex-1 min-w-0 text-black px-3 py-2 rounded-full text-sm" placeholder="Nhắn trong ván này…" value={chatText} onChange={(e) => setChatText(e.target.value)} />
            <button className="bg-yellow-400 text-black font-bold px-4 rounded-full text-sm" type="submit">Gửi</button>
          </form>
          <p className="text-center text-white/50 text-xs pb-2">Thoát ván là mất chat, không lưu lại.</p>
        </div>
      )}
      {settingsOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-80 max-w-[92vw] bg-red-900 border border-yellow-400 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-3"><h2 className="font-bold text-lg flex items-center gap-2"><Settings size={18} /> Cài đặt âm thanh</h2><button onClick={() => setSettingsOpen(false)} aria-label="Đóng cài đặt"><X size={18} /></button></div>
            <label className="flex items-center gap-2 mb-3 cursor-pointer"><input type="checkbox" checked={soundOn} onChange={(e) => { setSoundOn(e.target.checked); setSoundEnabled(e.target.checked); }} /> Bật âm thanh</label>
            <label className="block text-sm mb-1">Âm lượng: {soundVol}%</label>
            <input className="w-full mb-3" type="range" min={0} max={100} value={soundVol} onChange={(e) => { const v = Number(e.target.value); setSoundVol(v); setSoundVolume(v / 100); }} />
            <div className="flex gap-2">
              <button className="flex-1 bg-yellow-400 text-black font-bold px-3 py-2 rounded-full text-sm" onClick={() => playDealSound()}><span className="flex items-center justify-center gap-1"><Volume2 size={16} /> Thử phát bài</span></button>
              <button className="flex-1 bg-yellow-400 text-black font-bold px-3 py-2 rounded-full text-sm" onClick={() => playCardSound()}><span className="flex items-center justify-center gap-1"><Volume2 size={16} /> Thử ra lá</span></button>
            </div>
            <p className="text-white/60 text-xs mt-3">Âm phát bài kêu khi bắt đầu ván mới, âm ra lá kêu mỗi khi có lá đánh lên bàn. Âm rút bài cũng có tiếng xẹt nhẹ.</p>
          </div>
        </div>
      )}
      {game.phase === "FINISHED" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="max-w-xl mx-4 bg-red-900 border border-yellow-400 rounded-2xl p-6 text-center">
            <img src={game.loserId === HUMAN_ID ? "/durak/ui/you_lose.png" : "/durak/ui/you_won.png"} alt="Kết quả" className="w-48 mx-auto mb-3" />
            <h2 className="text-xl font-bold">Kết quả</h2>
            <p>Người thua: <b>{game.players.find((p) => p.id === game.loserId)?.name}</b></p>
            <p>Thứ tự hoàn thành: {game.finishOrder.map((id) => game.players.find((p) => p.id === id)?.name).join(" → ") || "—"}</p>
            <button className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-full mt-3" onClick={s.backToLobby}>Về sảnh</button>
          </div>
        </div>
      )}
    </div>
  );
}
