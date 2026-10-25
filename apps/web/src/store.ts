import { create } from "zustand";
import { createGame, attack, defend, transfer, take, finishAttack, canAttackCard, canBeat, parseCard, cardLabel } from "../../../packages/game-core/src/engine";
import type { GameState } from "../../../packages/game-core/src/engine";
import { botDefendStep, botAttackStep, botAdderStep, lowestCard } from "./game/bot";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
function cloneGame(g: GameState): GameState {
  return { ...g, players: g.players.map((p) => ({ ...p, hand: [...p.hand] })), drawPile: [...g.drawPile], discardPile: [...g.discardPile], table: g.table.map((x) => ({ ...x })) };
}
export const HUMAN_ID = "player_0";

interface GameStore {
  screen: "lobby" | "game";
  playerName: string; playerCount: number; allowTransfer: boolean;
  game: GameState | null; selected: string | null; humanAddPassed: boolean;
  log: string[]; botBusy: boolean;
  setPlayerName: (v: string) => void; setPlayerCount: (v: number) => void; setAllowTransfer: (v: boolean) => void;
  startGame: () => void; backToLobby: () => void; setSelected: (v: string | null) => void;
  playCard: (cardId: string) => void; defendPair: (attackId: string) => void;
  takeCards: () => void; finishAttackAction: () => void; transferCard: () => void; passAdd: () => void;
  runBots: () => Promise<void>; addLog: (msg: string) => void;
  autoLowestAttack: () => void;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  screen: "lobby", playerName: "Bạn", playerCount: 4, allowTransfer: true,
  game: null, selected: null, humanAddPassed: false, log: [], botBusy: false,
  setPlayerName: (v) => set({ playerName: v }),
  setPlayerCount: (v) => set({ playerCount: v }),
  setAllowTransfer: (v) => set({ allowTransfer: v }),
  setSelected: (v) => set({ selected: v }),
  addLog: (msg) => set((s) => ({ log: [msg, ...s.log].slice(0, 50) })),
  backToLobby: () => set({ screen: "lobby", game: null, selected: null, log: [] }),
  startGame: () => {
    const { playerName, playerCount, allowTransfer } = get();
    const names = [playerName.trim() || "Bạn"];
    for (let i = 1; i < playerCount; i++) names.push(`Bot ${i}`);
    const game = createGame({ playerCount, playerNames: names, allowTransfer });
    set({ screen: "game", game: cloneGame(game), selected: null, humanAddPassed: false, log: [`Ván mới: ${playerCount} người, chất chủ là ${game.trumpSuit}. Người tấn đầu: ${game.players.find((p) => p.id === game.attackerId)?.name}.`] });
    void get().runBots();
  },
  playCard: () => {},
  defendPair: () => {},
  takeCards: () => {},
  finishAttackAction: () => {},
  transferCard: () => {},
  passAdd: () => {},
  runBots: async () => {},
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
      if (beatable.length === 1) { store.getState().defendPair(beatable[0].attack.id); return; }
      store.setState({ selected: cardId }); return;
    }
    const card = me.hand.find((c) => c.id === cardId);
    if (card && canAttackCard(game, HUMAN_ID, card)) {
      try { attack(game, HUMAN_ID, cardId); store.setState({ game: cloneGame(game), selected: null, humanAddPassed: false }); store.getState().addLog(`Bạn đánh ${cardLabel(card)}.`); void store.getState().runBots(); } catch (e) { alert((e as Error).message); }
    } else { store.setState({ selected: cardId }); }
    void selected;
  },
  defendPair: (attackId: string) => {
    const { game, selected } = store.getState();
    if (!game || !selected) return;
    try { defend(game, HUMAN_ID, attackId, selected); store.setState({ game: cloneGame(game), selected: null, humanAddPassed: false }); store.getState().addLog(`Bạn đỡ ${attackId} bằng ${selected}.`); void store.getState().runBots(); } catch (e) { alert((e as Error).message); }
  },
  takeCards: () => {
    const { game } = store.getState(); if (!game) return;
    try { take(game, HUMAN_ID); store.setState({ game: cloneGame(game), selected: null }); store.getState().addLog("Bạn nhận cả bàn."); void store.getState().runBots(); } catch (e) { alert((e as Error).message); }
  },
  finishAttackAction: () => {
    const { game } = store.getState(); if (!game) return;
    try { finishAttack(game, HUMAN_ID); store.setState({ game: cloneGame(game) }); store.getState().addLog("Bạn kết thúc đợt."); void store.getState().runBots(); } catch (e) { alert((e as Error).message); }
  },
  transferCard: () => {
    const { game, selected } = store.getState(); if (!game || !selected) return;
    try { transfer(game, HUMAN_ID, selected); store.setState({ game: cloneGame(game), selected: null }); store.getState().addLog(`Bạn chuyển tấn bằng ${selected}.`); void store.getState().runBots(); } catch (e) { alert((e as Error).message); }
  },
  passAdd: () => { store.setState({ humanAddPassed: true }); void store.getState().runBots(); },
  autoLowestAttack: () => {
    const { game } = store.getState(); if (!game) return;
    const me = game.players.find((p) => p.id === HUMAN_ID); if (!me || !me.hand.length) return;
    const card = lowestCard(me.hand, game.trumpSuit);
    try { attack(game, HUMAN_ID, card.id); store.setState({ game: cloneGame(game) }); store.getState().addLog(`Hết giờ: tự đánh ${cardLabel(card)}.`); void store.getState().runBots(); } catch { /* bỏ qua */ }
  },
  runBots: async () => {
    const s = store.getState(); if (s.botBusy || !s.game || s.game.phase === "FINISHED") return;
    store.setState({ botBusy: true });
    try {
      let guard = 0;
      while (guard++ < 100) {
        const game = store.getState().game; if (!game || game.phase === "FINISHED") break;
        await delay(450);
        const g = store.getState().game; if (!g || g.phase === "FINISHED") break;
        const defender = g.players.find((p) => p.id === g.defenderId); const attacker = g.players.find((p) => p.id === g.attackerId);
        if (!defender || !attacker) break;
        const undefended = g.table.filter((x) => !x.defense);
        if (g.table.length > 0 && undefended.length > 0) {
          if (defender.id !== HUMAN_ID) { const msg = botDefendStep(g, defender); store.setState({ game: cloneGame(g), humanAddPassed: false }); if (msg) store.getState().addLog(msg); continue; }
          break;
        }
        if (g.table.length === 0) {
          if (attacker.id !== HUMAN_ID && !attacker.finished) { const msg = botAttackStep(g, attacker); store.setState({ game: cloneGame(g) }); if (msg) store.getState().addLog(msg); continue; }
          break;
        }
        if (attacker.id !== HUMAN_ID) { const msg = botAttackStep(g, attacker); store.setState({ game: cloneGame(g) }); if (msg) store.getState().addLog(msg); continue; }
        if (attacker.id === HUMAN_ID) break;
        const human = g.players.find((p) => p.id === HUMAN_ID);
        const humanCanAdd = human && !human.finished && human.hand.some((c) => canAttackCard(g, HUMAN_ID, c));
        if (humanCanAdd && !store.getState().humanAddPassed) break;
        const adderBot = g.players.find((p) => p.id !== HUMAN_ID && p.id !== g.defenderId && !p.finished && p.hand.some((c) => canAttackCard(g, p.id, c)));
        if (adderBot) { const msg = botAdderStep(g, adderBot); store.setState({ game: cloneGame(g) }); if (msg) store.getState().addLog(msg); continue; }
        break;
      }
    } finally { store.setState({ botBusy: false }); }
  },
});
