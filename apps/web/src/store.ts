import { create } from "zustand";
import { createGame, attack, defend, transfer, resolveTake, resolveFinishAttack, drawStep, canAttackCard, canBeat, parseCard, cardLabel } from "../../../packages/game-core/src/engine";
import type { GameState } from "../../../packages/game-core/src/engine";
import { botDefendStep, botAttackStep, botAdderStep, lowestCard } from "./game/bot";
import { playDealSound, playCardSound, playDrawSound } from "./game/sound";
import { API_BASE, WS_URL, viewToGame } from "./game/online";
// WebSocket online (singleton, chỉ 1 kết nối mỗi phiên)
let onlineWs: WebSocket | null = null;
let onlineActionSeq = 0;
// Ham dang nhap popup da tai san (gan trong loadFirebaseConfig ngay khi mo trang).
// Ly do: await import() truoc khi mo popup lam mat cu chi bam nut, Chrome se chan popup
// voi loi auth/popup-blocked. Dung ham tai san thi popup mo ngay trong cung cu chi bam.
let popupLoginFn: ((cfg: unknown) => Promise<{ name: string; email: string; avatar: string | null; idToken: string }>) | null = null;
function onlineSend(obj: Record<string, unknown>) { if (onlineWs && onlineWs.readyState === 1) onlineWs.send(JSON.stringify(obj)); }
function onlinePlayerToken(code: string) { try { return localStorage.getItem(`tanloc-online-${code}`) || null; } catch { return null; } }
function onlineSaveToken(code: string, token: string) { try { localStorage.setItem(`tanloc-online-${code}`, token); } catch { /* bỏ qua */ } }
function onlineSession() { try { return localStorage.getItem("tanloc-session") || null; } catch { return null; } }

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
function cloneGame(g: GameState): GameState {
  return { ...g, players: g.players.map((p) => ({ ...p, hand: [...p.hand] })), drawPile: [...g.drawPile], discardPile: [...g.discardPile], table: g.table.map((x) => ({ ...x })), pendingDraw: [...(g.pendingDraw || [])] };
}
export const HUMAN_ID = "player_0";

export interface FlyingCard { cardId: string; by: string; key: number; }
export interface ChatMsg { id: number; from: string; text: string; }
const BOT_REPLIES = ["Chơi hay đấy!", "Lá này khó đỡ quá!", "Tới lượt bạn rồi kìa.", "Haha, ván này căng!", "Để xem bạn đỡ sao đây.", "Bài mình cũng không đẹp lắm đâu."];

interface GameStore {
  screen: "login" | "lobby" | "rooms" | "create" | "waiting" | "game"; waitingCode: string | null; waitingCount: number; waitingReady: boolean; waitingMode: "private" | "quick" | "join"; myId: string; onlineMode: boolean; onlineRoom: { code: string; bet: string; maxPlayers: number; hostId: string; state: string; players: { id: string; name: string; avatar: string | null; ready: boolean; online: boolean; isHost: boolean }[] } | null; onlineMyLobbyId: string | null; onlineWsStatus: string; onlineError: string | null; googleUser: { name: string; email: string; avatar: string | null } | null; firebaseConfig: Record<string, string> | null; authError: string | null; configLoading: boolean;
  // Mã phòng riêng (chơi với bạn): hiện luôn góc phải trong ván, thoát ván là hết.
  roomCode: string | null; createPrivate: boolean;
  playerName: string; playerCount: number; allowTransfer: boolean;
  game: GameState | null; selected: string | null; humanAddPassed: boolean;
  botBusy: boolean;
  // Thông báo ngắn gọn hiện dạng toast (thay khung log dài cũ).
  notice: string | null; noticeKey: number;
  // Lá đang bay lên bàn (hiệu ứng), key đổi mỗi lần đánh để animation chạy lại.
  flying: FlyingCard | null;
  // Lá đang bốc từ nọc: bay từ giữa bàn tới góc của người bốc, từng lá một.
  drawFlying: { cardId: string; toId: string; key: number } | null; drawing: boolean;
  // Chat chỉ tồn tại trong ván: chỉ ở bộ nhớ, không lưu DB, không localStorage.
  chat: ChatMsg[];
  setPlayerName: (v: string) => void; setPlayerCount: (v: number) => void; setAllowTransfer: (v: boolean) => void;
  startGame: () => void; backToLobby: () => void; goToRooms: () => void; goToCreate: (isPrivate: boolean) => void; goToWaiting: (code: string, count: number, mode: "private" | "quick" | "join") => void; setWaitingReady: (v: boolean) => void; setRoomCode: (code: string | null) => void; setSelected: (v: string | null) => void;
  playCard: (cardId: string) => void; defendPair: (attackId: string, defenseCardId?: string) => void;
  takeCards: () => void; finishAttackAction: () => void; transferCard: () => void; passAdd: () => void;
  drawCards: () => Promise<void>; runDrawPhase: () => Promise<void>; sortHand: (mode: "suit" | "rank") => void;
  runBots: () => Promise<void>; addLog: (msg: string) => void;
  sendChat: (text: string) => void; clearNotice: () => void;
  autoLowestAttack: () => void; passAttack: () => void; followWindow: { mode: "take" | "add"; takerId?: string; key: number } | null; resolveTakeFollow: () => void; passFollow: () => void; takeAnimCards: string[] | null; clearTakeAnim: () => void;
  onlineConnect: (m: Record<string, unknown>) => void; onlineCreateRoom: (bet: string, count: number) => void; onlineJoinRoom: (code: string) => void; onlineReady: (v: boolean) => void; onlineStart: () => void; onlineLeave: () => void; setGoogleUser: (u: { name: string; email: string; avatar: string | null } | null) => void; loadFirebaseConfig: () => Promise<void>; firebaseLogin: () => Promise<void>; googleLogout: () => Promise<void>;
}

// Lá mới xuất hiện trên bàn sau một nước đi (so với trước nước đi).
function newTableCard(before: Set<string>, game: GameState): string | null {
  for (const pair of game.table) {
    if (!before.has(pair.attack.id)) return pair.attack.id;
    if (pair.defense && !before.has(pair.defense.id)) return pair.defense.id;
  }
  return null;
}
function tableIds(game: GameState): Set<string> {
  const s = new Set<string>();
  for (const pair of game.table) { s.add(pair.attack.id); if (pair.defense) s.add(pair.defense.id); }
  return s;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  screen: "login", roomCode: null, waitingCode: null, waitingCount: 4, waitingReady: false, waitingMode: "private", myId: HUMAN_ID, onlineMode: false, onlineRoom: null, onlineMyLobbyId: null, onlineWsStatus: "disconnected", onlineError: null, googleUser: null, firebaseConfig: null, authError: null, configLoading: true, createPrivate: false, playerName: "Bạn", playerCount: 4, allowTransfer: true,
  game: null, selected: null, humanAddPassed: false, botBusy: false,
  notice: null, noticeKey: 0, flying: null, drawFlying: null, drawing: false, chat: [],
  setPlayerName: (v) => set({ playerName: v }),
  setPlayerCount: (v) => set({ playerCount: v }),
  setAllowTransfer: (v) => set({ allowTransfer: v }),
  setSelected: (v) => set({ selected: v }),
  addLog: (msg) => set((s) => ({ notice: msg, noticeKey: s.noticeKey + 1 })),
  clearNotice: () => set({ notice: null }),
  sendChat: (text) => {
    const t = text.trim(); if (!t) return;
    if (get().onlineMode) { onlineSend({ type: "chat", text: t }); return; }
    const st = store.getState();
    const me = st.playerName.trim() || "Bạn";
    const id = Date.now();
    set((s) => ({ chat: [...s.chat, { id, from: me, text: t }] }));
    // Bot trả lời cho vui, chỉ trong ván này, không lưu đâu cả.
    const bot = st.game?.players.find((p) => p.id !== HUMAN_ID);
    if (bot) {
      const reply = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
      window.setTimeout(() => {
        if (store.getState().screen === "game") set((s) => ({ chat: [...s.chat, { id: id + 1, from: bot.name, text: reply }] }));
      }, 900);
    }
  },
  backToLobby: () => { const st = get(); if (st.onlineMode) { try { onlineSend({ type: "leave" }); } catch { /* bỏ qua */ } try { onlineWs?.close(); } catch { /* bỏ qua */ } set({ screen: st.googleUser ? "lobby" : "login", game: null, selected: null, notice: null, flying: null, chat: [], roomCode: null, onlineMode: false, onlineRoom: null, onlineMyLobbyId: null, followWindow: null, takeAnimCards: null }); return; } set({ screen: st.googleUser ? "lobby" : "login", game: null, selected: null, notice: null, flying: null, chat: [], roomCode: null }); },
  goToRooms: () => set({ screen: "rooms" }),
  goToCreate: (isPrivate) => set({ screen: "create", createPrivate: isPrivate }),
  goToWaiting: (code, count, mode) => set({ screen: "waiting", waitingCode: code, waitingCount: count, waitingReady: false, waitingMode: mode, roomCode: code }),
  setWaitingReady: (v) => set({ waitingReady: v }),
  setRoomCode: (code) => set({ roomCode: code }),
  startGame: () => {
    const { playerName, playerCount } = get(); const allowTransfer = false; // Tony bo chuc nang chuyen tan
    const names = [playerName.trim() || "Bạn"];
    for (let i = 1; i < playerCount; i++) names.push(`Bot ${i}`);
    const game = createGame({ playerCount, playerNames: names, allowTransfer });
    // Vòng tấn đi NGƯỢC chiều kim đồng hồ, khớp vị trí trên bàn:
    // Mình (dưới) -> Bot3 (phải) -> Bot1 (trên) -> Bot2 (trái) -> Mình.
    // Nên thứ tự ghế phải là [Mình, Bot3, Bot1, Bot2]; engine tính người đỡ
    // = người kế tiếp trong mảng players, nên xếp lại mảng rồi tính lại defender.
    {
      const byName = new Map(game.players.map((pl) => [pl.name, pl]));
      const seatNames = playerCount === 4 ? [names[0], "Bot 3", "Bot 1", "Bot 2"]
        : playerCount === 3 ? [names[0], "Bot 2", "Bot 1"] : [names[0], "Bot 1"];
      const seated = seatNames.map((n) => byName.get(n)).filter((x): x is typeof game.players[number] => !!x);
      if (seated.length === game.players.length) {
        game.players = seated;
        const ai = seated.findIndex((pl) => pl.id === game.attackerId);
        const di = seated[(ai + 1) % seated.length];
        game.defenderId = di.id;
        game.defenderInitialHandCount = di.hand.length;
      }
    }
    set({ screen: "game", game: cloneGame(game), selected: null, humanAddPassed: false, followWindow: null, takeAnimCards: null, myId: HUMAN_ID, onlineMode: false, chat: [{ id: Date.now(), from: "Hệ thống", text: "Chat trong ván này thôi, thoát ván là mất, không lưu lại." }], notice: `Ván mới: chất chủ ${game.trumpSuit}, ${game.players.find((p) => p.id === game.attackerId)?.name} tấn đầu.`, noticeKey: Date.now() });
    playDealSound();
    void get().runBots();
  },
  playCard: () => {},
  defendPair: () => {},
  takeCards: () => {},
  finishAttackAction: () => {},
  transferCard: () => {},
  passAdd: () => {},
  runBots: async () => {},
  drawCards: async () => {},
  runDrawPhase: async () => {},
  sortHand: () => {},
  autoLowestAttack: () => {},
  passAttack: () => {},
  followWindow: null, resolveTakeFollow: () => {}, passFollow: () => {}, takeAnimCards: null, clearTakeAnim: () => {}, onlineConnect: () => {}, onlineCreateRoom: () => {}, onlineJoinRoom: () => {}, onlineReady: () => {}, onlineStart: () => {}, onlineLeave: () => {}, setGoogleUser: () => {}, loadFirebaseConfig: async () => {}, firebaseLogin: async () => {}, googleLogout: async () => {},
}));

// Gán các action sau khi store tạo xong để tránh vòng tham chiếu trong create().
const store = useGameStore;
store.setState({
  playCard: (cardId: string) => {
    const { game, selected, onlineMode, myId } = store.getState();
    if (!game || game.phase === "FINISHED") return;
    if (onlineMode) {
      const meO = game.players.find((pl) => pl.id === myId); if (!meO) return;
      if (game.defenderId === myId) {
        const card = parseCard(cardId);
        const beatable = game.table.filter((x) => !x.defense && canBeat(x.attack, card, game.trumpSuit));
        if (beatable.length === 1) { store.getState().defendPair(beatable[0].attack.id, cardId); return; }
        if (beatable.length > 1) { store.setState({ selected: cardId }); return; }
        store.setState({ selected: cardId }); return;
      }
      const cardO = meO.hand.find((c) => c.id === cardId);
      if (cardO && canAttackCard(game, myId, cardO)) { onlineActionSeq++; onlineSend({ type: "command", actionId: `online-${Date.now()}-${onlineActionSeq}`, expectedVersion: game.version, cmdType: "ATTACK", payload: { cardId } }); store.setState({ selected: null }); }
      else store.setState({ selected: cardId });
      return;
    }
    const me = game.players.find((p) => p.id === HUMAN_ID); if (!me) return;
    if (game.defenderId === HUMAN_ID) {
      const card = parseCard(cardId);
      const beatable = game.table.filter((x) => !x.defense && canBeat(x.attack, card, game.trumpSuit));
      // BUG cũ: defendPair đọc `selected` trong store, mà lúc bấm lá thì selected
      // vẫn rỗng nên nó return im lặng, không đỡ gì cả. Giờ truyền thẳng lá vừa bấm.
      if (beatable.length === 1) { store.getState().defendPair(beatable[0].attack.id, cardId); return; }
      if (beatable.length > 1) { store.setState({ selected: cardId }); store.getState().addLog(`Dùng ${cardLabel(card)} đỡ lá nào? Bấm 1 lá tấn trên bàn để chọn.`); return; }
      store.setState({ selected: cardId });
      store.getState().addLog(`${cardLabel(card)} không đỡ được lá nào trên bàn, thử lá khác hoặc bấm Lên bài.`);
      return;
    }
    const card = me.hand.find((c) => c.id === cardId);
    if (card && canAttackCard(game, HUMAN_ID, card)) {
      const before = tableIds(game);
      try { attack(game, HUMAN_ID, cardId); const played = newTableCard(before, game); store.setState({ game: cloneGame(game), selected: null, humanAddPassed: false, followWindow: null, flying: played ? { cardId: played, by: HUMAN_ID, key: Date.now() } : null }); playCardSound(); store.getState().addLog(`Bạn đánh ${cardLabel(card)}.`); void store.getState().runBots(); } catch (e) { alert((e as Error).message); }
    } else { store.setState({ selected: cardId }); }
    void selected;
  },
  defendPair: (attackId: string, defenseCardId?: string) => {
    const { game, selected, onlineMode, myId } = store.getState();
    if (onlineMode) {
      const defenseId = defenseCardId || selected; if (!game || !defenseId) return;
      onlineActionSeq++; onlineSend({ type: "command", actionId: `online-${Date.now()}-${onlineActionSeq}`, expectedVersion: game.version, cmdType: "DEFEND", payload: { attackCardId: attackId, defenseCardId: defenseId } }); store.setState({ selected: null }); return;
    }
    const defenseId = defenseCardId || selected;
    if (!game || !defenseId) return;
    const before = tableIds(game);
    try { defend(game, HUMAN_ID, attackId, defenseId); const played = newTableCard(before, game); store.setState({ game: cloneGame(game), selected: null, humanAddPassed: false, flying: played ? { cardId: played, by: HUMAN_ID, key: Date.now() } : null }); playCardSound(); store.getState().addLog(`Bạn đỡ ${attackId} bằng ${cardLabel(parseCard(defenseId))}.`); void store.getState().runBots(); } catch (e) { alert((e as Error).message); }
  },
  takeCards: () => {
    const { game, onlineMode } = store.getState(); if (!game) return;
    if (onlineMode) {
      const taken: string[] = []; for (const pr of game.table) { taken.push(pr.attack.id); if (pr.defense) taken.push(pr.defense.id); }
      onlineActionSeq++; onlineSend({ type: "command", actionId: `online-${Date.now()}-${onlineActionSeq}`, expectedVersion: game.version, cmdType: "TAKE", payload: {} }); store.setState({ selected: null, takeAnimCards: taken.length ? taken : null }); return;
    }
    // Hiệu ứng lên bài: giữ lại các lá trên bàn để App vẽ bay vào tay mình, rồi mới dọn bàn.
    const taken: string[] = []; for (const pr of game.table) { taken.push(pr.attack.id); if (pr.defense) taken.push(pr.defense.id); }
    try { resolveTake(game, HUMAN_ID); store.setState({ game: cloneGame(game), selected: null, takeAnimCards: taken.length ? taken : null }); store.getState().addLog("Bạn lên bài, nhận cả bàn."); void store.getState().runDrawPhase(); } catch (e) { alert((e as Error).message); }
  },
  finishAttackAction: () => {
    const { game, onlineMode } = store.getState(); if (!game) return;
    if (onlineMode) { onlineActionSeq++; onlineSend({ type: "command", actionId: `online-${Date.now()}-${onlineActionSeq}`, expectedVersion: game.version, cmdType: "FINISH_ATTACK", payload: {} }); return; }
    try { resolveFinishAttack(game, HUMAN_ID); store.setState({ game: cloneGame(game) }); store.getState().addLog("Bạn kết thúc đợt."); void store.getState().runDrawPhase(); } catch (e) { alert((e as Error).message); }
  },
  // Bốc bài: người chơi bấm nút, bốc từng lá (hiệu ứng bay từ nọc) cho đủ 8 lá,
  // rồi tới lượt bot bốc, xong mới vào đợt mới. Không tự bốc ầm ầm nữa.
  drawCards: async () => {
    const st = store.getState(); if (!st.game || st.game.phase !== "DRAWING" || st.drawing) return;
    store.setState({ drawing: true });
    try {
      while (true) {
        const g = store.getState().game; if (!g || g.phase !== "DRAWING") break;
        const nextId = g.pendingDraw[0]; if (!nextId) break;
        if (nextId !== HUMAN_ID) break; // tới bot, để runDrawPhase lo
        const card = drawStep(g);
        if (!card) { store.setState({ game: cloneGame(g) }); break; }
        playDrawSound(); store.setState({ game: cloneGame(g), drawFlying: { cardId: card.id, toId: HUMAN_ID, key: Date.now() } });
        await delay(450);
      }
    } finally { store.setState({ drawing: false, drawFlying: null }); }
    void store.getState().runDrawPhase();
  },
  runDrawPhase: async () => {
    const st = store.getState(); if (!st.game || st.game.phase !== "DRAWING" || st.drawing) {
      if (st.game?.phase !== "DRAWING") void store.getState().runBots();
      return;
    }
    // Nếu tới lượt người bốc, dừng lại chờ người bấm nút Bốc bài.
    if (st.game.pendingDraw[0] === HUMAN_ID) return;
    store.setState({ drawing: true });
    try {
      while (true) {
        const g = store.getState().game; if (!g || g.phase !== "DRAWING") break;
        const nextId = g.pendingDraw[0]; if (!nextId) break;
        if (nextId === HUMAN_ID) break;
        const card = drawStep(g);
        if (!card) { store.setState({ game: cloneGame(g) }); break; }
        playDrawSound(); store.setState({ game: cloneGame(g), drawFlying: { cardId: card.id, toId: nextId, key: Date.now() } });
        await delay(450);
      }
    } finally { store.setState({ drawing: false, drawFlying: null }); }
    const g2 = store.getState().game;
    if (g2?.phase === "DRAWING" && g2.pendingDraw[0] === HUMAN_ID) return;
    void store.getState().runBots();
  },
  transferCard: () => {
    const { game, selected } = store.getState(); if (!game || !selected) return;
    const before = tableIds(game);
    try { transfer(game, HUMAN_ID, selected); const played = newTableCard(before, game); store.setState({ game: cloneGame(game), selected: null, flying: played ? { cardId: played, by: HUMAN_ID, key: Date.now() } : null }); store.getState().addLog(`Bạn chuyển tấn bằng ${selected}.`); void store.getState().runBots(); } catch (e) { alert((e as Error).message); }
  },
  passAdd: () => { store.setState({ humanAddPassed: true }); void store.getState().runBots(); },
  sortHand: (mode) => {
    const { game } = store.getState(); if (!game) return;
    const me = game.players.find((p) => p.id === HUMAN_ID); if (!me) return;
    // Xep bai: "suit" = nhom cung chat, trong chat tu A xuong 2;
    // "rank" = nhom la cung hang, tu A xuong 2, trong nhom theo chat.
    const suitOrder: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };
    const sorted = [...me.hand].sort((a, b) => {
      if (mode === "suit") return suitOrder[a.suit] - suitOrder[b.suit] || b.rank - a.rank;
      return b.rank - a.rank || suitOrder[a.suit] - suitOrder[b.suit];
    });
    me.hand = sorted;
    store.setState({ game: cloneGame(game) });
  },
  autoLowestAttack: () => {
    const { game } = store.getState(); if (store.getState().onlineMode) {
      const g = store.getState().game; if (!g) return;
      const myId = store.getState().myId; const me = g.players.find((pl) => pl.id === myId); if (!me || !me.hand.length) return;
      let card = lowestCard(me.hand, g.trumpSuit);
      if (g.table.length > 0) { const addable = me.hand.filter((c) => canAttackCard(g, myId, c)); if (!addable.length) { store.getState().finishAttackAction(); return; } card = lowestCard(addable, g.trumpSuit); }
      onlineActionSeq++; onlineSend({ type: "command", actionId: `online-${Date.now()}-${onlineActionSeq}`, expectedVersion: g.version, cmdType: "ATTACK", payload: { cardId: card.id } }); return;
    } if (!game) return;
    const me = game.players.find((p) => p.id === HUMAN_ID); if (!me || !me.hand.length) return;
    // Hết giờ tấn: tự đánh lá yếu nhất có thể đánh được. Bàn trống thì lá yếu nhất tay;
    // đã tấn + đỡ hết thì lá yếu nhất trong các lá thêm được cùng hạng; không thêm được thì kết thúc đợt.
    let card = lowestCard(me.hand, game.trumpSuit);
    if (game.table.length > 0) {
      const addable = me.hand.filter((c) => canAttackCard(game, HUMAN_ID, c));
      if (!addable.length) { store.getState().finishAttackAction(); return; }
      card = lowestCard(addable, game.trumpSuit);
    }
    const before = tableIds(game);
    try { attack(game, HUMAN_ID, card.id); const played = newTableCard(before, game); store.setState({ game: cloneGame(game), flying: played ? { cardId: played, by: HUMAN_ID, key: Date.now() } : null }); store.getState().addLog(`Hết giờ: tự đánh ${cardLabel(card)}.`); void store.getState().runBots(); } catch { /* bỏ qua */ }
  },
  passAttack: () => {
    const { game } = store.getState(); if (!game || game.table.length > 0 || game.attackerId !== HUMAN_ID) return;
    const seated = game.players; const oldDef = game.defenderId;
    let ni = seated.findIndex((pl) => pl.id === oldDef);
    let next = seated[ni];
    for (let k = 0; k < seated.length; k++) { const cand = seated[(ni + k) % seated.length]; if (!cand.finished) { next = cand; ni = (ni + k) % seated.length; break; } }
    game.attackerId = next.id;
    let di = (ni + 1) % seated.length;
    for (let k = 0; k < seated.length; k++) { const cand = seated[(di + k) % seated.length]; if (!cand.finished && cand.id !== next.id) { di = (di + k) % seated.length; break; } }
    game.defenderId = seated[di].id;
    game.defenderInitialHandCount = seated[di].hand.length;
    game.version++;
    store.setState({ game: cloneGame(game) });
    store.getState().addLog(`Hết giờ tấn: hết lượt tấn, chuyển lượt tấn cho ${next.name}.`);
    void store.getState().runBots();
  },
  resolveTakeFollow: () => {
    const { game, followWindow, onlineMode } = store.getState(); if (onlineMode) return;
    if (!game || !followWindow || followWindow.mode !== "take" || !followWindow.takerId) return;
    const taker = game.players.find((pl) => pl.id === followWindow.takerId); if (!taker) return;
    try { resolveTake(game, followWindow.takerId); } catch { return; }
    store.setState({ game: cloneGame(game), followWindow: null });
    store.getState().addLog(`${taker.name} lên bài, nhận cả bàn.`);
    void store.getState().runDrawPhase();
  },
  passFollow: () => {
    const { followWindow, onlineMode } = store.getState(); if (!followWindow) return;
    if (onlineMode) { onlineActionSeq++; onlineSend({ type: "command", actionId: `online-${Date.now()}-${onlineActionSeq}`, expectedVersion: store.getState().game?.version || 0, cmdType: "PASS_ADD", payload: {} }); store.setState({ followWindow: null }); return; }
    if (followWindow.mode === "take") { store.getState().resolveTakeFollow(); return; }
    store.setState({ followWindow: null, humanAddPassed: true });
    void store.getState().runBots();
  },
  // ---- Chơi online qua WebSocket ----
  onlineConnect: (firstMsg: Record<string, unknown>) => {
    try { onlineWs?.close(); } catch { /* bỏ qua */ }
    store.setState({ onlineWsStatus: "connecting", onlineError: null });
    const ws = new WebSocket(WS_URL); onlineWs = ws;
    ws.onopen = () => { store.setState({ onlineWsStatus: "connected" }); ws.send(JSON.stringify(firstMsg)); };
    ws.onclose = () => { const st = store.getState(); if (st.onlineMode || st.screen === "waiting") store.setState({ onlineWsStatus: "disconnected" }); };
    ws.onerror = () => { store.setState({ onlineWsStatus: "error", onlineError: "Không kết nối được máy chủ (Render có thể đang ngủ, thử lại sau vài giây)." }); };
    ws.onmessage = (ev) => {
      let m: Record<string, unknown>;
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      const st = store.getState();
      if (m.type === "joined") {
        onlineSaveToken(String(m.code), String(m.token));
        store.setState({ onlineMyLobbyId: String(m.playerId), waitingCode: String(m.code), roomCode: String(m.code), screen: "waiting", onlineMode: true, onlineError: null });
      } else if (m.type === "room") {
        store.setState({ onlineRoom: { code: String(m.code), bet: String(m.bet), maxPlayers: Number(m.maxPlayers), hostId: String(m.hostId), state: String(m.state), players: (m.players as { id: string; name: string; avatar: string | null; ready: boolean; online: boolean; isHost: boolean }[]) }, waitingCode: String(m.code) });
        if (m.state === "playing" && st.screen !== "game") store.setState({ screen: "game" });
      } else if (m.type === "game") {
        const view = m.view as Record<string, unknown>;
        const myEngineId = String(m.myEngineId);
        const g = viewToGame(view, myEngineId) as unknown as GameState;
        const prev = st.game;
        const played = prev ? (() => { const before = new Set<string>(); for (const pr of prev.table) { before.add(pr.attack.id); if (pr.defense) before.add(pr.defense.id); } for (const pr of g.table) { if (!before.has(pr.attack.id)) return pr.attack.id; if (pr.defense && !before.has(pr.defense.id)) return pr.defense.id; } return null; })() : null;
        store.setState({ game: cloneGame(g), myId: myEngineId, onlineMode: true, screen: "game", selected: null, flying: played ? { cardId: played, by: "online", key: Date.now() } : st.flying });
        if (played) playCardSound();
      } else if (m.type === "follow") {
        const mode = m.mode === "take" ? "take" : "add";
        const meLobby = st.onlineMyLobbyId;
        const iAmAdder = meLobby && (m.adders as string[]).includes(meLobby);
        if (iAmAdder) store.setState({ followWindow: { mode, takerId: undefined, key: Date.now() } });
        store.getState().addLog(mode === "take" ? `${m.actorName} lên bài - bạn có 5s để theo!` : `Bạn có 5s để theo!`);
      } else if (m.type === "follow-end") {
        store.setState({ followWindow: null });
      } else if (m.type === "chat") {
        store.setState((s) => ({ chat: [...s.chat, { id: Date.now(), from: String(m.from), text: String(m.text) }] }));
      } else if (m.type === "command-result") {
        if (!m.accepted) store.getState().addLog(String(m.message || "Nước đi không hợp lệ"));
      } else if (m.type === "error") {
        store.setState({ onlineError: String(m.message || m.code) });
      }
    };
  },
  onlineCreateRoom: (bet: string, count: number) => {
    const st = store.getState();
    store.setState({ onlineMode: true, screen: "waiting", waitingMode: "private", waitingCount: count });
    (store.getState() as unknown as { onlineConnect: (m: Record<string, unknown>) => void }).onlineConnect({ type: "create", name: st.playerName.trim() || "Bạn", avatar: st.googleUser?.avatar || null, maxPlayers: count, bet, sessionToken: onlineSession() });
  },
  onlineJoinRoom: (code: string) => {
    const st = store.getState();
    store.setState({ onlineMode: true, screen: "waiting", waitingMode: "join", waitingCode: code });
    (store.getState() as unknown as { onlineConnect: (m: Record<string, unknown>) => void }).onlineConnect({ type: "join", code, name: st.playerName.trim() || "Bạn", avatar: st.googleUser?.avatar || null, token: onlinePlayerToken(code), sessionToken: onlineSession() });
  },
  onlineReady: (v: boolean) => { store.setState({ waitingReady: v }); onlineSend({ type: "ready", ready: v }); },
  onlineStart: () => { onlineSend({ type: "start" }); },
  onlineLeave: () => { try { onlineSend({ type: "leave" }); } catch { /* bỏ qua */ } try { onlineWs?.close(); } catch { /* bỏ qua */ } store.setState({ onlineMode: false, onlineRoom: null, onlineMyLobbyId: null, game: null, screen: "lobby" }); },
  setGoogleUser: (u: { name: string; email: string; avatar: string | null } | null) => { store.setState({ googleUser: u }); if (u) store.setState({ playerName: u.name }); },
  loadFirebaseConfig: async () => {
    // Backend Render gói free ngủ đông: lần gọi đầu có thể chậm 30-50s, nên không vội kết luận
    // là "chưa cấu hình" khi fetch chưa xong; thử lại tối đa 3 lần rồi mới thôi.
    store.setState({ configLoading: true });
    let j: { firebaseConfig?: Record<string, string> | null } | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
    for (let attempt = 0; attempt < 3 && !j?.firebaseConfig; attempt++) {
      try {
        const r = await fetch(`${API_BASE}/auth/config`); j = await r.json();
        if (j?.firebaseConfig) break;
      } catch { /* thử lại */ }
      if (!j?.firebaseConfig && attempt < 2) await new Promise((res) => setTimeout(res, 3000));
    }
    if (!j?.firebaseConfig) { store.setState({ configLoading: false }); return; }
    try {
      store.setState({ firebaseConfig: j.firebaseConfig, authError: null, configLoading: false });
      // Tai san chunk Firebase + ham popup ngay tu bay gio (trang dang nhap vua mo),
      // de luc bam nut dang nhap khong con phai cho import nua.
      try { const m = await import("./game/firebase-auth"); popupLoginFn = m.signInGoogleFirebase as unknown as typeof popupLoginFn; } catch { /* popup se import lai luc bam */ }
      // Đổi token Firebase lấy session backend (dùng chung cho cả redirect và watch).
      const exchange = async (fb: { idToken: string }) => {
        const rr = await fetch(`${API_BASE}/auth/firebase`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: fb.idToken }) });
        const jj = await rr.json();
        if (!rr.ok) throw new Error(jj.message || jj.error || "Đăng nhập Google thất bại");
        try { localStorage.setItem("tanloc-session", jj.sessionToken); } catch { /* bỏ qua */ }
        store.setState((prev) => ({ googleUser: jj.user, playerName: jj.user.name, screen: prev.screen === "login" ? "lobby" : prev.screen, authError: null }));
      };
      // 1) Vừa quay lại từ Google: lấy kết quả redirect trực tiếp (đáng tin hơn watch trong trường hợp này).
      try {
        const { handleGoogleRedirect } = await import("./game/firebase-auth");
        const fb = await handleGoogleRedirect(j.firebaseConfig as unknown as Parameters<typeof handleGoogleRedirect>[0]);
        if (fb) await exchange(fb);
      } catch (e) { store.setState({ authError: (e as Error).message }); }
      // 2) Theo dõi trạng thái Firebase: đã đăng nhập từ trước (tải lại trang) cũng vào đây;
      // chỉ chuyển sang sảnh khi đang ở màn đăng nhập, không đá khỏi ván đang chơi.
      try {
        const { watchFirebaseUser } = await import("./game/firebase-auth");
        if (!(globalThis as unknown as { __tanlocWatch?: boolean }).__tanlocWatch) {
          (globalThis as unknown as { __tanlocWatch?: boolean }).__tanlocWatch = true;
          watchFirebaseUser(j.firebaseConfig as unknown as Parameters<typeof watchFirebaseUser>[0], async (fb) => {
            if (!fb) return;
            try { await exchange(fb); } catch (e) { store.setState({ authError: (e as Error).message }); }
          });
        }
      } catch { /* chưa đăng nhập thì ở lại màn đăng nhập */ }
    } catch { /* chưa có backend thì thôi */ }
  },
  firebaseLogin: async () => {
    const cfg = store.getState().firebaseConfig;
    if (!cfg || !cfg.apiKey || !cfg.projectId || !cfg.appId) throw new Error("Firebase chưa cấu hình trên Render");
    // Dang nhap POPUP (khong redirect): app host o Vercel, redirect bi trinh duyet
    // chan luu tru cross-origin tu firebaseapp.com nen quay ve im lang khong loi.
    // Mo popup NGAY trong cung cu chi bam nut: neu ham da tai san thi goi thang,
    // khong await import truoc (await import lam mat cu chi, Chrome chan popup).
    // Chi khi chua tai san moi import lai (truong hop hiem, co the bi chan).
    const popupFn = popupLoginFn || (await import("./game/firebase-auth")).signInGoogleFirebase;
    const fb = await popupFn(cfg as unknown as Parameters<typeof popupFn>[0]);
    // Doi token Firebase lay session backend, giong luong redirect/watch cu.
    const rr = await fetch(`${API_BASE}/auth/firebase`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: fb.idToken }) });
    const jj = await rr.json();
    if (!rr.ok) throw new Error(jj.message || jj.error || "Đăng nhập Google thất bại");
    try { localStorage.setItem("tanloc-session", jj.sessionToken); } catch { /* bỏ qua */ }
    store.setState((prev) => ({ googleUser: jj.user, playerName: jj.user.name, screen: prev.screen === "login" ? "lobby" : prev.screen, authError: null }));
  },
  googleLogout: async () => {
    try { localStorage.removeItem("tanloc-session"); } catch { /* bỏ qua */ }
    try { const m = await import("./game/firebase-auth"); await m.signOutFirebase(); } catch { /* bỏ qua */ }
    store.setState({ googleUser: null, screen: "login" });
  },
  runBots: async () => {
    const s = store.getState(); if (s.onlineMode) return; if (s.botBusy || !s.game || s.game.phase === "FINISHED") return;
    if (s.game.phase === "DRAWING") { void store.getState().runDrawPhase(); return; }
    store.setState({ botBusy: true });
    try {
      let guard = 0;
      while (guard++ < 100) {
        const game = store.getState().game; if (!game || game.phase === "FINISHED") break;
        if (game.phase === "DRAWING") { void store.getState().runDrawPhase(); break; }
        await delay(700);
        const g = store.getState().game; if (!g || g.phase === "FINISHED") break;
        if (g.phase === "DRAWING") { void store.getState().runDrawPhase(); break; }
        const defender = g.players.find((p) => p.id === g.defenderId); const attacker = g.players.find((p) => p.id === g.attackerId);
        if (!defender || !attacker) break;
        // Chạy 1 nước bot, đồng thời bắt lá vừa đánh để làm hiệu ứng bay.
        const applyBot = (actorId: string, fn: () => string | null) => {
          const before = tableIds(g);
          const msg = fn();
          if (msg && msg.startsWith("TAKE:")) {
            const takerId = msg.split(":")[1];
            const taker = g.players.find((pl) => pl.id === takerId);
            const human = g.players.find((pl) => pl.id === HUMAN_ID);
            const humanCanAdd = human && !human.finished && human.hand.some((c) => canAttackCard(g, HUMAN_ID, c));
            if (humanCanAdd) {
              store.setState({ followWindow: { mode: "take", takerId, key: Date.now() } });
              store.getState().addLog(`${taker?.name || "Bot"} lên bài - bạn có 5s để theo!`);
            } else {
              try { resolveTake(g, takerId); } catch { /* bỏ qua */ }
              store.setState({ game: cloneGame(g) });
              store.getState().addLog(`${taker?.name || "Bot"} không đỡ được, lên bài, nhận cả bàn.`);
            }
            return;
          }
          const played = newTableCard(before, g);
          if (played) playCardSound();
          store.setState({ game: cloneGame(g), humanAddPassed: false, flying: played ? { cardId: played, by: actorId, key: Date.now() } : undefined });
          if (msg) store.getState().addLog(msg);
        };
        const undefended = g.table.filter((x) => !x.defense);
        if (g.table.length > 0 && undefended.length > 0) {
          if (defender.id !== HUMAN_ID) { applyBot(defender.id, () => botDefendStep(g, defender)); if (store.getState().followWindow) break; continue; }
          break;
        }
        if (g.table.length === 0) {
          if (attacker.id !== HUMAN_ID && !attacker.finished) { applyBot(attacker.id, () => botAttackStep(g, attacker)); continue; }
          break;
        }
        // Bot tấn sắp thêm/kết thúc mà mình còn lá theo được: dừng lại, mở cửa sổ theo 5s cho mình, đừng kết thúc lượt vội.
        {
          const human = g.players.find((pl) => pl.id === HUMAN_ID);
          const humanCanAdd = human && !human.finished && g.table.length > 0 && g.table.every((x) => x.defense) && human.hand.some((c) => canAttackCard(g, HUMAN_ID, c));
          if (attacker.id !== HUMAN_ID && humanCanAdd && !store.getState().humanAddPassed && !store.getState().followWindow) { store.setState({ followWindow: { mode: "add", key: Date.now() } }); break; }
        }
        if (attacker.id !== HUMAN_ID) { applyBot(attacker.id, () => botAttackStep(g, attacker)); continue; }
        if (attacker.id === HUMAN_ID) break;
        const human = g.players.find((p) => p.id === HUMAN_ID);
        const humanCanAdd = human && !human.finished && human.hand.some((c) => canAttackCard(g, HUMAN_ID, c));
        if (humanCanAdd && !store.getState().humanAddPassed) break;
        const adderBot = g.players.find((p) => p.id !== HUMAN_ID && p.id !== g.defenderId && !p.finished && p.hand.some((c) => canAttackCard(g, p.id, c)));
        if (adderBot) { applyBot(adderBot.id, () => botAdderStep(g, adderBot)); continue; }
        break;
      }
    } finally { store.setState({ botBusy: false }); }
  },
});
