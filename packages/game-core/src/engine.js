// Tấn Online — game-core, luật VN-8
// Thuần JavaScript, không phụ thuộc React / DB / WebSocket.
// Server (sau này) là nơi duy nhất được tin cậy: mọi nước đi đều phải
// qua các hàm validate bên dưới. Client chỉ gửi yêu cầu, không tự đổi state.
export const SUITS = ["S", "H", "D", "C"];
export const SUIT_SYMBOL = { S: "♠", H: "♥", D: "♦", C: "♣" };
export const SUIT_NAME = { S: "Bích", H: "Cơ", D: "Rô", C: "Chuồn" };
export const RANKS = [2,3,4,5,6,7,8,9,10,11,12,13,14];
export const RANK_LABEL = { 11: "J", 12: "Q", 13: "K", 14: "A" };

export function cardId(suit, rank) { return `${suit}-${rank}`; }
export function parseCard(id) {
  const [suit, r] = id.split("-");
  return { id, suit, rank: Number(r) };
}
export function cardLabel(card) {
  const c = typeof card === "string" ? parseCard(card) : card;
  return `${RANK_LABEL[c.rank] || c.rank}${SUIT_SYMBOL[c.suit]}`;
}
export function createDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ id: cardId(suit, rank), suit, rank });
  return deck;
}
export function shuffleDeck(deck, rng = Math.random) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
// Lá đỡ hợp lệ: cùng chất lớn hơn, hoặc chủ đánh lá không phải chủ.
export function canBeat(attack, defense, trumpSuit) {
  const a = typeof attack === "string" ? parseCard(attack) : attack;
  const d = typeof defense === "string" ? parseCard(defense) : defense;
  if (a.suit === d.suit) return d.rank > a.rank;
  return d.suit === trumpSuit && a.suit !== trumpSuit;
}
export function canTransferCard(attack, card) {
  const a = typeof attack === "string" ? parseCard(attack) : attack;
  const c = typeof card === "string" ? parseCard(card) : card;
  return a.rank === c.rank;
}

function err(code, message) { const e = new Error(message); e.code = code; return e; }
function playerById(state, id) { return state.players.find((p) => p.id === id); }
function activePlayers(state) { return state.players.filter((p) => !p.finished); }
function nextActiveId(state, fromId) {
  const active = activePlayers(state);
  if (active.length <= 1) return fromId;
  const idx = active.findIndex((p) => p.id === fromId);
  return active[(idx + 1) % active.length].id;
}
function drawUp(state, orderIds) {
  for (const id of orderIds) {
    const p = playerById(state, id);
    if (!p || p.finished) continue;
    while (p.hand.length < state.handSize && state.drawPile.length > 0) {
      p.hand.push(state.drawPile.shift());
    }
  }
}
function checkFinished(state) {
  if (state.phase === "FINISHED") return;
  for (const p of state.players) {
    if (!p.finished && p.hand.length === 0 && state.drawPile.length === 0 && !p._justFinishedChecked) {
      // Chỉ tính là hoàn thành sau khi đợt tấn đã giải quyết xong (hàm gọi
      // checkFinished chỉ được gọi ở finishAttack/take), không tính giữa đợt.
      p.finished = true;
      state.finishOrder.push(p.id);
    }
  }
  const remaining = activePlayers(state);
  if (remaining.length <= 1) {
    state.phase = "FINISHED";
    state.loserId = remaining.length === 1 ? remaining[0].id : null;
    state.result = { loserId: state.loserId, finishOrder: [...state.finishOrder] };
  }
}

export function createGame({ playerCount = 4, playerNames = [], allowTransfer = true, maxAttackCards = 6, handSize = 8, rng = Math.random } = {}) {
  if (playerCount < 2 || playerCount > 4) throw err("VALIDATION_ERROR", "Số người chơi phải từ 2 đến 4");
  const deck = shuffleDeck(createDeck(), rng);
  const players = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({ id: `player_${i}`, name: playerNames[i] || `Người chơi ${i + 1}`, hand: deck.splice(0, handSize), finished: false });
  }
  const drawPile = deck; // còn lại 52 - 8*n lá, bao gồm cả lá chủ ở cuối
  const trumpCard = drawPile[drawPile.length - 1];
  // Người tấn đầu tiên: người giữ lá chủ nhỏ nhất, nếu không có thì người đầu tiên.
  let firstAttacker = players[0];
  let bestTrumpRank = Infinity;
  for (const p of players) {
    for (const c of p.hand) if (c.suit === trumpCard.suit && c.rank < bestTrumpRank) { bestTrumpRank = c.rank; firstAttacker = p; }
  }
  const state = {
    version: 1, phase: "ATTACKING", ruleSet: "VN_8_V1",
    players, drawPile, discardPile: [], table: [],
    trumpSuit: trumpCard.suit, trumpCardId: trumpCard.id,
    attackerId: firstAttacker.id, defenderId: null,
    defenderInitialHandCount: 0, maxAttackCards, handSize, allowTransfer,
    finishOrder: [], loserId: null, result: null,
  };
  state.defenderId = nextActiveId(state, firstAttacker.id);
  state.defenderInitialHandCount = playerById(state, state.defenderId).hand.length;
  return state;
}

export function tableRanks(state) {
  const s = new Set();
  for (const pair of state.table) { s.add(pair.attack.rank); if (pair.defense) s.add(pair.defense.rank); }
  return s;
}
export function canAttackCard(state, playerId, card) {
  const p = playerById(state, playerId);
  if (!p || p.finished || state.phase === "FINISHED") return false;
  if (playerId === state.defenderId) return false;
  if (state.table.length === 0) return playerId === state.attackerId;
  if (state.table.length >= state.maxAttackCards) return false;
  if (state.table.length >= state.defenderInitialHandCount) return false;
  return tableRanks(state).has(card.rank);
}

export function attack(state, playerId, cardIdStr) {
  if (state.phase === "FINISHED") throw err("GAME_FINISHED", "Ván đã kết thúc");
  const p = playerById(state, playerId);
  if (!p) throw err("VALIDATION_ERROR", "Không tìm thấy người chơi");
  const idx = p.hand.findIndex((c) => c.id === cardIdStr);
  if (idx < 0) throw err("CARD_NOT_IN_HAND", "Lá bài không thuộc người chơi");
  const card = p.hand[idx];
  if (!canAttackCard(state, playerId, card)) throw err("INVALID_ATTACK", "Lá tấn không hợp lệ / sai lượt / vượt giới hạn");
  if (state.table.length === 0) state.defenderInitialHandCount = playerById(state, state.defenderId).hand.length;
  p.hand.splice(idx, 1);
  state.table.push({ attack: card, defense: null });
  state.phase = "DEFENDING";
  state.version++;
  return state;
}

export function defend(state, playerId, attackCardId, defenseCardId) {
  if (state.phase === "FINISHED") throw err("GAME_FINISHED", "Ván đã kết thúc");
  if (playerId !== state.defenderId) throw err("NOT_YOUR_TURN", "Không phải lượt đỡ của bạn");
  const pair = state.table.find((x) => x.attack.id === attackCardId && !x.defense);
  if (!pair) throw err("INVALID_DEFENSE", "Không có lá tấn đang chờ đỡ này");
  const p = playerById(state, playerId);
  const idx = p.hand.findIndex((c) => c.id === defenseCardId);
  if (idx < 0) throw err("CARD_NOT_IN_HAND", "Lá bài không thuộc người chơi");
  if (!canBeat(pair.attack, p.hand[idx], state.trumpSuit)) throw err("INVALID_DEFENSE", "Lá đỡ không hợp lệ");
  pair.defense = p.hand.splice(idx, 1)[0];
  state.version++;
  return state;
}

export function transfer(state, playerId, cardIdStr) {
  if (!state.allowTransfer) throw err("INVALID_TRANSFER", "Phòng này tắt chuyển tấn");
  if (playerId !== state.defenderId) throw err("NOT_YOUR_TURN", "Không phải lượt đỡ của bạn");
  if (state.table.some((x) => x.defense)) throw err("INVALID_TRANSFER", "Đã đỡ một lá thì không được chuyển tấn");
  const p = playerById(state, playerId);
  const idx = p.hand.findIndex((c) => c.id === cardIdStr);
  if (idx < 0) throw err("CARD_NOT_IN_HAND", "Lá bài không thuộc người chơi");
  if (!state.table.some((x) => canTransferCard(x.attack, p.hand[idx]))) throw err("INVALID_TRANSFER", "Lá chuyển phải cùng hạng với lá tấn");
  const newDefenderId = nextActiveId(state, playerId);
  const newDefender = playerById(state, newDefenderId);
  if (newDefender.hand.length < state.table.length + 1) throw err("INVALID_TRANSFER", "Người tiếp theo không đủ bài để nhận lượt tấn");
  const card = p.hand.splice(idx, 1)[0];
  state.table.push({ attack: card, defense: null });
  state.defenderId = newDefenderId;
  state.defenderInitialHandCount = newDefender.hand.length;
  state.version++;
  return state;
}

export function take(state, playerId) {
  if (playerId !== state.defenderId) throw err("NOT_YOUR_TURN", "Không phải lượt đỡ của bạn");
  if (state.table.length === 0) throw err("VALIDATION_ERROR", "Không có bài trên bàn để nhận");
  const defender = playerById(state, playerId);
  for (const pair of state.table) { defender.hand.push(pair.attack); if (pair.defense) defender.hand.push(pair.defense); }
  state.table = [];
  // Bốc bài: người tấn trước, người thêm bài theo ghế, người đỡ KHÔNG bốc
  // (vì vừa nhận cả bàn). Lượt tấn tiếp theo thuộc về người sau người đỡ.
  const order = [];
  const seatOrder = state.players.map((p) => p.id);
  const start = seatOrder.indexOf(state.attackerId);
  for (let i = 0; i < seatOrder.length; i++) {
    const id = seatOrder[(start + i) % seatOrder.length];
    if (id !== playerId) order.push(id);
  }
  drawUp(state, order);
  const newAttackerId = nextActiveId(state, playerId);
  state.attackerId = newAttackerId;
  state.defenderId = nextActiveId(state, newAttackerId);
  state.defenderInitialHandCount = playerById(state, state.defenderId)?.hand.length || 0;
  state.phase = "ATTACKING";
  state.version++;
  checkFinished(state);
  return state;
}

export function finishAttack(state, playerId) {
  if (playerId !== state.attackerId) throw err("NOT_YOUR_TURN", "Chỉ người tấn chính mới kết thúc đợt");
  if (state.table.length === 0) throw err("VALIDATION_ERROR", "Chưa có bài trên bàn");
  if (state.table.some((x) => !x.defense)) throw err("INVALID_ATTACK", "Còn lá chưa được đỡ, chưa kết thúc được");
  for (const pair of state.table) { state.discardPile.push(pair.attack, pair.defense); }
  state.table = [];
  // Bốc bài: tấn chính trước, người thêm bài theo ghế, người đỡ cuối cùng.
  const order = [];
  const seatOrder = state.players.map((p) => p.id);
  const start = seatOrder.indexOf(state.attackerId);
  for (let i = 0; i < seatOrder.length; i++) {
    const id = seatOrder[(start + i) % seatOrder.length];
    if (id !== state.defenderId) order.push(id);
  }
  order.push(state.defenderId);
  drawUp(state, order);
  const oldDefenderId = state.defenderId;
  state.attackerId = oldDefenderId;
  // Nếu người đỡ cũ đã hết bài thì người tấn mới là người kế tiếp còn chơi
  if (playerById(state, state.attackerId)?.finished) state.attackerId = nextActiveId(state, state.attackerId);
  state.defenderId = nextActiveId(state, state.attackerId);
  state.defenderInitialHandCount = playerById(state, state.defenderId)?.hand.length || 0;
  state.phase = "ATTACKING";
  state.version++;
  checkFinished(state);
  return state;
}

// View gửi cho từng người: KHÔNG bao giờ lộ hand của người khác hay drawPile.
export function publicView(state, viewerId) {
  return {
    version: state.version, phase: state.phase, ruleSet: state.ruleSet,
    attackerId: state.attackerId, defenderId: state.defenderId,
    trumpSuit: state.trumpSuit, trumpCardId: state.trumpCardId,
    drawPileCount: state.drawPile.length, discardPileCount: state.discardPile.length,
    table: state.table.map((x) => ({ attack: x.attack.id, defense: x.defense ? x.defense.id : null })),
    players: state.players.map((p) => ({ id: p.id, name: p.name, cardCount: p.hand.length, finished: p.finished })),
    myHand: (playerById(state, viewerId)?.hand || []).map((c) => c.id),
    finishOrder: [...state.finishOrder], loserId: state.loserId, result: state.result,
  };
}
