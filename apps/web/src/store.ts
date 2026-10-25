import { create } from "zustand";
import { createGame, attack, defend, transfer, resolveTake, resolveFinishAttack, drawStep, canAttackCard, canBeat, parseCard, cardLabel } from "../../../packages/game-core/src/engine";
import type { GameState } from "../../../packages/game-core/src/engine";
import { botDefendStep, botAttackStep, botAdderStep, lowestCard } from "./game/bot";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
function cloneGame(g: GameState): GameState {
  return { ...g, players: g.players.map((p) => ({ ...p, hand: [...p.hand] })), drawPile: [...g.drawPile], discardPile: [...g.discardPile], table: g.table.map((x) => ({ ...x })), pendingDraw: [...(g.pendingDraw || [])] };
}
export const HUMAN_ID = "player_0";

export interface FlyingCard { cardId: string; by: string; key: number; }
export interface ChatMsg { id: number; from: string; text: string; }
const BOT_REPLIES = ["Chơi hay đấy!", "Lá này khó đỡ quá!", "Tới lượt bạn rồi kìa.", "Haha, ván này căng!", "Để xem bạn đỡ sao đây.", "Bài mình cũng không đẹp lắm đâu."];

interface GameStore {
  screen: "lobby" | "rooms" | "create" | "game";
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
  startGame: () => void; backToLobby: () => void; goToRooms: () => void; goToCreate: (isPrivate: boolean) => void; setRoomCode: (code: string | null) => void; setSelected: (v: string | null) => void;
  playCard: (cardId: string) => void; defendPair: (attackId: string, defenseCardId?: string) => void;
  takeCards: () => void; finishAttackAction: () => void; transferCard: () => void; passAdd: () => void;
  drawCards: () => Promise<void>; runDrawPhase: () => Promise<void>;
  runBots: () => Promise<void>; addLog: (msg: string) => void;
  sendChat: (text: string) => void; clearNotice: () => void;
  autoLowestAttack: () => void;
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
  screen: "lobby", roomCode: null, createPrivate: false, playerName: "Bạn", playerCount: 4, allowTransfer: true,
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
  backToLobby: () => set({ screen: "lobby", game: null, selected: null, notice: null, flying: null, chat: [], roomCode: null }),
  goToRooms: () => set({ screen: "rooms" }),
  goToCreate: (isPrivate) => set({ screen: "create", createPrivate: isPrivate }),
  setRoomCode: (code) => set({ roomCode: code }),
  startGame: () => {
    const { playerName, playerCount } = get(); const allowTransfer = false; // Tony bo chuc nang chuyen tan
    const names = [playerName.trim() || "Bạn"];
    for (let i = 1; i < playerCount; i++) names.push(`Bot ${i}`);
    const game = createGame({ playerCount, playerNames: names, allowTransfer });
    set({ screen: "game", game: cloneGame(game), selected: null, humanAddPassed: false, chat: [{ id: Date.now(), from: "Hệ thống", text: "Chat trong ván này thôi, thoát ván là mất, không lưu lại." }], notice: `Ván mới: chất chủ ${game.trumpSuit}, ${game.players.find((p) => p.id === game.attackerId)?.name} tấn đầu.`, noticeKey: Date.now() });
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
  autoLowestAttack: () => {},
}));

// Gán các action sau khi store tạo xong để tránh vòng tham chiếu trong create().
const store = useGameStore;
store.setState({
  playCard: (cardId: string) => {
    const { game, selected } = store.getState();
    if (!game || game.phase === "FINISHED") return;
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
      try { attack(game, HUMAN_ID, cardId); const played = newTableCard(before, game); store.setState({ game: cloneGame(game), selected: null, humanAddPassed: false, flying: played ? { cardId: played, by: HUMAN_ID, key: Date.now() } : null }); store.getState().addLog(`Bạn đánh ${cardLabel(card)}.`); void store.getState().runBots(); } catch (e) { alert((e as Error).message); }
    } else { store.setState({ selected: cardId }); }
    void selected;
  },
  defendPair: (attackId: string, defenseCardId?: string) => {
    const { game, selected } = store.getState();
    const defenseId = defenseCardId || selected;
    if (!game || !defenseId) return;
    const before = tableIds(game);
    try { defend(game, HUMAN_ID, attackId, defenseId); const played = newTableCard(before, game); store.setState({ game: cloneGame(game), selected: null, humanAddPassed: false, flying: played ? { cardId: played, by: HUMAN_ID, key: Date.now() } : null }); store.getState().addLog(`Bạn đỡ ${attackId} bằng ${cardLabel(parseCard(defenseId))}.`); void store.getState().runBots(); } catch (e) { alert((e as Error).message); }
  },
  takeCards: () => {
    const { game } = store.getState(); if (!game) return;
    try { resolveTake(game, HUMAN_ID); store.setState({ game: cloneGame(game), selected: null }); store.getState().addLog("Bạn lên bài, nhận cả bàn."); void store.getState().runDrawPhase(); } catch (e) { alert((e as Error).message); }
  },
  finishAttackAction: () => {
    const { game } = store.getState(); if (!game) return;
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
        store.setState({ game: cloneGame(g), drawFlying: { cardId: card.id, toId: HUMAN_ID, key: Date.now() } });
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
        store.setState({ game: cloneGame(g), drawFlying: { cardId: card.id, toId: nextId, key: Date.now() } });
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
  autoLowestAttack: () => {
    const { game } = store.getState(); if (!game) return;
    const me = game.players.find((p) => p.id === HUMAN_ID); if (!me || !me.hand.length) return;
    const card = lowestCard(me.hand, game.trumpSuit);
    const before = tableIds(game);
    try { attack(game, HUMAN_ID, card.id); const played = newTableCard(before, game); store.setState({ game: cloneGame(game), flying: played ? { cardId: played, by: HUMAN_ID, key: Date.now() } : null }); store.getState().addLog(`Hết giờ: tự đánh ${cardLabel(card)}.`); void store.getState().runBots(); } catch { /* bỏ qua */ }
  },
  runBots: async () => {
    const s = store.getState(); if (s.botBusy || !s.game || s.game.phase === "FINISHED") return;
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
          const played = newTableCard(before, g);
          store.setState({ game: cloneGame(g), humanAddPassed: false, flying: played ? { cardId: played, by: actorId, key: Date.now() } : undefined });
          if (msg) store.getState().addLog(msg);
        };
        const undefended = g.table.filter((x) => !x.defense);
        if (g.table.length > 0 && undefended.length > 0) {
          if (defender.id !== HUMAN_ID) { applyBot(defender.id, () => botDefendStep(g, defender)); continue; }
          break;
        }
        if (g.table.length === 0) {
          if (attacker.id !== HUMAN_ID && !attacker.finished) { applyBot(attacker.id, () => botAttackStep(g, attacker)); continue; }
          break;
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
