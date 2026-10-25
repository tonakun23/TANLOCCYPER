// Tấn Online — game-core, luật VN-8, TypeScript strict, thuần, không phụ
// thuộc React / DB / WebSocket. Server là nơi duy nhất được tin cậy.
export type Suit = "S" | "H" | "D" | "C";
export type Phase = "WAITING" | "DEALING" | "ATTACKING" | "DEFENDING" | "RESOLVING" | "DRAWING" | "FINISHED";
export interface Card { id: string; suit: Suit; rank: number; }
export interface AttackPair { attack: Card; defense: Card | null; }
export interface PlayerState { id: string; name: string; hand: Card[]; finished: boolean; }
export interface GameResult { loserId: string | null; finishOrder: string[]; }
export interface GameState {
  version: number; phase: Phase; ruleSet: string;
  players: PlayerState[]; drawPile: Card[]; discardPile: Card[]; table: AttackPair[];
  trumpSuit: Suit; trumpCardId: string;
  attackerId: string; defenderId: string; defenderInitialHandCount: number;
  maxAttackCards: number; handSize: number; allowTransfer: boolean;
  finishOrder: string[]; loserId: string | null; result: GameResult | null;
}
export interface GameOptions {
  playerCount?: number; playerNames?: string[]; allowTransfer?: boolean;
  maxAttackCards?: number; handSize?: number; rng?: () => number;
}
export const SUITS: Suit[] = ["S", "H", "D", "C"];
export const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
export const SUIT_NAME: Record<Suit, string> = { S: "Bích", H: "Cơ", D: "Rô", C: "Chuồn" };
export const RANK_LABEL: Record<number, string> = { 11: "J", 12: "Q", 13: "K", 14: "A" };

export class GameError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}
function err(code: string, message: string): GameError { return new GameError(code, message); }
export function cardId(suit: Suit, rank: number): string { return `${suit}-${rank}`; }
export function parseCard(id: string): Card {
  const [suit, r] = id.split("-");
  return { id, suit: suit as Suit, rank: Number(r) };
}
export function cardLabel(card: Card | string): string {
  const c = typeof card === "string" ? parseCard(card) : card;
  return `${RANK_LABEL[c.rank] || c.rank}${SUIT_SYMBOL[c.suit]}`;
}
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (let rank = 2; rank <= 14; rank++) deck.push({ id: cardId(suit, rank), suit, rank });
  return deck;
}
export function shuffleDeck(deck: Card[], rng: () => number = Math.random): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
export function canBeat(attack: Card, defense: Card, trumpSuit: Suit): boolean {
  if (attack.suit === defense.suit) return defense.rank > attack.rank;
  return defense.suit === trumpSuit && attack.suit !== trumpSuit;
}
export function canTransferCard(attack: Card, card: Card): boolean { return attack.rank === card.rank; }

function playerById(state: GameState, id: string): PlayerState | undefined { return state.players.find((p) => p.id === id); }
function activePlayers(state: GameState): PlayerState[] { return state.players.filter((p) => !p.finished); }
function nextActiveId(state: GameState, fromId: string): string {
  const active = activePlayers(state);
  if (active.length <= 1) return fromId;
  const idx = active.findIndex((p) => p.id === fromId);
  return active[(idx + 1) % active.length].id;
}
function drawUp(state: GameState, orderIds: string[]): void {
  for (const id of orderIds) {
    const p = playerById(state, id);
    if (!p || p.finished) continue;
    while (p.hand.length < state.handSize && state.drawPile.length > 0) p.hand.push(state.drawPile.shift() as Card);
  }
}
function checkFinished(state: GameState): void {
  if (state.phase === "FINISHED") return;
  for (const p of state.players) {
    if (!p.finished && p.hand.length === 0 && state.drawPile.length === 0) { p.finished = true; state.finishOrder.push(p.id); }
  }
  const remaining = activePlayers(state);
  if (remaining.length <= 1) {
    state.phase = "FINISHED";
    state.loserId = remaining.length === 1 ? remaining[0].id : null;
    state.result = { loserId: state.loserId, finishOrder: [...state.finishOrder] };
  }
}
// Bất biến bắt buộc: 1 lá chỉ ở 1 nơi, tổng luôn 52, id duy nhất.
export function assertInvariants(state: GameState): void {
  const all: string[] = [];
  for (const p of state.players) all.push(...p.hand.map((c) => c.id));
  all.push(...state.drawPile.map((c) => c.id), ...state.discardPile.map((c) => c.id));
  for (const pair of state.table) { all.push(pair.attack.id); if (pair.defense) all.push(pair.defense.id); }
  if (all.length !== 52) throw err("INVARIANT_BROKEN", `Tổng số lá phải là 52, hiện là ${all.length}`);
  if (new Set(all).size !== 52) throw err("INVARIANT_BROKEN", "Có lá bài trùng lặp");
}

export function createGame(opts: GameOptions = {}): GameState {
  const playerCount = opts.playerCount ?? 4;
  if (playerCount < 2 || playerCount > 4) throw err("VALIDATION_ERROR", "Số người chơi phải từ 2 đến 4");
  const handSize = opts.handSize ?? 8;
  const deck = shuffleDeck(createDeck(), opts.rng ?? Math.random);
  const players: PlayerState[] = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({ id: `player_${i}`, name: (opts.playerNames ?? [])[i] || `Người chơi ${i + 1}`, hand: deck.splice(0, handSize), finished: false });
  }
  const drawPile = deck;
  const trumpCard = drawPile[drawPile.length - 1];
  let firstAttacker = players[0]; let bestTrumpRank = Infinity;
  for (const p of players) for (const c of p.hand) if (c.suit === trumpCard.suit && c.rank < bestTrumpRank) { bestTrumpRank = c.rank; firstAttacker = p; }
  const state: GameState = {
    version: 1, phase: "ATTACKING", ruleSet: "VN_8_V1", players, drawPile, discardPile: [], table: [],
    trumpSuit: trumpCard.suit, trumpCardId: trumpCard.id, attackerId: firstAttacker.id, defenderId: "",
    defenderInitialHandCount: 0, maxAttackCards: opts.maxAttackCards ?? 6, handSize,
    allowTransfer: opts.allowTransfer ?? true, finishOrder: [], loserId: null, result: null,
  };
  state.defenderId = nextActiveId(state, firstAttacker.id);
  state.defenderInitialHandCount = (playerById(state, state.defenderId) as PlayerState).hand.length;
  return state;
}
export function tableRanks(state: GameState): Set<number> {
  const s = new Set<number>();
  for (const pair of state.table) { s.add(pair.attack.rank); if (pair.defense) s.add(pair.defense.rank); }
  return s;
}
export function canAttackCard(state: GameState, playerId: string, card: Card): boolean {
  const p = playerById(state, playerId);
  if (!p || p.finished || state.phase === "FINISHED") return false;
  if (playerId === state.defenderId) return false;
  if (state.table.length === 0) return playerId === state.attackerId;
  if (state.table.length >= state.maxAttackCards) return false;
  if (state.table.length >= state.defenderInitialHandCount) return false;
  return tableRanks(state).has(card.rank);
}
export function attack(state: GameState, playerId: string, cardIdStr: string): GameState {
  if (state.phase === "FINISHED") throw err("GAME_FINISHED", "Ván đã kết thúc");
  const p = playerById(state, playerId); if (!p) throw err("VALIDATION_ERROR", "Không tìm thấy người chơi");
  const idx = p.hand.findIndex((c) => c.id === cardIdStr); if (idx < 0) throw err("CARD_NOT_IN_HAND", "Lá bài không thuộc người chơi");
  const card = p.hand[idx];
  if (!canAttackCard(state, playerId, card)) throw err("INVALID_ATTACK", "Lá tấn không hợp lệ / sai lượt / vượt giới hạn");
  if (state.table.length === 0) state.defenderInitialHandCount = (playerById(state, state.defenderId) as PlayerState).hand.length;
  p.hand.splice(idx, 1); state.table.push({ attack: card, defense: null }); state.phase = "DEFENDING"; state.version++; return state;
}
export function defend(state: GameState, playerId: string, attackCardId: string, defenseCardId: string): GameState {
  if (state.phase === "FINISHED") throw err("GAME_FINISHED", "Ván đã kết thúc");
  if (playerId !== state.defenderId) throw err("NOT_YOUR_TURN", "Không phải lượt đỡ của bạn");
  const pair = state.table.find((x) => x.attack.id === attackCardId && !x.defense); if (!pair) throw err("INVALID_DEFENSE", "Không có lá tấn đang chờ đỡ này");
  const p = playerById(state, playerId) as PlayerState;
  const idx = p.hand.findIndex((c) => c.id === defenseCardId); if (idx < 0) throw err("CARD_NOT_IN_HAND", "Lá bài không thuộc người chơi");
  if (!canBeat(pair.attack, p.hand[idx], state.trumpSuit)) throw err("INVALID_DEFENSE", "Lá đỡ không hợp lệ");
  pair.defense = p.hand.splice(idx, 1)[0]; state.version++; return state;
}
export function transfer(state: GameState, playerId: string, cardIdStr: string): GameState {
  if (!state.allowTransfer) throw err("INVALID_TRANSFER", "Phòng này tắt chuyển tấn");
  if (playerId !== state.defenderId) throw err("NOT_YOUR_TURN", "Không phải lượt đỡ của bạn");
  if (state.table.some((x) => x.defense)) throw err("INVALID_TRANSFER", "Đã đỡ một lá thì không được chuyển tấn");
  const p = playerById(state, playerId) as PlayerState;
  const idx = p.hand.findIndex((c) => c.id === cardIdStr); if (idx < 0) throw err("CARD_NOT_IN_HAND", "Lá bài không thuộc người chơi");
  if (!state.table.some((x) => canTransferCard(x.attack, p.hand[idx]))) throw err("INVALID_TRANSFER", "Lá chuyển phải cùng hạng với lá tấn");
  const newDefenderId = nextActiveId(state, playerId);
  const newDefender = playerById(state, newDefenderId) as PlayerState;
  if (newDefender.hand.length < state.table.length + 1) throw err("INVALID_TRANSFER", "Người tiếp theo không đủ bài để nhận lượt tấn");
  const card = p.hand.splice(idx, 1)[0]; state.table.push({ attack: card, defense: null });
  state.defenderId = newDefenderId; state.defenderInitialHandCount = newDefender.hand.length; state.version++; return state;
}
export function take(state: GameState, playerId: string): GameState {
  if (playerId !== state.defenderId) throw err("NOT_YOUR_TURN", "Không phải lượt đỡ của bạn");
  if (state.table.length === 0) throw err("VALIDATION_ERROR", "Không có bài trên bàn để nhận");
  const defender = playerById(state, playerId) as PlayerState;
  for (const pair of state.table) { defender.hand.push(pair.attack); if (pair.defense) defender.hand.push(pair.defense); }
  state.table = [];
  const order: string[] = []; const seatOrder = state.players.map((p) => p.id); const start = seatOrder.indexOf(state.attackerId);
  for (let i = 0; i < seatOrder.length; i++) { const id = seatOrder[(start + i) % seatOrder.length]; if (id !== playerId) order.push(id); }
  drawUp(state, order);
  const newAttackerId = nextActiveId(state, playerId); state.attackerId = newAttackerId;
  state.defenderId = nextActiveId(state, newAttackerId);
  state.defenderInitialHandCount = (playerById(state, state.defenderId) as PlayerState)?.hand.length || 0;
  state.phase = "ATTACKING"; state.version++; checkFinished(state); return state;
}
export function finishAttack(state: GameState, playerId: string): GameState {
  if (playerId !== state.attackerId) throw err("NOT_YOUR_TURN", "Chỉ người tấn chính mới kết thúc đợt");
  if (state.table.length === 0) throw err("VALIDATION_ERROR", "Chưa có bài trên bàn");
  if (state.table.some((x) => !x.defense)) throw err("INVALID_ATTACK", "Còn lá chưa được đỡ, chưa kết thúc được");
  for (const pair of state.table) state.discardPile.push(pair.attack, pair.defense as Card);
  state.table = [];
  const order: string[] = []; const seatOrder = state.players.map((p) => p.id); const start = seatOrder.indexOf(state.attackerId);
  for (let i = 0; i < seatOrder.length; i++) { const id = seatOrder[(start + i) % seatOrder.length]; if (id !== state.defenderId) order.push(id); }
  order.push(state.defenderId); drawUp(state, order);
  const oldDefenderId = state.defenderId; state.attackerId = oldDefenderId;
  if ((playerById(state, state.attackerId) as PlayerState)?.finished) state.attackerId = nextActiveId(state, state.attackerId);
  state.defenderId = nextActiveId(state, state.attackerId);
  state.defenderInitialHandCount = (playerById(state, state.defenderId) as PlayerState)?.hand.length || 0;
  state.phase = "ATTACKING"; state.version++; checkFinished(state); return state;
}
export function publicView(state: GameState, viewerId: string): Record<string, unknown> {
  return {
    version: state.version, phase: state.phase, ruleSet: state.ruleSet,
    attackerId: state.attackerId, defenderId: state.defenderId,
    trumpSuit: state.trumpSuit, trumpCardId: state.trumpCardId,
    drawPileCount: state.drawPile.length, discardPileCount: state.discardPile.length,
    table: state.table.map((x) => ({ attack: x.attack.id, defense: x.defense ? x.defense.id : null })),
    players: state.players.map((p) => ({ id: p.id, name: p.name, cardCount: p.hand.length, finished: p.finished })),
    myHand: ((playerById(state, viewerId)?.hand) || []).map((c) => c.id),
    finishOrder: [...state.finishOrder], loserId: state.loserId, result: state.result,
  };
}
