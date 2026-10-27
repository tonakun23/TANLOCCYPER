import { useEffect, useRef, useState } from "react";
import { useGameStore } from "./store";
import { CardView } from "./components/CardView";
import { TableCanvas } from "./components/TableCanvas";
import { parseCard, SUIT_NAME, SUIT_SYMBOL, canBeat, canAttackCard, cardLabel } from "../../../packages/game-core/src/engine";
import { TABLE_LEVELS, formatCoins, minBalance, formatBalanceShort, liveTakeTotals, START_BALANCE } from "../../../packages/game-core/src/coins";
import { X, Users, HelpCircle, Settings, UserPlus, Trophy, Gift, ClipboardList, Backpack, Home, MessageCircle, Timer, Minus, Plus, Swords, Shield, Check, Volume2, Crown, LogOut, Heart, Search, Maximize, Minimize, } from "lucide-react";
import { playDealSound, playCardSound, playTrumpAceSound, playAttackSound, playDefendSound, setSoundEnabled, setSoundVolume } from "./game/sound";
const ic = { size: 22, strokeWidth: 2 };
// Bảng hạng phòng (kiểu ảnh mẫu): mỗi hạng là một khoảng mức cược, phòng thật nào cũng rơi đúng 1 hạng.
const ROOM_TIERS = [
  { id: "tap-su", name: "Tập Sự", max: 100_000 },
  { id: "nghiep-du", name: "Nghiệp Dư", max: 500_000 },
  { id: "chuyen-nghiep", name: "Chuyên Nghiệp", max: 2_000_000 },
  { id: "master", name: "Master", max: Infinity },
];
function parseBet(bet: string | number): number {
  if (typeof bet === "number") return bet;
  const m = String(bet).trim().match(/^([\d.,]+)\s*([KM]?)$/i);
  if (!m) return 0;
  const v = parseFloat(m[1].replace(/,/g, ""));
  return m[2].toUpperCase() === "M" ? v * 1_000_000 : m[2].toUpperCase() === "K" ? v * 1_000 : v;
}
function tierOf(bet: string | number): string {
  const v = parseBet(bet);
  for (const t of ROOM_TIERS) if (v <= t.max) return t.id;
  return "master";
}
// Khung ván co lại trên điện thoại: màn ván thiết kế ở 1152x648; chỉ khi điện
// thoại xoay ngang (con trỏ thô + cao màn hình < 500px) mới co khung vừa màn
// hình, desktop giữ nguyên không đổi. Tọa độ đo bằng getBoundingClientRect là
// px màn hình, phải đổi sang px khung trước khi đặt overlay nằm trong khung.
const STAGE_W = 1152, STAGE_H = 648;
function gameStage(): { phone: boolean; scale: number; left: number; top: number } {
  if (typeof window === "undefined") return { phone: false, scale: 1, left: 0, top: 0 };
  const phone = window.matchMedia("(pointer: coarse)").matches && window.innerHeight < 500;
  const scale = phone ? Math.min(1, window.innerWidth / STAGE_W, window.innerHeight / STAGE_H) : 1;
  return { phone, scale, left: (window.innerWidth - STAGE_W * scale) / 2, top: (window.innerHeight - STAGE_H * scale) / 2 };
}

// Vòng quay SPIN kiểu ảnh Tony gửi: vành đỏ đậm + đinh vàng + chữ SPIN vàng.
// 8 ô (bản thử: chỉ hiện kết quả, chưa cộng xu — chờ chốt luật thưởng).
const SPIN_PRIZES = ["10K", "1M", "50K", "2M", "100K", "500K", "200K", "Lần sau"];
function spinPolar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function SpinWheel({ rot, onHubClick }: { rot: number; onHubClick: () => void }) {
  const CX = 200, CY = 200, R = 172;
  return (
    <svg viewBox="0 0 400 400" style={{ width: "100%", height: "auto", display: "block" }}>
      <circle cx={CX} cy={CY} r={198} fill="#450A0A" />
      <circle cx={CX} cy={CY} r={198} fill="none" stroke="#FACC15" strokeWidth={3} />
      {Array.from({ length: 16 }, (_, k) => {
        const [x, y] = spinPolar(CX, CY, 186, k * 22.5);
        return <circle key={k} cx={x} cy={y} r={7} fill="#FACC15" stroke="#92400E" strokeWidth={1.5} />;
      })}
      <g style={{ transform: `rotate(${rot}deg)`, transformOrigin: "200px 200px", transition: "transform 5s cubic-bezier(0.15, 0.9, 0.25, 1)" }}>
        <circle cx={CX} cy={CY} r={R} fill="#991B1B" />
        {SPIN_PRIZES.map((_, i) => {
          const [x0, y0] = spinPolar(CX, CY, R, i * 45);
          const [x1, y1] = spinPolar(CX, CY, R, (i + 1) * 45);
          const [sx, sy] = spinPolar(CX, CY, R, i * 45);
          return (
            <g key={i}>
              <path d={`M ${CX} ${CY} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`} fill={i % 2 === 0 ? "#991B1B" : "#B91C1C"} />
              <line x1={CX} y1={CY} x2={sx} y2={sy} stroke="#FACC15" strokeWidth={2} />
            </g>
          );
        })}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#FACC15" strokeWidth={3} />
        {SPIN_PRIZES.map((p, i) => (
          <g key={i} transform={`rotate(${i * 45 + 22.5} ${CX} ${CY})`}>
            <text x={CX} y={CY - 108} textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize={p === "Lần sau" ? 15 : 21} fontWeight={900} fill="#FDE68A">{p}</text>
          </g>
        ))}
      </g>
      <g onClick={onHubClick} style={{ cursor: "pointer" }}>
        <circle cx={CX} cy={CY} r={52} fill="#FACC15" stroke="#92400E" strokeWidth={3} />
        <text x={CX} y={CY + 8} textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize={21} fontWeight={900} fill="#7F1D1D">SPIN</text>
      </g>
      <polygon points="200,2 182,36 218,36" fill="#FACC15" stroke="#92400E" strokeWidth={2} />
    </svg>
  );
}

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
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [followSeconds, setFollowSeconds] = useState(5);
  const [joinCode, setJoinCode] = useState("");
  const [roomTier, setRoomTier] = useState("tap-su");
  const [starting, setStarting] = useState<null | { step: "count" | "deal" | "trump" | "move"; count: number; deal: number }>(null);
  const [firstEffect, setFirstEffect] = useState(false);
  const [guestError, setGuestError] = useState("");
  const [guestBusy, setGuestBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [spinOpen, setSpinOpen] = useState(false);
  const [spinRot, setSpinRot] = useState(0);
  const [spinBusy, setSpinBusy] = useState(false);
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [stage, setStage] = useState(gameStage);
  useEffect(() => {
    const update = () => setStage(gameStage());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("orientationchange", update); };
  }, []);
  // Màn CHƠI NGAY: tải bảng phòng thật, làm mới mỗi 5 giây khi đang ở màn này.
  useEffect(() => {
    if (s.screen !== "rooms") return;
    void s.loadPublicRooms();
    const id = setInterval(() => { void s.loadPublicRooms(); }, 5000);
    return () => clearInterval(id);
  }, [s.screen]);
  // Màn Bạn bè / Xếp hạng: tải bảng phòng thật, làm mới mỗi 5 giây khi đang ở 2 màn này (để thấy bạn đang mở phòng / người đang chơi).
  useEffect(() => {
    if (s.screen !== "friends" && s.screen !== "ranks") return;
    void s.loadPublicRooms();
    const id = setInterval(() => { void s.loadPublicRooms(); }, 5000);
    return () => clearInterval(id);
  }, [s.screen]);
  // Full màn hình trên điện thoại (nút ở header ván đấu): Android xin được, iPhone Apple chặn nên chỉ đường cài app mới full thật.
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const update = () => setIsFullscreen(!!document.fullscreenElement);
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch { /* bỏ qua */ } return; }
    const el = document.documentElement as unknown as { requestFullscreen?: () => Promise<void> };
    if (el.requestFullscreen) { try { await el.requestFullscreen(); } catch { s.addLog("Không xin được full màn, thử cài app ra màn hình chính."); } }
    else s.addLog("Máy này không cho web tự full màn: thêm game vào Màn hình chính rồi mở bằng icon đó là full màn thật.");
  };
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
  const myId = s.myId;
  // Online: ván đầu tiên (version 1) thì chạy đếm + phát bài + chọn chủ như ván bot.
  useEffect(() => {
    if (s.onlineMode && game && game.version === 1 && !starting) setStarting({ step: "count", count: 3, deal: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.version, s.onlineMode]);
  // Rời màn ván đấu thì xóa đếm/phát bài cũ, tránh lọt sang ván sau.
  useEffect(() => { if (s.screen !== "game") setStarting(null); }, [s.screen]);
  // Về nhất: hiện hiệu ứng 4 giây rồi ẩn, vương miện số 1 vẫn ở lại trên avatar.
  const isFirst = !!game && game.finishOrder[0] === myId;
  useEffect(() => {
    if (!isFirst) return;
    setFirstEffect(true);
    const id = setTimeout(() => setFirstEffect(false), 4000);
    return () => clearTimeout(id);
  }, [isFirst]);
  // Lên bài: hiệu ứng bay vào tay mình xong thì dọn.
  useEffect(() => {
    if (!s.takeAnimCards) return;
    const id = setTimeout(() => s.clearTakeAnim(), s.takeAnimCards.length * 150 + 900);
    return () => clearTimeout(id);
  }, [s.takeAnimCards]);
  // Bắt đầu ván: đếm 3-2-1-Bắt đầu -> phát bài lần lượt -> chọn chất chủ, rồi mới hiện bàn.
  useEffect(() => {
    if (!starting) return;
    if (starting.step === "count") {
      const id = setTimeout(() => setStarting((v) => v ? (v.count > 1 ? { ...v, count: v.count - 1 } : { step: "deal", count: 0, deal: 0 }) : null), 700);
      return () => clearTimeout(id);
    }
    if (starting.step === "deal") {
      const id = setTimeout(() => setStarting((v) => v ? (v.deal >= (game?.players.length || 4) * 8 ? { step: "trump", count: 0, deal: v.deal } : { ...v, deal: v.deal + 1 }) : null), 120);
      return () => clearTimeout(id);
    }
    if (starting.step === "trump") {
      const id = setTimeout(() => setStarting((v) => v ? { ...v, step: "move" } : null), 2000);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setStarting(null), 1000);
    return () => clearTimeout(id);
  }, [starting]);
  // Bước bay nọc: đo vị trí nọc thật trên canvas (cùng công thức TableCanvas)
  // để đáp đúng góc trên trái của bàn; không đo được thì đáp góc trái màn hình.
  const [stockTarget, setStockTarget] = useState<{ dx: number; dy: number } | null>(null);
  const [stockMoved, setStockMoved] = useState(false);
  useEffect(() => {
    if (starting?.step !== "move") { if (!starting) { setStockTarget(null); setStockMoved(false); } return; }
    let tx = 28, ty = 180;
    const canvas = document.querySelector(".tan-table-canvas canvas") as HTMLCanvasElement | null;
    if (canvas) {
      const r = canvas.getBoundingClientRect();
      const w = r.width, h = r.height;
      const cx = w / 2, cy = h / 2 + 20;
      const rx = Math.min(620, w * 0.49), ry = Math.max(60, h / 2 - 100);
      tx = r.left + (cx - rx + 16); ty = r.top + (cy - ry + 16);
    }
    const st = gameStage();
    setStockTarget({ dx: (tx - window.innerWidth / 2) / st.scale + 32, dy: (ty - window.innerHeight / 2) / st.scale + 44 });
    const id = setTimeout(() => setStockMoved(true), 60);
    return () => clearTimeout(id);
  }, [starting]);
  const startBotGame = () => { s.setPlayerCount(4); s.startGame(); setStarting({ step: "count", count: 3, deal: 0 }); };
  // A chủ ra bàn: phát âm thanh dồn riêng, bất kể người đánh là mình hay bot.
  useEffect(() => {
    if (!s.flying || !game) return;
    const c = parseCard(s.flying.cardId);
    if (c.rank === 14 && c.suit === game.trumpSuit) playTrumpAceSound();
  }, [s.flying, game]);
  const me = game?.players.find((p) => p.id === myId);
  // Xu live trong ván: số dư dưới avatar = số dư vào ván + tổng tiền tấn bị ôm
  // tính từ takeLog (không chờ quyết toán cuối ván). Sau khi quyết toán thì lấy
  // số dư chốt từ settlement cho người có trong bảng (bot không có số dư chốt).
  const balanceFor = (p: { id: string; name: string }): number => {
    if (!game) return START_BALANCE;
    const row = s.settlement?.rows.find((r) => r.id === p.id);
    if (s.settlement && row?.balanceAfter != null) return row.balanceAfter;
    const level = s.onlineMode ? (s.onlineRoom?.level || 50_000) : s.tableLevel;
    const totals = liveTakeTotals(level, game.takeLog || []);
    const entry = s.onlineMode
      ? (s.onlineRoom?.players.find((x) => x.name === p.name)?.balance ?? START_BALANCE)
      : (p.id === myId ? s.balance : START_BALANCE);
    return entry + (totals[p.id] ?? 0);
  };
  // Bay số tiền ăn/thua mỗi lần có lượt lên bài mới trong takeLog (hiện ~3.5 giây).
  const [coinFloats, setCoinFloats] = useState<{ key: number; playerId: string; amount: number }[]>([]);
  const takeLogRef = useRef<{ nonce: number; len: number }>({ nonce: -1, len: 0 });
  useEffect(() => {
    if (!game) return;
    if (takeLogRef.current.nonce !== s.gameNonce) { takeLogRef.current = { nonce: s.gameNonce, len: game.takeLog?.length || 0 }; return; }
    const len = game.takeLog?.length || 0;
    if (len <= takeLogRef.current.len) return;
    const level = s.onlineMode ? (s.onlineRoom?.level || 50_000) : s.tableLevel;
    const floats: { key: number; playerId: string; amount: number }[] = [];
    for (let i = takeLogRef.current.len; i < len; i++) {
      const t = game.takeLog[i];
      const totals = liveTakeTotals(level, [t]);
      for (const [pid, amt] of Object.entries(totals)) if (amt !== 0) floats.push({ key: Date.now() + i * 100 + floats.length, playerId: pid, amount: amt });
    }
    takeLogRef.current.len = len;
    if (!floats.length) return;
    setCoinFloats((prev) => [...prev, ...floats]);
    const id = setTimeout(() => setCoinFloats((prev) => prev.filter((f) => !floats.some((x) => x.key === f.key))), 3500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.takeLog?.length, s.gameNonce]);
  // Hiệu ứng tấn/đỡ trên lá bài vừa đánh: tìm cặp chứa lá flying trong bàn,
  // tấn thì kiếm đan chéo vàng, đỡ thì khiên xanh, kèm tiếng kiếm/khiên.
  // Vị trí tính từ canvas bàn (cùng công thức TableCanvas) rồi đổi sang tọa độ màn hình.
  const [playFx, setPlayFx] = useState<null | { key: number; kind: "attack" | "defend"; x: number; y: number }>(null);
  const playFxKeyRef = useRef(0);
  useEffect(() => {
    if (!s.flying || !game) return;
    if (s.flying.key === playFxKeyRef.current) return;
    playFxKeyRef.current = s.flying.key;
    let kind: "attack" | "defend" | null = null;
    let idx = -1;
    game.table.forEach((pair, i) => {
      if (pair.attack.id === s.flying!.cardId) { kind = "attack"; idx = i; }
      else if (pair.defense?.id === s.flying!.cardId) { kind = "defend"; idx = i; }
    });
    if (!kind || idx < 0) return;
    const canvas = document.querySelector(".tan-table-canvas canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const w = r.width, h = r.height;
    const cx = w / 2, cy = h / 2 + 20;
    const totalW = game.table.length * 90;
    const x = cx + 50 - totalW / 2 + idx * 90 + (kind === "defend" ? 20 : 0);
    const y = kind === "defend" ? cy - 12 : cy - 30;
    const st = gameStage();
    const fx = { key: s.flying.key, kind, x: (r.left + x + 32 - st.left) / st.scale, y: (r.top + y + 44 - st.top) / st.scale };
    setPlayFx(fx);
    if (fx.kind === "attack") playAttackSound(); else playDefendSound();
    const id = setTimeout(() => setPlayFx((v) => (v?.key === fx.key ? null : v)), 1200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.flying]);
  // Ván bot kết thúc: bỏ popup kết quả, quyết toán xong là đếm 3-2-1 vào ván mới luôn.
  // Chỉ thử 1 lần mỗi ván (tránh lặp nếu startGame từ chối vì không đủ xu vào bàn).
  const rematchTriedRef = useRef(-1);
  useEffect(() => {
    if (s.onlineMode || !game || game.phase !== "FINISHED") return;
    if (s.settledNonce !== s.gameNonce) return;
    if (rematchTriedRef.current === s.gameNonce) return;
    rematchTriedRef.current = s.gameNonce;
    startBotGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, s.settledNonce, s.gameNonce, s.onlineMode]);
  // Bốc bài: tới lượt mình thì chỉ có 3 giây tự bấm, hết 3 giây hệ thống tự bốc.
  const isMyDrawTurn = !!game && game.phase === "DRAWING" && game.pendingDraw[0] === myId && !s.drawing;
  const [drawSeconds, setDrawSeconds] = useState(3);
  useEffect(() => { if (isMyDrawTurn) setDrawSeconds(3); }, [isMyDrawTurn]);
  useEffect(() => {
    if (!isMyDrawTurn) return;
    if (drawSeconds <= 0) { void s.drawCards(); return; }
    const id = setTimeout(() => setDrawSeconds((v) => v - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyDrawTurn, drawSeconds]);
  const iAmDefender = game?.defenderId === myId;
  const iAmAttacker = game?.attackerId === myId;
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
        if (game && game.defenderId === myId) s.takeCards();
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
        if (game) s.autoLowestAttack();
        return 30;
      }
      return v - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [myAttackTurn, game, allDefended, s]);

  // Cửa sổ theo 5s: đếm ngược, hết giờ thì theo đúng chế độ (lên bài -> lên thật, thêm bài -> bỏ qua theo).
  const followKey = s.followWindow?.key;
  useEffect(() => {
    if (!followKey) return;
    setFollowSeconds(5);
    const id = setInterval(() => setFollowSeconds((v) => {
      if (v <= 1) { useGameStore.getState().passFollow(); return 5; }
      return v - 1;
    }), 1000);
    return () => clearInterval(id);
    // Chỉ reset khi cửa sổ theo mới mở (key mới), không reset khi store đổi khác (notice, v.v.).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followKey]);
  const trumpMarker: Record<string, string> = { S: "spades", C: "clubs", H: "hearts", D: "diamonds" };
  // Màn Tạo phòng (ảnh mẫu): slider mức xu, chọn số người, nút TẠO PHÒNG.
  // 8 mức xu theo spec (50K–10M), vào bàn cần 10 lần mức bàn.
  const BET_LEVELS = TABLE_LEVELS.map((v) => formatCoins(v));
  const [betIdx, setBetIdx] = useState(0);
  const [createCount, setCreateCount] = useState(4);
  const createLevel = TABLE_LEVELS[betIdx];
  const canAffordCreate = s.balance >= minBalance(createLevel);
  const submitCreateRoom = () => {
    if (!canAffordCreate) return;
    // Chơi với bạn / tạo phòng: KHÔNG bot, tạo phòng thật qua WebSocket, mã phòng hiện giữa bàn chờ.
    s.onlineCreateRoom(createLevel, createCount, !s.createPrivate);
  };
  const homeTop = (
    <div className="tan-top">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {s.googleUser?.avatar ? <img src={s.googleUser.avatar} alt="" className="tan-avatar" style={{ objectFit: "cover" }} /> : <div className="tan-avatar">{(s.playerName.trim() || "B").charAt(0).toUpperCase()}</div>}
        <div>
          <input className="bg-transparent font-bold outline-none" style={{ fontSize: "clamp(14px, 3.2vh, 22px)", width: 140 }} value={s.playerName} onChange={(e) => s.setPlayerName(e.target.value)} aria-label="Tên của bạn" />
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>TẤN ONLINE · VN-8 · 2–4 người</div>
        </div>
      </div>
      <div className="tan-shop">
        <span className="tan-coins"><img src="/icons/chip-xu.svg" alt="Xu" style={{ width: "min(7vh, 44px)", height: "min(7vh, 44px)" }} /> {s.balance.toLocaleString("vi-VN")}</span>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button className="tan-icon" onClick={s.goToFriends} aria-label="Bạn bè"><Users {...ic} /></button>
        <button className="tan-icon" aria-label="Hướng dẫn luật chơi" onClick={() => setHelpOpen(true)}><HelpCircle {...ic} /></button>
        <button className="tan-icon" aria-label="Cài đặt âm thanh" onClick={() => setSettingsOpen(true)}><Settings {...ic} /></button>
        {s.googleUser && <button className="tan-icon" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => void s.googleLogout()}><LogOut {...ic} /></button>}
      </div>
    </div>
  );
  // Vòng quay SPIN (bản thử: quay + hiện kết quả, chưa cộng xu — chờ chốt luật thưởng).
  const spinWheel = () => {
    if (spinBusy) return;
    setSpinBusy(true); setSpinResult(null);
    const seg = Math.floor(Math.random() * 8);
    const mid = seg * 45 + 22.5;
    setSpinRot((prev) => prev - (prev % 360) + 360 * 5 + (360 - mid));
    window.setTimeout(() => { setSpinResult(SPIN_PRIZES[seg]); setSpinBusy(false); }, 5100);
  };
  const homeBottom = (
    <div className="tan-bottom">
      <div className="tan-bottom-group">
        <button className="tan-bottom-btn" onClick={s.goToFriends} aria-label="Bạn bè"><span className="circle"><UserPlus {...ic} /></span></button>
        <button className="tan-bottom-btn" onClick={s.goToRanks} aria-label="Xếp hạng"><span className="circle"><Trophy {...ic} /></span></button>
        <button className="tan-bottom-btn" style={{ cursor: "default" }}><span className="circle"><Gift {...ic} /></span><span className="tan-badge">10</span></button>
        <button className="tan-bottom-btn" onClick={() => setHistoryOpen(true)} aria-label="Lịch sử xu"><span className="circle"><ClipboardList {...ic} /></span></button>
      </div>
      <button className="tan-spin" onClick={() => setSpinOpen(true)} aria-label="Vòng quay">SPIN</button>
      <div className="tan-bottom-group">
        <button className="tan-bottom-btn" style={{ cursor: "default" }}><span className="circle">f</span></button>
        <button className="tan-bottom-btn" style={{ cursor: "default" }}><span className="circle"><Users {...ic} /></span></button>
        <button className="tan-bottom-btn" style={{ cursor: "default" }}><span className="circle"><Backpack {...ic} /></span></button>
        <button className="tan-choose flex items-center justify-center" onClick={() => { setSearchOpen(true); void s.loadPublicRooms(); }} aria-label="Tìm phòng"><Search size={28} /></button>
      </div>
    </div>
  );
  if (s.screen === "create") {
    const pct = BET_LEVELS.length > 1 ? (betIdx / (BET_LEVELS.length - 1)) * 100 : 0;
    return (
      <div className="tan-home h-screen w-screen overflow-hidden text-white flex flex-col">
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
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <button className="tan-icon" style={{ background: "#9f1239", marginRight: 16 }} onClick={() => setBetIdx((v) => Math.max(0, v - 1))} aria-label="Giảm mức điểm"><Minus size={22} /></button>
              <div style={{ flex: 1, position: "relative", height: 40, display: "flex", alignItems: "center", cursor: "grab", touchAction: "none", userSelect: "none" }}
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); const r = e.currentTarget.getBoundingClientRect(); const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); setBetIdx(Math.round(ratio * (BET_LEVELS.length - 1))); }}
                onPointerMove={(e) => { if (e.buttons !== 1) return; const r = e.currentTarget.getBoundingClientRect(); const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); setBetIdx(Math.round(ratio * (BET_LEVELS.length - 1))); }}>
                <div style={{ position: "absolute", left: 0, right: 0, height: 10, borderRadius: 99, background: "rgba(0,0,0,.6)" }} />
                <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: 10, borderRadius: 99, background: "#f59e0b" }} />
                <img src="/icons/chip-gold.png" alt="Chip" draggable={false} style={{ position: "absolute", left: `calc(${pct}% - 20px)`, width: 40, height: 40, pointerEvents: "none" }} />
              </div>
              <button className="tan-icon" style={{ background: "#9f1239" }} onClick={() => setBetIdx((v) => Math.min(BET_LEVELS.length - 1, v + 1))} aria-label="Tăng mức điểm"><Plus size={22} /></button>
            </div>
            <p style={{ textAlign: "center", color: "rgba(255,255,255,.7)", fontSize: 13, marginTop: 8 }}>Tối thiểu vào phòng: {formatCoins(minBalance(createLevel))} xu · Xu chỉ là điểm thưởng, không tiền thật{!canAffordCreate ? ` · Bạn có ${s.balance.toLocaleString("vi-VN")} xu, chưa đủ vào mức này` : ""}</p>
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
          <button className="tan-pill" style={{ background: canAffordCreate ? "#2f9e8f" : "rgba(255,255,255,.25)", color: "#fff", fontSize: "clamp(15px, 3.4vh, 22px)" }} disabled={!canAffordCreate} onClick={submitCreateRoom}>TẠO PHÒNG</button>
        </div>
      </div>
    );
  }
  if (s.screen === "rooms") {
    const tierRooms = s.publicRooms.filter((r) => tierOf(r.bet) === roomTier);
    return (
      <div className="tan-home h-screen w-screen overflow-hidden text-white flex flex-col">
        {/* Đầu màn kiểu ảnh mẫu: X trái, CHƠI NGAY + TẠO PHÒNG giữa, Home phải. */}
        <div className="tan-rooms-top">
          <button className="tan-icon" onClick={s.backToLobby} aria-label="Đóng"><X size={22} /></button>
          <div style={{ margin: "0 auto", display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <button className="tan-pill orange" onClick={() => s.onlineCreateRoom(50_000, 4, true)}>CHƠI NGAY</button>
            <button className="tan-pill green" onClick={() => s.goToCreate(false)}>TẠO PHÒNG</button>
            <button className="tan-pill" style={{ background: "#7c3aed", color: "#fff" }} onClick={startBotGame}>CHƠI VỚI BOT</button>
          </div>
          <button className="tan-icon" onClick={s.backToLobby} aria-label="Về trang chủ"><Home {...ic} /></button>
        </div>
        {/* Hàng phụ gọn 1 dòng: nhập mã phòng + mức bàn bot + làm mới (bảng vẫn chiếm gần hết màn hình). */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px min(2vw, 20px) 0" }}>
          <input className="text-white bg-black/30 placeholder:text-white/50 px-4 py-2 rounded-full font-bold outline-none" style={{ width: 210 }} placeholder="Nhập mã phòng 6 số" value={joinCode} onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          <button className="tan-pill green" disabled={joinCode.length !== 6} style={{ opacity: joinCode.length === 6 ? 1 : 0.5, fontSize: 14, padding: "8px 18px" }} onClick={() => s.onlineJoinRoom(joinCode)}>Vào phòng</button>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,.75)" }}>Số dư: <b style={{ color: "#ffd97a" }}>{s.balance.toLocaleString("vi-VN")} xu</b></span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,.75)" }}>Mức bàn bot:</span>
            {TABLE_LEVELS.map((lv) => {
              const afford = s.balance >= minBalance(lv);
              const selected = s.tableLevel === lv;
              return (
                <button key={lv} disabled={!afford} onClick={() => s.setTableLevel(lv)} style={{ padding: "6px 12px", borderRadius: 999, fontWeight: 800, fontSize: 13, border: selected ? "2px solid #facc15" : "1px solid rgba(255,255,255,.3)", background: selected ? "#f59e0b" : "rgba(0,0,0,.3)", color: afford ? "#fff" : "rgba(255,255,255,.35)", cursor: afford ? "pointer" : "default" }}>
                  {formatCoins(lv)}
                </button>
              );
            })}
          </div>
          <button className="tan-pill" style={{ background: "rgba(255,255,255,.15)", fontSize: 13, padding: "6px 14px", marginLeft: "auto" }} onClick={() => void s.loadPublicRooms()}>Làm mới</button>
        </div>
        {/* Bảng full màn kiểu thiết kế cũ (.tan-table/.tan-head/.tan-row/.tan-join trong styles.css). */}
        <div className="tan-table">
          <div className="tan-head"><span>Phòng</span><span>Mức cược</span><span>Số người</span><span>Tối thiểu</span><span>Trạng thái</span></div>
          <div className="tan-list">
            {tierRooms.length === 0 ? (
              <p style={{ color: "rgba(255,255,255,.6)", fontSize: 14, textAlign: "center", padding: "20px 14px", margin: 0 }}>{s.publicRooms.length === 0 ? "Chưa có phòng nào đang mở. Bấm CHƠI NGAY hoặc TẠO PHÒNG để mở phòng đầu tiên, rồi chờ người khác bấm vào chơi cùng." : `Chưa có phòng ${ROOM_TIERS.find((t) => t.id === roomTier)?.name} nào đang mở, thử xem tab khác.`}</p>
            ) : tierRooms.map((r) => {
              const full = r.playerCount >= r.maxPlayers;
              return (
                <div key={r.code} className="tan-row" style={{ padding: "min(2.2vh, 16px) 0" }}>
                  <span className="tan-room-id">{r.code}<span style={{ display: "block", fontSize: 11, fontWeight: 400, color: "rgba(255,255,255,.65)" }}>Chủ phòng: {r.hostName}</span></span>
                  <span className="tan-bet">{r.bet}</span>
                  <span className="tan-hearts">{Array.from({ length: r.maxPlayers }, (_, i) => (<Heart key={i} size={20} color="#dc2626" fill={i < r.playerCount ? "#dc2626" : "transparent"} opacity={i < r.playerCount ? 1 : 0.3} />))}</span>
                  <span className="tan-min">{formatCoins(parseBet(r.bet) * 10)}</span>
                  {full ? (
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>Đã đủ</span>
                  ) : (
                    <button className="tan-join" onClick={() => s.onlineJoinRoom(r.code)}>Tham gia</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {/* Chân màn kiểu ảnh mẫu: avatar + tên + xu trái, 4 tab hạng phải. */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "10px min(2vw, 20px) 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {s.googleUser?.avatar ? <img src={s.googleUser.avatar} alt="" className="tan-avatar" style={{ objectFit: "cover", width: 44, height: 44, fontSize: 18 }} /> : <div className="tan-avatar" style={{ width: 44, height: 44, fontSize: 18 }}>{(s.playerName.trim() || "B").charAt(0).toUpperCase()}</div>}
            <div>
              <div style={{ fontWeight: 800 }}>{s.playerName.trim() || "Bạn"}</div>
              <div style={{ color: "#ffd97a", fontWeight: 800, fontSize: 14 }}>{s.balance.toLocaleString("vi-VN")}</div>
            </div>
          </div>
          <div className="tan-tabs" style={{ marginLeft: "auto" }}>
            {ROOM_TIERS.map((t) => {
              const count = s.publicRooms.filter((r) => tierOf(r.bet) === t.id).length;
              const active = roomTier === t.id;
              return (
                <button key={t.id} onClick={() => setRoomTier(t.id)} className={active ? "tan-tab active" : "tan-tab"}>{t.name} ({count})</button>
              );
            })}
          </div>
        </div>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,.5)", fontSize: 11, paddingBottom: 8, margin: 0 }}>Xu trong Tấn chỉ là điểm thưởng, không nạp/rút hay đổi tiền thật.</p>
      </div>
    );
  }
  if (s.screen === "waiting") {
    const code = s.waitingCode || "------";
    const roomPlayers = s.onlineRoom?.players || [];
    const maxSeats = s.onlineRoom?.maxPlayers || Math.max(2, s.waitingCount);
    const seats = Array.from({ length: maxSeats }, (_, i) => roomPlayers[i] || null);
    const selfRoom = roomPlayers.find((pl) => pl.id === s.onlineMyLobbyId);
    const isHost = !!selfRoom?.isHost;
    return (
      <div className="tan-home h-screen w-screen overflow-hidden text-white flex flex-col">
        <div className="tan-rooms-top">
          <h1 style={{ margin: "0 auto", fontSize: "clamp(20px, 5vh, 34px)", letterSpacing: 1, color: "#fef3c7" }}>{s.waitingMode === "quick" ? "ĐANG TÌM BÀN CHƠI NGAY" : "PHÒNG CHỜ - CHƠI VỚI BẠN"}</h1>
          <button className="tan-icon" onClick={s.backToLobby} aria-label="Về trang chủ"><X size={22} /></button>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 20 }}>
          <div style={{ width: "min(92vw, 560px)", borderRadius: 999, background: "rgba(0,0,0,.35)", border: "2px solid rgba(250,204,21,.6)", padding: "28px 20px", textAlign: "center" }}>
            <div style={{ color: "#ffd97a", fontWeight: 700, marginBottom: 4 }}>Mã phòng (giữa bàn)</div>
            <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: 6, color: "#facc15" }}>{code}</div>
            <button className="bg-yellow-400 text-black font-bold px-5 py-2 rounded-full mt-3" onClick={() => { try { navigator.clipboard?.writeText(code); } catch { /* bỏ qua */ } }}>Sao chép mã phòng</button>
            {s.onlineRoom && s.onlineRoom.level > 0 && (() => { const meRoom = s.onlineRoom!.players.find((pl) => pl.id === s.onlineMyLobbyId); const bal = meRoom ? meRoom.balance : s.balance; return <p style={{ color: "#ffd97a", fontSize: 13, marginTop: 10 }}>Mức bàn: {formatCoins(s.onlineRoom!.level)} · Vào bàn tối thiểu: {formatCoins(minBalance(s.onlineRoom!.level))} xu · Số dư của bạn: {bal.toLocaleString("vi-VN")} xu</p>; })()}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            {seats.map((pl, i) => pl ? (
              <div key={pl.id} style={{ textAlign: "center", width: 110 }}>
                {pl.avatar ? <img src={pl.avatar} alt={pl.name} className="w-[64px] h-[64px] rounded-full mx-auto" /> : <div className="tan-avatar" style={{ margin: "0 auto", width: 64, height: 64, fontSize: 24 }}>{pl.name.charAt(0).toUpperCase()}</div>}
                <div style={{ fontWeight: 700, marginTop: 6 }}>{pl.name}{pl.isHost ? " (chủ phòng)" : ""}</div>
                <div style={{ fontSize: 12, color: pl.online ? "#4ade80" : "#f87171" }}>{pl.online ? "Đang online" : "Mất kết nối"}</div>
                {pl.id !== s.onlineMyLobbyId && (s.friends.some((f) => f.name === pl.name) ? <div style={{ fontSize: 12, color: "#4ade80", marginTop: 4 }}>✓ Bạn bè</div> : <button className="bg-teal-600 text-white font-bold px-3 py-1 rounded-full mt-2" style={{ fontSize: 12 }} onClick={() => s.addFriend(pl.name, pl.avatar)}>Kết bạn</button>)}
              </div>
            ) : (
              <div key={i} style={{ textAlign: "center", width: 110, opacity: 0.7 }}>
                <div className="tan-avatar" style={{ margin: "0 auto", background: "rgba(0,0,0,.4)", color: "rgba(255,255,255,.5)", width: 64, height: 64, fontSize: 24 }}>?</div>
                <div style={{ marginTop: 6 }}>Chờ người chơi…</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>Chưa vào</div>
              </div>
            ))}
          </div>
          {s.onlineError && (
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "#f87171", fontSize: 13 }}>{s.onlineError}</p>
            </div>
          )}
        </div>
      </div>
    );
  }
  if (s.screen === "friends") {
    const myFriendNames = new Set(s.friends.map((f) => f.name));
    const hostRoom = new Map(s.publicRooms.map((r) => [r.hostName, r]));
    return (
      <div className="tan-home h-screen w-screen overflow-hidden text-white flex flex-col">
        <div className="tan-rooms-top">
          <h1 style={{ margin: "0 auto", fontSize: "clamp(20px, 5vh, 34px)", letterSpacing: 1, color: "#fef3c7" }}>BẠN BÈ</h1>
          <button className="tan-icon" onClick={s.goToLobby} aria-label="Về trang chủ"><X size={22} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          <h2 className="font-bold mb-2">Bạn bè của bạn ({s.friends.length})</h2>
          {s.friends.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,.6)", fontSize: 14, marginBottom: 20 }}>Chưa có bạn bè. Kết bạn từ phòng chờ hoặc từ chủ phòng đang mở bên dưới.</p>
          ) : (
            <div className="space-y-2" style={{ marginBottom: 20 }}>
              {s.friends.map((f) => { const room = hostRoom.get(f.name); return (
                <div key={f.name} className="flex items-center gap-3 bg-black/30 rounded-xl px-4 py-2">
                  {f.avatar ? <img src={f.avatar} alt="" className="w-[44px] h-[44px] rounded-full" /> : <div className="tan-avatar" style={{ width: 44, height: 44, fontSize: 18 }}>{f.name.charAt(0).toUpperCase()}</div>}
                  <div className="flex-1"><div className="font-bold">{f.name}</div><div style={{ fontSize: 12, color: room ? "#4ade80" : "rgba(255,255,255,.6)" }}>{room ? `Đang mở phòng ${room.code} · ${room.bet}` : "Ngoại tuyến"}</div></div>
                  {room && <button className="bg-teal-600 text-white font-bold px-4 py-1 rounded-full shrink-0" onClick={() => s.onlineJoinRoom(room.code)}>Tham gia</button>}
                  <button className="text-white/60 font-bold px-2 shrink-0" onClick={() => s.removeFriend(f.name)} aria-label={`Xóa ${f.name}`}><X size={18} /></button>
                </div>); })}
            </div>
          )}
          <h2 className="font-bold mb-2">Đang mở phòng (bấm Kết bạn để thêm)</h2>
          {s.publicRooms.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,.6)", fontSize: 14 }}>Hiện không có phòng công khai nào đang mở.</p>
          ) : (
            <div className="space-y-2">
              {s.publicRooms.map((r) => { const isMe = r.hostName === s.playerName.trim(); const isF = myFriendNames.has(r.hostName); return (
                <div key={r.code} className="flex items-center gap-3 bg-black/30 rounded-xl px-4 py-2">
                  <div className="tan-avatar" style={{ width: 44, height: 44, fontSize: 18 }}>{r.hostName.charAt(0).toUpperCase()}</div>
                  <div className="flex-1"><div className="font-bold">{r.hostName}</div><div style={{ fontSize: 12, opacity: 0.75 }}>Phòng {r.code} · {r.bet} · {r.playerCount}/{r.maxPlayers} người</div></div>
                  {!isMe && (isF ? <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 700 }}>✓ Bạn bè</span> : <button className="bg-teal-600 text-white font-bold px-4 py-1 rounded-full shrink-0" onClick={() => s.addFriend(r.hostName, null)}>Kết bạn</button>)}
                </div>); })}
            </div>
          )}
          <p style={{ color: "rgba(255,255,255,.5)", fontSize: 12, marginTop: 16 }}>Mẹo: trong phòng chờ, bấm Kết bạn cạnh tên người chơi để thêm vào danh sách. Danh sách lưu trên máy này.</p>
        </div>
      </div>
    );
  }
  if (s.screen === "ranks") {
    const myTier = tierOf(s.balance);
    const tierIdx = ROOM_TIERS.findIndex((t) => t.id === myTier);
    const curTier = ROOM_TIERS[tierIdx];
    const prevMax = tierIdx > 0 ? ROOM_TIERS[tierIdx - 1].max : 0;
    const nextTier = ROOM_TIERS[tierIdx + 1];
    const progress = curTier.max === Infinity ? 100 : Math.min(100, Math.max(0, ((s.balance - prevMax) / (curTier.max - prevMax)) * 100));
    const games = s.coinHistory.length;
    const wins = s.coinHistory.filter((h) => (h.perPlayer[h.myId]?.net ?? 0) > 0).length;
    const totalNet = s.coinHistory.reduce((a, h) => a + (h.perPlayer[h.myId]?.net ?? 0), 0);
    return (
      <div className="tan-home h-screen w-screen overflow-hidden text-white flex flex-col">
        <div className="tan-rooms-top">
          <h1 style={{ margin: "0 auto", fontSize: "clamp(20px, 5vh, 34px)", letterSpacing: 1, color: "#fef3c7" }}>XẾP HẠNG</h1>
          <button className="tan-icon" onClick={s.goToLobby} aria-label="Về trang chủ"><X size={22} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          <div className="bg-black/30 rounded-2xl px-5 py-4" style={{ border: "1.5px solid rgba(251,191,36,.6)", marginBottom: 20 }}>
            <div className="flex items-center gap-3">
              {s.googleUser?.avatar ? <img src={s.googleUser.avatar} alt="" className="tan-avatar" style={{ objectFit: "cover" }} /> : <div className="tan-avatar">{(s.playerName.trim() || "B").charAt(0).toUpperCase()}</div>}
              <div className="flex-1">
                <div className="font-black" style={{ fontSize: 20 }}>{s.playerName}</div>
                <div style={{ color: "#ffd97a", fontWeight: 700 }}>{s.balance.toLocaleString("vi-VN")} xu · Hạng {curTier.name}</div>
              </div>
              <Crown size={32} color="#facc15" />
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="flex justify-between" style={{ fontSize: 13, color: "rgba(255,255,255,.75)" }}><span>Tiến trình lên {nextTier ? nextTier.name : "hạng cao nhất"}</span><span>{Math.round(progress)}%</span></div>
              <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,.15)", marginTop: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#fcd34d,#f59e0b)", borderRadius: 999 }} /></div>
              {nextTier && <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", marginTop: 4 }}>Cần hơn {formatCoins(curTier.max)} xu để lên {nextTier.name}.</div>}
            </div>
            <div className="flex gap-4" style={{ marginTop: 12, fontSize: 14 }}>
              <span>Số ván: <b>{games}</b></span>
              <span>Ván lãi: <b>{wins}</b></span>
              <span>Tổng lãi: <b className={totalNet >= 0 ? "text-green-400" : "text-red-400"}>{totalNet > 0 ? "+" : ""}{totalNet.toLocaleString("vi-VN")}</b></span>
            </div>
          </div>
          <h2 className="font-bold mb-2">Các hạng theo xu</h2>
          <div className="tan-table" style={{ margin: 0, marginBottom: 20 }}>
            <div className="tan-head" style={{ gridTemplateColumns: "1fr 1.2fr 1fr" }}><span>Hạng</span><span>Mức xu</span><span>Bạn</span></div>
            {ROOM_TIERS.map((t, i) => { const pMax = i > 0 ? ROOM_TIERS[i - 1].max : 0; const range = t.max === Infinity ? `Trên ${formatCoins(pMax)}` : pMax === 0 ? `≤ ${formatCoins(t.max)}` : `${formatCoins(pMax)} – ${formatCoins(t.max)}`; const isMine = t.id === myTier; return (
              <div key={t.id} className="tan-row" style={{ gridTemplateColumns: "1fr 1.2fr 1fr", background: isMine ? "rgba(250,204,21,.15)" : undefined }}><span style={{ fontWeight: 800 }}>{t.name}</span><span className="tan-bet">{range}</span><span>{isMine ? "Bạn đang ở đây" : ""}</span></div>); })}
          </div>
          <h2 className="font-bold mb-2">Đang chơi (phòng công khai)</h2>
          {s.publicRooms.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,.6)", fontSize: 14 }}>Hiện không có phòng công khai nào đang mở.</p>
          ) : (
            <div className="space-y-2">
              {s.publicRooms.map((r) => (
                <div key={r.code} className="flex items-center gap-3 bg-black/30 rounded-xl px-4 py-2">
                  <div className="tan-avatar" style={{ width: 44, height: 44, fontSize: 18 }}>{r.hostName.charAt(0).toUpperCase()}</div>
                  <div className="flex-1"><div className="font-bold">{r.hostName}</div><div style={{ fontSize: 12, opacity: 0.75 }}>Phòng {r.code} · {r.bet} · {r.playerCount}/{r.maxPlayers} người</div></div>
                </div>))}
            </div>
          )}
        </div>
      </div>
    );
  }
  if (s.screen === "login") {
    return (
      <div className="tan-home h-screen w-screen overflow-hidden text-white relative">
        {/* Adam (trai) va Chua cung cac thien than (phai) giay tay ve la bai o giua. */}
        <img src="/login/adam.png" alt="" className="absolute left-0 bottom-0 pointer-events-none select-none" style={{ height: "min(88vh, 780px)", maxWidth: "58vw", left: "-22vw", objectFit: "contain", objectPosition: "left bottom", zIndex: 0 }} />
        <img src="/login/god.png" alt="" className="absolute right-0 bottom-0 pointer-events-none select-none" style={{ height: "min(88vh, 780px)", maxWidth: "58vw", right: "-22vw", objectFit: "contain", objectPosition: "right bottom", zIndex: 0 }} />
        <div className="relative flex flex-col items-center justify-center h-full" style={{ gap: 20, padding: 24, zIndex: 10 }}>
          <div style={{ textAlign: "center", textShadow: "0 2px 12px rgba(0,0,0,.6)" }}>
            <div style={{ fontSize: 46, fontWeight: 900, letterSpacing: 2 }}>TẤN ONLINE</div>
          </div>
          {/* La At Co to, lo lung giua hai ban tay; nut choi ngay la mot phan cua la bai. */}
          <div className="login-card-float" style={{ background: "#fff", color: "#111", borderRadius: 18, height: "min(46vh, 360px)", aspectRatio: "5 / 7", maxWidth: "84vw", display: "flex", flexDirection: "column", padding: 16, boxSizing: "border-box" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
              <span style={{ fontSize: 30, fontWeight: 900, color: "#dc2626" }}>A</span>
              <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="#dc2626" /></svg>
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: "62%", filter: "drop-shadow(0 10px 16px rgba(220,38,38,.35))" }}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="#dc2626" /></svg>
            </div>
            <div>
              <button style={{ width: "100%", background: "#dc2626", color: "#fff", fontWeight: 800, fontSize: 18, padding: "12px 16px", borderRadius: 999, border: "none", boxShadow: "0 8px 20px rgba(220,38,38,.35)", cursor: guestBusy ? "wait" : "pointer", opacity: guestBusy ? 0.7 : 1 }} disabled={guestBusy} onClick={async () => { setGuestBusy(true); try { await s.guestLogin(); setGuestError(""); } catch (e) { setGuestError((e as Error).message); } finally { setGuestBusy(false); } }}>{guestBusy ? "Đang vào…" : "CHƠI NGAY"}</button>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <div style={{ transform: "rotate(180deg)", display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
                  <span style={{ fontSize: 30, fontWeight: 900, color: "#dc2626" }}>A</span>
                  <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="#dc2626" /></svg>
                </div>
              </div>
            </div>
          </div>
          {guestError && <p style={{ color: "#f87171", fontSize: 13, textAlign: "center", margin: 0 }}>{guestError}</p>}
          {s.authError && <p style={{ color: "#f87171", fontSize: 13, textAlign: "center", margin: 0 }}>{s.authError}</p>}
        </div>
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
            <div style={{ position: "absolute", bottom: "18%", left: "50%", transform: "translateX(-50%)", width: "min(20vw, 26vh)", height: "calc(min(20vw, 26vh) + 30px)", filter: "drop-shadow(0 8px 12px rgba(0,0,0,.45))" }}>
              <img src="/icons/chip-1m.svg" alt="Chip 1M" draggable={false} style={{ position: "absolute", bottom: 0, left: 0, width: "100%" }} />
              <img src="/icons/chip-5m.svg" alt="Chip 5M" draggable={false} style={{ position: "absolute", bottom: 15, left: 0, width: "100%" }} />
              <img src="/icons/chip-500k.svg" alt="Chip 500K" draggable={false} style={{ position: "absolute", bottom: 30, left: 0, width: "100%" }} />
            </div>
            <h2>CHƠI NGAY</h2>
          </button>
          <button className="tan-play" onClick={() => s.goToCreate(true)}>
            <div className="tan-fan">
              <img src="/durak/cards/KS.png" alt="K bích" /><img src="/durak/cards/QD.png" alt="Q rô" /><img src="/durak/cards/JC.png" alt="J chuồn" /><img src="/durak/cards/AH.png" alt="A cơ" />
            </div>
            <img src="/icons/chip-5m.svg" alt="Chip vàng" style={{ position: "absolute", bottom: "26%", right: "14%", width: "min(11vw, 17vh)", minWidth: 54 }} />
            <h2>CHƠI VỚI BẠN</h2>
          </button>
        </div>
        {homeBottom}
        {spinOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => { if (!spinBusy) setSpinOpen(false); }}>
            <div className="w-full max-w-md bg-red-950 border-2 border-yellow-400 rounded-2xl p-4 text-center" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-black text-xl text-yellow-300">VÒNG QUAY MAY MẮN</h2>
                <button aria-label="Đóng vòng quay" onClick={() => { if (!spinBusy) setSpinOpen(false); }}><X size={20} /></button>
              </div>
              <SpinWheel rot={spinRot} onHubClick={spinWheel} />
              <button className="bg-red-600 text-white font-black px-8 py-3 rounded-full mt-3 border-2 border-yellow-400 disabled:opacity-60" disabled={spinBusy} onClick={spinWheel}>{spinBusy ? "Đang quay…" : "QUAY"}</button>
              {spinResult && <p className="font-black text-yellow-300 mt-3">Bạn quay trúng: {spinResult}</p>}
              <p className="text-white/50 text-xs mt-2">Bản thử — giải thưởng chưa cộng vào số dư, chờ chốt luật thưởng.</p>
            </div>
          </div>
        )}
        {historyOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setHistoryOpen(false)}>
            <div className="w-full max-w-lg max-h-[85vh] overflow-auto bg-red-900 border border-yellow-400 rounded-2xl p-5 text-sm leading-relaxed" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-3"><h2 className="font-bold text-lg">Lịch sử xu</h2><button onClick={() => setHistoryOpen(false)} aria-label="Đóng lịch sử"><X size={18} /></button></div>
              <p className="text-white/70 mb-3">Số dư hiện tại: <b className="text-yellow-300">{s.balance.toLocaleString("vi-VN")} xu</b> · Xu chỉ là điểm thưởng, không nạp/rút hay đổi tiền thật.</p>
              {s.coinHistory.length === 0 ? (
                <p className="text-white/60">Chưa có ván nào quyết toán. Chơi xong 1 ván (kể cả rời ván giữa chừng) sẽ ghi lại ở đây.</p>
              ) : s.coinHistory.slice(0, 10).map((h, i) => {
                const myNet = h.perPlayer[h.myId]?.net ?? 0;
                const names = h.names;
                return (
                  <div key={`${h.at}-${i}`} className="border-t border-white/15 py-3">
                    <p className="font-bold">{new Date(h.at).toLocaleString("vi-VN")} · {h.mode === "bot" ? "Chơi với bot" : "Chơi với người"} · Bàn {formatCoins(h.level)} · <span className={myNet >= 0 ? "text-green-400" : "text-red-400"}>Bạn {myNet > 0 ? "+" : ""}{myNet.toLocaleString("vi-VN")} xu</span></p>
                    {Object.entries(h.perPlayer).map(([id, p]) => (
                      <p key={id} className="text-white/75 text-[13px]">{names[id] || id}: tấn {p.attackDelta > 0 ? "+" : ""}{p.attackDelta.toLocaleString("vi-VN")}, hạng {p.rankDelta > 0 ? "+" : ""}{p.rankDelta.toLocaleString("vi-VN")}, phí {p.fee > 0 ? `-${p.fee.toLocaleString("vi-VN")}` : "0"} → <b>{p.net > 0 ? "+" : ""}{p.net.toLocaleString("vi-VN")}</b></p>
                    ))}
                    <p className="text-white/50 text-xs">Phí sàn: {h.totalFee.toLocaleString("vi-VN")} xu{h.totalShortfall > 0 ? ` · Hệ thống bù hụt: ${h.totalShortfall.toLocaleString("vi-VN")} xu` : ""}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {settingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-80 max-w-[92vw] bg-red-900 border border-yellow-400 rounded-2xl p-5">
              <div className="flex justify-between items-center mb-3"><h2 className="font-bold text-lg flex items-center gap-2"><Settings size={18} /> Cài đặt âm thanh</h2><button onClick={() => setSettingsOpen(false)} aria-label="Đóng cài đặt"><X size={18} /></button></div>
              <label className="flex items-center gap-2 mb-3 cursor-pointer"><input type="checkbox" checked={soundOn} onChange={(e) => { setSoundOn(e.target.checked); setSoundEnabled(e.target.checked); }} /> Bật âm thanh</label>
              <label className="block text-sm mb-1">Âm lượng: {soundVol}%</label>
              <input className="w-full mb-3" type="range" min={0} max={100} value={soundVol} onChange={(e) => { const v = Number(e.target.value); setSoundVol(v); setSoundVolume(v / 100); }} />
              <div className="flex gap-2">
                <button className="flex-1 bg-yellow-400 text-black font-bold px-3 py-2 rounded-full text-sm" onClick={() => playDealSound()}><span className="flex items-center justify-center gap-1"><Volume2 size={16} /> Thử phát bài</span></button>
                <button className="flex-1 bg-yellow-400 text-black font-bold px-3 py-2 rounded-full text-sm" onClick={() => playCardSound()}><span className="flex items-center justify-center gap-1"><Volume2 size={16} /> Thử ra lá</span></button>
              </div>
            </div>
          </div>
        )}

                {helpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setHelpOpen(false)}>
            <div className="w-full max-w-lg max-h-[85vh] overflow-auto bg-red-900 border border-yellow-400 rounded-2xl p-5 text-sm leading-relaxed" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-3"><h2 className="font-bold text-lg">Hướng dẫn luật chơi Tấn (VN-8)</h2><button onClick={() => setHelpOpen(false)} aria-label="Đóng hướng dẫn"><X size={18} /></button></div>
              <p><b>Mục tiêu:</b> đánh hết bài trên tay trước khi nọc hết. Người cuối cùng còn bài trên tay là người thua ván.</p>
              <p className="mt-2"><b>Chia bài:</b> 2–4 người, mỗi người 8 lá, bộ Tây 52 lá không Joker. Lá cuối nọc lật ngửa làm chất chủ (ví dụ Cơ là chủ thì Cơ mạnh nhất).</p>
              <p className="mt-2"><b>Người tấn đầu:</b> người có lá chủ nhỏ nhất. Sau đó tấn theo vòng ngược chiều kim đồng hồ: Mình → Bot 3 (phải) → Bot 1 (trên) → Bot 2 (trái) → Mình; người vừa đỡ xong sẽ tấn tiếp, người ngồi kế tiếp sau người tấn là người đỡ.</p>
              <p className="mt-2"><b>Tấn:</b> tấn 1 lá đầu, sau đó chỉ được thêm lá cùng hạng với lá đã có trên bàn. Một đợt tối đa 6 lá, và không vượt số lá người đỡ có lúc đợt bắt đầu.</p>
              <p className="mt-2"><b>Đỡ:</b> đỡ bằng lá cùng chất cao hơn, hoặc bằng lá chủ nếu lá tấn không phải chủ. Lá tấn là chủ thì chỉ đỡ bằng lá chủ cao hơn. Người đỡ có 30 giây, quanh avatar có vòng sáng đếm ngược, hết giờ tự lên bài.</p><p className="mt-2"><b>Chơi với bot / chơi với bạn:</b> Chơi với bot là chơi ngay với bot lấp ghế. Chơi với bạn là chơi với người thật, không có bot: vào phòng chờ, mã phòng hiện giữa bàn, đủ 2 người là tự đếm 1-2-3 rồi phát bài lần lượt rồi mới chọn chất chủ. Người về nhất (đánh hết bài đầu tiên) được vương miện số 1 trên avatar, và khi đã xong ván thì không còn nút chọn nữa vì không cần đấu nữa.</p>
              <p className="mt-2"><b>Tấn cũng tính giờ:</b> người tấn có 30 giây, quanh avatar có vòng vàng đếm ngược, tấn lá mới thì reset lại 30 giây. Hết giờ tấn mà chưa đánh thì tự đánh lá yếu nhất có thể đánh được.</p>
              <p className="mt-2"><b>Lên bài:</b> không đỡ được (hoặc muốn lên) thì bấm Lên bài, nhận hết bài trên bàn, mất lượt tấn tiếp theo.</p>
              <p className="mt-2"><b>Bốc bài:</b> đỡ thành công và kết thúc đợt thì mọi người bốc từng lá cho đủ 8 lá, theo thứ tự người tấn, người thêm, người đỡ cuối. Hết nọc thì ai hết bài trước là xong, người còn bài cuối cùng thua.</p>
              <p className="mt-2"><b>Nút trong ván:</b> Kết thúc đợt (người tấn chính, khi mọi lá đã được đỡ), Lên bài, Bốc bài (khi tới lượt bốc, 3 giây không bấm sẽ tự bốc), Sắp xếp (bên phải tay bài, theo chất hoặc theo hạng, từ A xuống 2).</p>
              <p className="mt-2 text-yellow-200">Lưu ý: điểm/xu trong game chỉ là điểm thưởng, không nạp/rút hay đổi tiền thật. Bản này không còn chức năng chuyển tấn.</p>
              <button className="bg-yellow-400 text-black font-bold px-6 py-2 rounded-full mt-4" onClick={() => setHelpOpen(false)}>Đã hiểu</button>
            </div>
          </div>
        )}

        {searchOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSearchOpen(false)}>
            <div className="w-full max-w-lg max-h-[85vh] overflow-auto bg-red-900 border border-yellow-400 rounded-2xl p-5 text-sm leading-relaxed" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-3"><h2 className="font-bold text-lg">Tìm phòng</h2><button onClick={() => setSearchOpen(false)} aria-label="Đóng tìm phòng"><X size={18} /></button></div>
              <div className="flex items-center gap-2">
                <input className="flex-1 bg-white/10 text-white placeholder:text-white/50 px-4 py-3 rounded-full font-bold outline-none" placeholder="Nhập mã phòng, ví dụ 148123" value={searchText} onChange={(e) => setSearchText(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => { if (e.key === "Enter" && searchText.length === 6) s.onlineJoinRoom(searchText); }} />
                <button className="bg-teal-600 text-white rounded-full shrink-0 flex items-center justify-center disabled:opacity-40" style={{ width: 48, height: 48 }} disabled={searchText.length !== 6} onClick={() => s.onlineJoinRoom(searchText)} aria-label="Tìm phòng"><Search size={22} /></button>
              </div>
              {s.onlineError && <p className="text-red-300 font-bold mt-3">{s.onlineError}</p>}
            </div>
          </div>
        )}
      </div>
    );
  }

  let hint = "Đang chờ bot đánh…";
  if (game.phase === "FINISHED") hint = game.loserId === myId ? "Bạn là người thua ván này." : `${game.players.find((p) => p.id === game.loserId)?.name} thua ván này.`;
  else if (iAmDefender && undefended.length) hint = "Tới lượt bạn đỡ: bấm lá bài viền vàng để đỡ, hoặc bấm Lên bài bất cứ lúc nào (kể cả khi đỡ được).";
  else if (game.phase === "DRAWING" && game.pendingDraw[0] === myId) hint = "Tới lượt bạn bốc bài: bấm Bốc bài, 3 giây không bấm sẽ tự bốc.";
  else if (game.phase === "DRAWING") hint = "Đang bốc bài: chờ người khác bốc đủ 8 lá…";
  else if (iAmAttacker && game.table.length === 0) hint = "Tới lượt bạn tấn: bấm 1 lá bài để đánh ra.";
  else if (iAmAttacker && allDefended) hint = "Bạn có thể thêm bài cùng hạng, hoặc bấm Kết thúc đợt.";
  else if (!iAmDefender && game.table.length > 0 && me?.hand.some((c) => canAttackCard(game, myId, c))) hint = "Bạn có thể thêm bài cùng hạng.";

  return (
    <div className="h-screen w-screen overflow-hidden flex items-center justify-center bg-black">
      <div style={stage.phone ? { width: STAGE_W, height: STAGE_H, transform: `scale(${stage.scale})`, transformOrigin: "center", flexShrink: 0 } : { width: "100%", height: "100%" }}>
        <div className="h-full w-full overflow-hidden bg-[#1b3a1b] text-white flex flex-col relative">
      <div className="flex gap-3 bg-black/50 px-3 py-2 font-semibold items-center justify-between shrink-0">
        <span className="flex items-center gap-3">
          <button className="w-9 h-9 rounded-full bg-red-900 border border-white/30 flex items-center justify-center" title="Rời khỏi ván đấu" onClick={() => setLeaveOpen(true)}><X size={18} /></button>
          <span>{game.phase === "FINISHED" ? "Ván đã kết thúc" : `${game.players.find((p) => p.id === game.attackerId)?.name} tấn · ${game.players.find((p) => p.id === game.defenderId)?.name} đỡ`}</span>
          {isDefending ? <span className="flex items-center gap-1"><Timer size={18} /> Đỡ: {defendSeconds}s</span> : myAttackTurn ? <span className="flex items-center gap-1"><Timer size={18} /> {seconds}s</span> : isMyDrawTurn ? <span className="flex items-center gap-1"><Timer size={18} /> Bốc: {drawSeconds}s</span> : null}
          <span className="flex items-center gap-1">Chủ: {SUIT_NAME[game.trumpSuit]} <img src={`/durak/ui/trump_marker_${trumpMarker[game.trumpSuit]}.png`} alt={SUIT_NAME[game.trumpSuit]} className="w-6 h-6" /></span>
          <span>Nọc: {game.drawPile.length} lá</span>
        </span>
        <span className="flex gap-2 items-center">
          {s.roomCode && <span className="bg-yellow-400 text-black font-bold px-3 h-9 rounded-full flex items-center text-sm">Mã phòng: {s.roomCode}</span>}
          <button className="px-4 h-9 rounded-full bg-red-900 border border-white/30 text-sm" onClick={() => setChatOpen((v) => !v)}><span className="flex items-center gap-1"><MessageCircle size={18} /> Chat{s.chat.length > 1 ? ` (${s.chat.length - 1})` : ""}</span></button>
          <button className="w-9 h-9 rounded-full bg-red-900 border border-white/30 flex items-center justify-center" title={isFullscreen ? "Thoát full màn" : "Full màn hình"} onClick={() => void toggleFullscreen()}>{isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}</button>
          <button className="w-9 h-9 rounded-full bg-red-900 border border-white/30 flex items-center justify-center" title="Cài đặt âm thanh" onClick={() => setSettingsOpen(true)}><Settings size={18} /></button>
        </span>
      </div>
      {/* Toast thông báo ngắn gọn, thay khung log dài cũ (đã bỏ). */}
      {s.notice && (
        <div key={s.noticeKey} className="toast-notice absolute top-14 left-1/2 -translate-x-1/2 z-40 bg-black/80 border border-yellow-400 text-yellow-100 text-sm font-semibold px-4 py-2 rounded-full shadow-lg whitespace-nowrap max-w-[92vw] overflow-hidden text-ellipsis">
          {s.notice}
        </div>
      )}
      {/* Lá vừa đánh bay từ đúng hướng ghế của người đánh lên giữa bàn. */}
      {s.flying && (
        <div key={s.flying.key} className={`flying-card ${(() => {
          if (s.flying!.by === myId) return "flying-bottom";
          if (s.onlineMode) {
            const n = game.players.length;
            const myIdx = game.players.findIndex((pl) => pl.id === myId);
            const idx = game.players.findIndex((pl) => pl.id === s.flying!.by);
            const off = (idx - myIdx + n) % n;
            if (n === 2) return "flying-top";
            if (n === 3) return off === 1 ? "flying-right" : "flying-left";
            return off === 1 ? "flying-right" : off === 2 ? "flying-top" : "flying-left";
          }
          const nm = game.players.find((pl) => pl.id === s.flying!.by)?.name;
          return nm === "Bot 3" ? "flying-right" : nm === "Bot 2" ? "flying-left" : "flying-top";
        })()}`}>
          <CardView card={parseCard(s.flying.cardId)} />
        </div>
      )}
      {/* Hiệu ứng tấn/đỡ trên lá bài vừa đánh: kiếm đan chéo (tấn) / khiên (đỡ). */}
      {playFx && (
        <div className="play-fx" style={{ left: playFx.x, top: playFx.y }}>
          <span className="play-fx-ring" />
          {playFx.kind === "attack" ? <Swords size={48} className="text-yellow-300" /> : <Shield size={48} className="text-sky-300" />}
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
      <div className="flex-1 min-h-0 w-full relative flex flex-col">
        <TableCanvas game={game} hideStock={starting !== null} />
        {(() => {
          const myIdx = game.players.findIndex((pl) => pl.id === myId);
          const opps = s.onlineMode
            ? game.players.filter((_, i) => i !== myIdx).map((_, k) => game.players[(myIdx + 1 + k) % game.players.length])
            : game.players.filter((pl) => pl.id !== myId);
          return opps.map((p, idx) => {
          const pos = s.onlineMode
            ? (game.players.length === 2 ? "absolute top-2 left-1/2 -translate-x-1/2" : game.players.length === 3 ? (idx === 0 ? "absolute right-2 top-1/2 -translate-y-1/2" : "absolute left-2 top-1/2 -translate-y-1/2") : (idx === 0 ? "absolute right-2 top-1/2 -translate-y-1/2" : idx === 1 ? "absolute top-2 left-1/2 -translate-x-1/2" : "absolute left-2 top-1/2 -translate-y-1/2"))
            : (p.name === "Bot 3" ? "absolute right-2 top-1/2 -translate-y-1/2" : p.name === "Bot 2" ? "absolute left-2 top-1/2 -translate-y-1/2" : "absolute top-2 left-1/2 -translate-x-1/2");
          return (
            <div key={p.id} className={`${pos} z-20 flex items-center gap-2 bg-black/55 px-2 py-1 rounded-xl text-sm ${p.id === game.attackerId || p.id === game.defenderId ? "outline outline-yellow-400" : ""}`}>
              <div className="relative shrink-0" style={p.id === game.defenderId && isDefending ? { padding: 3, borderRadius: "50%", background: `conic-gradient(#facc15 ${defendFraction * 100}%, rgba(255,255,255,0.2) 0)`, boxShadow: "0 0 16px rgba(250,204,21,0.9)" } : undefined}>
                {s.onlineMode && s.onlineRoom?.players.find((x) => x.name === p.name)?.avatar ? <img src={s.onlineRoom!.players.find((x) => x.name === p.name)!.avatar!} alt={p.name} className="w-[100px] h-[100px] rounded-full block" style={game.phase === "FINISHED" && game.loserId === p.id ? { filter: "grayscale(1)", opacity: 0.55 } : undefined} /> : s.onlineMode ? <div className="w-[100px] h-[100px] rounded-full bg-red-900 flex items-center justify-center text-3xl font-black" style={game.phase === "FINISHED" && game.loserId === p.id ? { filter: "grayscale(1)", opacity: 0.55 } : undefined}>{p.name.charAt(0).toUpperCase()}</div> : <img src={`/durak/ui/avatar_${(p.name.replace("Bot ", "") || "1")}.png`} alt={p.name} className="w-[100px] h-[100px] rounded-full block" style={game.phase === "FINISHED" && game.loserId === p.id ? { filter: "grayscale(1)", opacity: 0.55 } : undefined} />}
                {p.finished && game.finishOrder[0] === p.id && <span className="absolute -top-2 -right-2 bg-yellow-400 text-black font-black text-xs px-2 py-1 rounded-full border-2 border-white shadow flex items-center gap-1"><Crown size={14} /> 1</span>}
                {p.id === game.defenderId && isDefending && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-400 text-black font-black text-[11px] px-1.5 rounded-full border border-white">{defendSeconds}s</span>}
                {(game.phase === "ATTACKING" || game.phase === "DEFENDING") && p.id === game.attackerId && <span className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"><span className="flex items-center justify-center rounded-full bg-black/45 p-2"><Swords size={44} className="text-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" /></span></span>}
                {(game.phase === "ATTACKING" || game.phase === "DEFENDING") && p.id === game.defenderId && <span className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"><span className="flex items-center justify-center rounded-full bg-black/45 p-2"><Shield size={44} className="text-sky-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" /></span></span>}
                {coinFloats.filter((f) => f.playerId === p.id).map((f) => (
                  <span key={f.key} className={`coin-float ${f.amount >= 0 ? "text-yellow-300" : "text-red-400"}`}>{f.amount >= 0 ? "+" : "−"}{formatBalanceShort(Math.abs(f.amount))}</span>
                ))}
              </div>
              <div className="relative shrink-0">
                <img src="/durak/cards/back.png" alt="Bài úp" className="w-[72px] h-[100px] rounded" />
                <span className="absolute inset-0 flex items-center justify-center"><span className="bg-yellow-400 text-black font-black text-lg w-9 h-9 rounded-full flex items-center justify-center border-2 border-white shadow">{p.hand.length}</span></span>
              </div>
              <span className="whitespace-nowrap flex flex-col leading-tight"><b>{p.name}</b><span className="flex items-center gap-1">{p.id === game.attackerId ? <Swords size={15} /> : null} {p.id === game.defenderId ? <Shield size={15} /> : null} {p.finished ? <Check size={15} /> : null} {p.hand.length} lá</span><span className="flex items-center gap-1 text-yellow-300 font-black"><img src="/icons/coin.svg" alt="" style={{ width: 16, height: 16 }} />{formatBalanceShort(balanceFor(p))}</span></span>
            </div>
          );
        }); })()}
        {/* Hiệu ứng bốc bài: lá bay từ nọc giữa bàn tới góc người bốc */}
        {s.drawFlying && (() => {
          const opps = game.players.filter((p) => p.id !== myId);
          const corner = s.drawFlying.toId === myId ? "bottom" : (() => { const nm = opps.find((p) => p.id === s.drawFlying!.toId)?.name; return nm === "Bot 3" ? "right" : nm === "Bot 2" ? "left" : "top"; })();
          return (
            <div key={s.drawFlying.key} className={`flying-draw flying-draw-${corner}`}>
              {s.drawFlying.toId === myId ? <CardView card={parseCard(s.drawFlying.cardId)} /> : <img src="/durak/cards/back.png" alt="" className="w-[72px] h-[100px] rounded-[10px]" />}
            </div>
          );
        })()}
      </div>
      {/* Nút + tay bài + gợi ý nằm tuyệt đối ở đáy màn hình, đè lên viền dưới bàn: viền dưới bàn (đáy khung - 80px) nằm đúng giữa lá bài tay mình. */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
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
      {!me?.finished && (<div className="text-center space-x-2 py-2 shrink-0 relative">
        {s.followWindow && <button className="bg-yellow-400 text-black font-bold px-4 py-2 rounded-full" onClick={() => s.passFollow()}>Không theo</button>}
        <button className="bg-white text-black font-semibold px-4 py-2 rounded-full disabled:opacity-40" disabled={!(iAmAttacker && allDefended)} onClick={s.finishAttackAction}>Kết thúc đợt</button>
        <button className="bg-red-500 text-white font-bold px-4 py-2 rounded-full disabled:opacity-40" disabled={!(iAmDefender && game.table.length > 0)} onClick={s.takeCards}>Lên bài</button>
        <button className="bg-green-500 text-white font-bold px-4 py-2 rounded-full disabled:opacity-40" disabled={!(game.phase === "DRAWING" && game.pendingDraw[0] === myId && !s.drawing)} onClick={s.drawCards}>Bốc bài{isMyDrawTurn ? ` (${drawSeconds}s)` : ""}</button>
      </div>)}
      <div className="flex justify-center items-center flex-wrap shrink-0 px-2 pb-2 gap-2">
      <div className="flex flex-col items-center shrink-0">
        <div className="relative shrink-0" style={(iAmDefender && isDefending) ? { padding: 3, borderRadius: "50%", background: `conic-gradient(#facc15 ${defendFraction * 100}%, rgba(255,255,255,0.2) 0)`, boxShadow: "0 0 16px rgba(250,204,21,0.9)" } : myAttackTurn ? { padding: 3, borderRadius: "50%", background: `conic-gradient(#facc15 ${(seconds / 30) * 100}%, rgba(255,255,255,0.2) 0)`, boxShadow: "0 0 16px rgba(250,204,21,0.9)" } : isMyDrawTurn ? { padding: 3, borderRadius: "50%", background: `conic-gradient(#facc15 ${(drawSeconds / 3) * 100}%, rgba(255,255,255,0.2) 0)`, boxShadow: "0 0 16px rgba(250,204,21,0.9)" } : undefined}>
          {/* Bong bóng chat của mình: hiện trên avatar, không cần mở hội thoại. */}
          {bubble && (
            <div key={bubble.key} className="absolute bottom-full left-0 mb-2 z-50 max-w-[220px] bg-white text-black text-sm font-medium px-3 py-2 rounded-2xl rounded-bl-sm shadow-lg break-words">{bubble.text}</div>
          )}
          {/* Đồng hồ góc trên trái avatar khi đến lượt mình đánh/đỡ. */}
          {((iAmDefender && isDefending) || myAttackTurn) && (
            <span className="absolute -top-2 -left-2 z-50 bg-black/85 text-yellow-300 font-black text-xs px-2 py-1 rounded-full border border-yellow-400 flex items-center gap-1 shadow"><Timer size={13} /> {iAmDefender && isDefending ? defendSeconds : seconds}s</span>
          )}
          {s.followWindow && (
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 z-50 bg-yellow-400 text-black font-black text-xs px-3 py-1 rounded-full border-2 border-white shadow whitespace-nowrap">Theo: {followSeconds}s</span>
          )}
          {s.googleUser?.avatar ? <img src={s.googleUser.avatar} alt="" className="w-[100px] h-[100px] rounded-full block" style={game.phase === "FINISHED" && game.loserId === myId ? { filter: "grayscale(1)", opacity: 0.55 } : undefined} /> : <div className="tan-avatar" style={{ width: 100, height: 100, fontSize: 36, ...(game.phase === "FINISHED" && game.loserId === myId ? { filter: "grayscale(1)", opacity: 0.55 } : {}) }}>{(s.playerName.trim() || "B").charAt(0).toUpperCase()}</div>}
          {me?.finished && game.finishOrder[0] === myId && <span className="absolute -top-3 -right-3 z-50 bg-yellow-400 text-black font-black text-xs px-2 py-1 rounded-full border-2 border-white shadow flex items-center gap-1"><Crown size={14} /> 1</span>}
          {me?.finished && game.finishOrder[0] !== myId && <span className="absolute -top-3 -right-3 z-50 bg-white text-black font-black text-xs px-2 py-1 rounded-full border-2 border-white shadow">{game.finishOrder.indexOf(myId) + 1}</span>}
          {iAmDefender && isDefending && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-400 text-black font-black text-[11px] px-1.5 rounded-full border border-white">{defendSeconds}s</span>}
          {isMyDrawTurn && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-400 text-black font-black text-[11px] px-1.5 rounded-full border border-white">{drawSeconds}s</span>}
          {(game.phase === "ATTACKING" || game.phase === "DEFENDING") && myId === game.attackerId && <span className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"><span className="flex items-center justify-center rounded-full bg-black/45 p-2"><Swords size={44} className="text-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" /></span></span>}
          {(game.phase === "ATTACKING" || game.phase === "DEFENDING") && myId === game.defenderId && <span className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"><span className="flex items-center justify-center rounded-full bg-black/45 p-2"><Shield size={44} className="text-sky-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" /></span></span>}
          {coinFloats.filter((f) => f.playerId === myId).map((f) => (
            <span key={f.key} className={`coin-float ${f.amount >= 0 ? "text-yellow-300" : "text-red-400"}`}>{f.amount >= 0 ? "+" : "−"}{formatBalanceShort(Math.abs(f.amount))}</span>
          ))}
        </div>
        <span className="flex items-center gap-1 text-yellow-300 font-black text-sm mt-1"><img src="/icons/coin.svg" alt="" style={{ width: 16, height: 16 }} />{formatBalanceShort(balanceFor({ id: myId, name: me?.name || s.playerName }))}</span>
      </div>
        {me?.hand.map((c, i) => (
          <div key={c.id} className={i === 0 ? "" : "-ml-6"}>
            <CardView card={c} selected={s.selected === c.id} highlight={!!game && game.table.length > 0 && ((game.defenderId !== myId && canAttackCard(game, myId, c)) || (game.defenderId === myId && !s.followWindow && game.table.some((x) => !x.defense && canBeat(x.attack, c, game.trumpSuit))))} onClick={() => s.playCard(c.id)} />
          </div>
        ))}
        {!me?.finished && (
          <button className="bg-white text-black font-semibold px-3 py-2 rounded-full shrink-0 ml-2" title="Bấm là tự xếp, bấm lại đổi kiểu" onClick={() => { const next = lastSort === "suit" ? "rank" : "suit"; s.sortHand(next); setLastSort(next); }}>Sắp xếp</button>
        )}
      </div>
      <p className="text-center text-yellow-200 text-sm pb-2 shrink-0">{hint}</p>
      </div>
      {/* Chat trong ván: chỉ ở bộ nhớ, thoát ván là mất, không lưu DB. */}
      {chatOpen && (
        <div className="absolute inset-0 z-50 bg-black/95 border border-yellow-400/60 overflow-hidden shadow-2xl flex flex-col">
          <div className="flex justify-between items-center px-3 py-2 bg-red-950 font-semibold text-sm">
            <span className="flex items-center gap-1"><MessageCircle size={16} /> Chat trong ván</span>
            <button onClick={() => setChatOpen(false)} aria-label="Đóng chat"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3 text-base">
            {s.chat.map((m) => (
              <div key={m.id} className={m.from === (s.playerName.trim() || "Bạn") ? "text-right" : ""}>
                <span className="text-yellow-300 text-xs font-semibold">{m.from}: </span>
                <span>{m.text}</span>
              </div>
            ))}
          </div>
          <form className="flex gap-2 p-4 border-t border-white/20" onSubmit={(e) => { e.preventDefault(); const msg = chatText.trim(); if (msg) { s.sendChat(msg); setBubble({ text: msg, key: Date.now() }); } setChatText(""); }}>
            <input className="flex-1 min-w-0 bg-white/10 text-white placeholder:text-white/50 px-3 py-2 rounded-full text-sm outline-none" placeholder="Nhắn trong ván này…" value={chatText} onChange={(e) => setChatText(e.target.value)} />
            <button className="bg-yellow-400 text-black font-bold px-4 rounded-full text-sm" type="submit">Gửi</button>
          </form>
          <p className="text-center text-white/50 text-xs pb-2">Thoát ván là mất chat, không lưu lại.</p>
        </div>
      )}
      {leaveOpen && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-80 max-w-[92vw] bg-red-900 border border-yellow-400 rounded-2xl p-5 text-center">
            <h2 className="font-bold text-lg mb-2">Bạn có muốn rời khỏi ván đấu?</h2>
            <p className="text-white/70 text-sm mb-4">{s.onlineMode ? "Rời ván sẽ mất ván đang chơi, quay về sảnh." : "Rời ván giữa chừng tính là hạng cuối, xu sẽ quyết toán theo luật rồi quay về sảnh."}</p>
            <div className="flex gap-3 justify-center">
              <button className="bg-red-500 text-white font-bold px-6 py-2 rounded-full" onClick={() => { setLeaveOpen(false); s.backToLobby(); }}>Xác nhận</button>
              <button className="bg-white text-black font-bold px-6 py-2 rounded-full" onClick={() => setLeaveOpen(false)}>Hủy</button>
            </div>
          </div>
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
      {/* Về nhất: hiệu ứng lớn, không chặn bấm, tự ẩn sau 4 giây; vương miện số 1 vẫn ở trên avatar. */}
      {firstEffect && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="trump-ace-rays" style={{ width: 220, height: 220, margin: "0 auto" }} />
            <div style={{ marginTop: -180 }}><Crown size={72} className="mx-auto text-yellow-400" /></div>
            <div className="font-black text-4xl text-yellow-300 mt-2" style={{ textShadow: "0 2px 12px rgba(0,0,0,.8)" }}>BẠN VỀ NHẤT!</div>
            <div className="text-white font-semibold mt-1">Bạn đã đánh hết bài đầu tiên!</div>
          </div>
        </div>
      )}
      {/* Bắt đầu ván: đếm 1-2-3, phát đủ 8 lá mỗi người (lúc này nọc + lá chủ
          trên bàn bị giấu), rồi lật lá chủ ngửa cho cả làng xem, cuối cùng bay
          nọc kèm lá chủ từ giữa bàn về đúng góc trên trái của bàn rồi mới vào ván.
          Nền trong suốt để thấy bàn đấu phía sau. */}
      {starting && (
        <div className="absolute inset-0 z-[65] flex flex-col items-center justify-center">
          {starting.step === "count" && <div className="font-black text-8xl text-yellow-300" style={{ textShadow: "0 2px 16px rgba(0,0,0,.9)" }}>{starting.count}</div>}
          {starting.step === "count" && <div className="text-white font-semibold mt-2" style={{ textShadow: "0 2px 8px rgba(0,0,0,.9)" }}>Chuẩn bị phát bài…</div>}
          {starting.step === "deal" && game && (() => {
            const totalPlayers = game.players.length;
            // Lá thứ d (1-based) phát cho ghế (d-1) % totalPlayers, bay ra đúng phía ghế đó.
            const dealCorner = (pl: { id: string; name: string }) => {
              if (pl.id === myId) return "bottom";
              if (s.onlineMode) {
                const n = totalPlayers;
                const myIdx = game.players.findIndex((x) => x.id === myId);
                const idx = game.players.findIndex((x) => x.id === pl.id);
                const off = (idx - myIdx + n) % n;
                if (n === 2) return "top";
                if (n === 3) return off === 1 ? "right" : "left";
                return off === 1 ? "right" : off === 2 ? "top" : "left";
              }
              return pl.name === "Bot 3" ? "right" : pl.name === "Bot 2" ? "left" : "top";
            };
            return (
              <div className="text-center">
                {/* Bộ bài ở giữa bàn. */}
                <div className="relative mx-auto mb-4" style={{ width: 72, height: 100 }}>
                  <img src="/durak/cards/back.png" alt="" className="absolute rounded" style={{ width: 72, height: 100, left: -6, top: -4, opacity: 0.7 }} />
                  <img src="/durak/cards/back.png" alt="" className="absolute rounded" style={{ width: 72, height: 100, left: -3, top: -2, opacity: 0.85 }} />
                  <img src="/durak/cards/back.png" alt="" className="absolute rounded shadow-2xl" style={{ width: 72, height: 100, left: 0, top: 0 }} />
                </div>
                <div className="font-black text-3xl text-yellow-300 mb-4" style={{ textShadow: "0 2px 12px rgba(0,0,0,.9)" }}>Đang phát bài…</div>
                {/* Không hiện số lượng từng ghế nữa: lá chỉ bay từ giữa bàn ra đúng phía tay người nhận. */}
                {Array.from({ length: starting.deal }, (_, i) => i + 1).map((d) => {
                  const pl = game.players[(d - 1) % totalPlayers];
                  return (
                    <div key={d} className={`flying-draw flying-draw-${dealCorner(pl)}`}>
                      <img src="/durak/cards/back.png" alt="" className="w-[72px] h-[100px] rounded-[10px]" />
                    </div>
                  );
                })}
              </div>
            );
          })()}
          {starting.step === "trump" && game && (
            <div className="text-center">
              <div className="flex justify-center" style={{ transform: "scale(1.35)", transformOrigin: "center bottom" }}>
                <CardView card={parseCard(game.trumpCardId)} />
              </div>
              <div className="font-black text-3xl text-yellow-300 mt-5" style={{ textShadow: "0 2px 12px rgba(0,0,0,.9)" }}>LÁ CHỦ!</div>
              <div className="flex items-center justify-center gap-2 mt-2 text-xl font-bold" style={{ textShadow: "0 2px 8px rgba(0,0,0,.9)" }}>Chất chủ: {SUIT_NAME[game.trumpSuit]} <img src={`/durak/ui/trump_marker_${trumpMarker[game.trumpSuit]}.png`} alt={SUIT_NAME[game.trumpSuit]} className="w-10 h-10" /></div>
            </div>
          )}
          {starting.step === "move" && game && (() => {
            const c = parseCard(game.trumpCardId);
            const r = c.rank === 14 ? "A" : c.rank === 11 ? "J" : c.rank === 12 ? "Q" : c.rank === 13 ? "K" : String(c.rank);
            const file = `${r}${c.suit}.png`;
            const t = stockMoved && stockTarget ? stockTarget : { dx: 0, dy: 0 };
            return (
              <div className="absolute" style={{ left: "50%", top: "50%", width: 64, height: 88, transform: `translate(calc(-50% + ${t.dx}px), calc(-50% + ${t.dy}px))`, transition: "transform 0.9s ease-in-out" }}>
                <img src={`/durak/cards/${file}`} alt="" draggable={false} style={{ position: "absolute", left: 0, top: 0, width: 64, height: 88, borderRadius: 6 }} />
                {[0, 1, 2].map((j) => (
                  <img key={j} src="/durak/cards/back.png" alt="" draggable={false} style={{ position: "absolute", left: 6 + j * 3, top: -4 - j * 2, width: 64, height: 88, borderRadius: 6 }} />
                ))}
              </div>
            );
          })()}
        </div>
      )}
      {/* Lên bài: các lá vừa lấy bay vào tay mình. */}
      {s.takeAnimCards && (
        <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden">
          {s.takeAnimCards.map((cid, i) => (
            <div key={`${cid}-${i}`} className="take-fly" style={{ animationDelay: `${i * 150}ms` }}>
              <CardView card={parseCard(cid)} />
            </div>
          ))}
        </div>
      )}
      {game.phase === "FINISHED" && s.onlineMode && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="max-w-xl mx-4 bg-red-900 border border-yellow-400 rounded-2xl p-6 text-center">
            <img src={game.loserId === myId ? "/durak/ui/you_lose.png" : "/durak/ui/you_won.png"} alt="Kết quả" className="w-48 mx-auto mb-3" />
            <h2 className="text-xl font-bold">Kết quả</h2>
            <p>Người thua: <b>{game.players.find((p) => p.id === game.loserId)?.name}</b></p>
            <p>Thứ tự hoàn thành: {game.finishOrder.map((id) => game.players.find((p) => p.id === id)?.name).join(" → ") || "—"}</p>
            {s.settlement && (
              <div className="mt-4 text-left bg-black/30 rounded-xl p-3 text-sm">
                <p className="font-bold text-yellow-200 text-center mb-2">Quyết toán xu — Bàn {formatCoins(s.settlement.level)}</p>
                <table className="w-full">
                  <thead><tr className="text-white/60"><th className="text-left py-1">Người chơi</th><th className="text-right">Tấn</th><th className="text-right">Hạng</th><th className="text-right">Phí</th><th className="text-right">Kết quả</th><th className="text-right">Số dư</th></tr></thead>
                  <tbody>
                    {s.settlement.rows.map((r) => (
                      <tr key={r.id} className="border-t border-white/10">
                        <td className="py-1 font-bold">{r.name}</td>
                        <td className="text-right">{r.attackDelta > 0 ? "+" : ""}{r.attackDelta.toLocaleString("vi-VN")}</td>
                        <td className="text-right">{r.rankDelta > 0 ? "+" : ""}{r.rankDelta.toLocaleString("vi-VN")}</td>
                        <td className="text-right">{r.fee > 0 ? `-${r.fee.toLocaleString("vi-VN")}` : "0"}</td>
                        <td className={`text-right font-bold ${r.net >= 0 ? "text-green-400" : "text-red-400"}`}>{r.net > 0 ? "+" : ""}{r.net.toLocaleString("vi-VN")}</td>
                        <td className="text-right">{r.balanceAfter === null ? "—" : r.balanceAfter.toLocaleString("vi-VN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-white/60 text-xs mt-2 text-center">Phí sàn hệ thống thu: {s.settlement.totalFee.toLocaleString("vi-VN")} xu{s.settlement.totalShortfall > 0 ? ` · Hệ thống bù hụt chặn ở 0: ${s.settlement.totalShortfall.toLocaleString("vi-VN")} xu` : ""}</p>
                {s.settlement.takeLog.length > 0 && (
                  <div className="mt-2 text-xs text-white/70">
                    {s.settlement.takeLog.map((t, i) => {
                      const nm: Record<string, string> = {}; for (const r of s.settlement!.rows) nm[r.id] = r.name;
                      const parts = Object.entries(t.counts).map(([id, c]) => `${nm[id] || id} ${c} lá`).join(", ");
                      return <p key={i} className="mt-1">· {nm[t.defenderId] || t.defenderId} ôm {t.cardCount} lá ({parts})</p>;
                    })}
                  </div>
                )}
              </div>
            )}
            {s.onlineRoom && (() => {
              const room = s.onlineRoom!;
              const readyIds = room.rematchReady || [];
              const eligible = room.players.filter((pl) => pl.online);
              const readyNames = eligible.filter((pl) => readyIds.includes(pl.id)).map((pl) => pl.name);
              const iAmReady = s.onlineMyLobbyId ? readyIds.includes(s.onlineMyLobbyId) : false;
              const canRematch = eligible.length >= 2;
              return (
                <div className="mt-4 border-t border-white/10 pt-3 text-center">
                  <p className="text-sm font-bold text-yellow-300">Ván lại: {readyIds.length}/{eligible.length} người đã chọn</p>
                  {readyNames.length > 0 && <p className="text-white/70 text-xs mt-1">Đã chọn: {readyNames.join(", ")}</p>}
                  {!canRematch && <p className="text-white/60 text-xs mt-1">Cần ít nhất 2 người đang online để ván lại.</p>}
                  {canRematch && eligible.length > readyIds.length && <p className="text-white/60 text-xs mt-1">Chờ mọi người trong phòng cùng chọn ván lại là tự vào ván mới…</p>}
                  <button className={`font-bold px-6 py-3 rounded-full mt-3 ${iAmReady ? "bg-white/15 text-white border border-white/30" : "bg-teal-400 text-black"}`} disabled={!canRematch} onClick={() => s.onlineRematch(!iAmReady)}>{iAmReady ? "Hủy ván lại" : "Ván lại"}</button>
                </div>
              );
            })()}
            <button className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-full mt-3" onClick={s.backToLobby}>Về sảnh</button>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
