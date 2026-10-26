export const SUITS = ["S", "H", "D", "C"];
export const SUIT_SYMBOL = { S: "♠", H: "♥", D: "♦", C: "♣" };
export const SUIT_NAME = { S: "Bích", H: "Cơ", D: "Rô", C: "Chuồn" };
export const RANK_LABEL = { 11: "J", 12: "Q", 13: "K", 14: "A" };
export class GameError extends Error {
    code;
    constructor(code, message) { super(message); this.code = code; }
}
function err(code, message) { return new GameError(code, message); }
export function cardId(suit, rank) { return `${suit}-${rank}`; }
export function parseCard(id) {
    const [suit, r] = id.split("-");
    return { id, suit: suit, rank: Number(r) };
}
export function cardLabel(card) {
    const c = typeof card === "string" ? parseCard(card) : card;
    return `${RANK_LABEL[c.rank] || c.rank}${SUIT_SYMBOL[c.suit]}`;
}
export function createDeck() {
    const deck = [];
    for (const suit of SUITS)
        for (let rank = 2; rank <= 14; rank++)
            deck.push({ id: cardId(suit, rank), suit, rank });
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
export function canBeat(attack, defense, trumpSuit) {
    if (attack.suit === defense.suit)
        return defense.rank > attack.rank;
    return defense.suit === trumpSuit && attack.suit !== trumpSuit;
}
export function canTransferCard(attack, card) { return attack.rank === card.rank; }
function playerById(state, id) { return state.players.find((p) => p.id === id); }
function activePlayers(state) { return state.players.filter((p) => !p.finished); }
function nextActiveId(state, fromId) {
    // Người kế tiếp còn chơi theo đúng thứ tự ghế (kể cả khi fromId đã xong ván
    // thì vẫn tính ghế kế tiếp sau fromId, không nhảy về ghế đầu như bản cũ).
    const order = state.players;
    const start = order.findIndex((p) => p.id === fromId);
    for (let k = 1; k <= order.length; k++) {
        const cand = order[(start + k) % order.length];
        if (!cand.finished)
            return cand.id;
    }
    return fromId;
}
function drawUp(state, orderIds) {
    for (const id of orderIds) {
        const p = playerById(state, id);
        if (!p || p.finished)
            continue;
        while (p.hand.length < state.handSize && state.drawPile.length > 0)
            p.hand.push(state.drawPile.shift());
    }
}
function checkFinished(state) {
    if (state.phase === "FINISHED")
        return;
    for (const p of state.players) {
        if (!p.finished && p.hand.length === 0 && state.drawPile.length === 0) {
            p.finished = true;
            state.finishOrder.push(p.id);
        }
    }
    const remaining = activePlayers(state);
    if (remaining.length <= 1) {
        state.phase = "FINISHED";
        state.loserId = remaining.length === 1 ? remaining[0].id : null;
        state.result = { loserId: state.loserId, finishOrder: [...state.finishOrder] };
        return;
    }
    // Người tấn/người đỡ vừa bị đánh dấu xong ván (hết bài đúng lúc nọc cạn)
    // nhưng vẫn đang giữ lượt: chuyển lượt cho người còn chơi kế tiếp theo ghế,
    // không để ván kẹt ở người đã xong ván mà không còn bài để đánh.
    // Người đỡ luôn là người kế tiếp sau người tấn nên tính lại cả hai.
    const atk = playerById(state, state.attackerId);
    const def = playerById(state, state.defenderId);
    if (atk?.finished || def?.finished) {
        if (atk?.finished)
            state.attackerId = nextActiveId(state, state.attackerId);
        state.defenderId = nextActiveId(state, state.attackerId);
        state.defenderInitialHandCount = playerById(state, state.defenderId)?.hand.length || 0;
    }
}
// Bất biến bắt buộc: 1 lá chỉ ở 1 nơi, tổng luôn 52, id duy nhất.
export function assertInvariants(state) {
    const all = [];
    for (const p of state.players)
        all.push(...p.hand.map((c) => c.id));
    all.push(...state.drawPile.map((c) => c.id), ...state.discardPile.map((c) => c.id));
    for (const pair of state.table) {
        all.push(pair.attack.id);
        if (pair.defense)
            all.push(pair.defense.id);
    }
    if (all.length !== 52)
        throw err("INVARIANT_BROKEN", `Tổng số lá phải là 52, hiện là ${all.length}`);
    if (new Set(all).size !== 52)
        throw err("INVARIANT_BROKEN", "Có lá bài trùng lặp");
}
export function createGame(opts = {}) {
    const playerCount = opts.playerCount ?? 4;
    if (playerCount < 2 || playerCount > 4)
        throw err("VALIDATION_ERROR", "Số người chơi phải từ 2 đến 4");
    const handSize = opts.handSize ?? 8;
    const deck = shuffleDeck(createDeck(), opts.rng ?? Math.random);
    const players = [];
    for (let i = 0; i < playerCount; i++) {
        players.push({ id: `player_${i}`, name: (opts.playerNames ?? [])[i] || `Người chơi ${i + 1}`, hand: deck.splice(0, handSize), finished: false });
    }
    const drawPile = deck;
    const trumpCard = drawPile[drawPile.length - 1];
    let firstAttacker = players[0];
    let bestTrumpRank = Infinity;
    for (const p of players)
        for (const c of p.hand)
            if (c.suit === trumpCard.suit && c.rank < bestTrumpRank) {
                bestTrumpRank = c.rank;
                firstAttacker = p;
            }
    const state = {
        version: 1, phase: "ATTACKING", ruleSet: "VN_8_V1", players, drawPile, discardPile: [], table: [],
        trumpSuit: trumpCard.suit, trumpCardId: trumpCard.id, attackerId: firstAttacker.id, defenderId: "",
        defenderInitialHandCount: 0, maxAttackCards: opts.maxAttackCards ?? 6, handSize,
        allowTransfer: opts.allowTransfer ?? true, finishOrder: [], loserId: null, result: null,
        pendingDraw: [], takeLog: [],
    };
    state.defenderId = nextActiveId(state, firstAttacker.id);
    state.defenderInitialHandCount = playerById(state, state.defenderId).hand.length;
    return state;
}
export function tableRanks(state) {
    const s = new Set();
    for (const pair of state.table) {
        s.add(pair.attack.rank);
        if (pair.defense)
            s.add(pair.defense.rank);
    }
    return s;
}
export function canAttackCard(state, playerId, card) {
    const p = playerById(state, playerId);
    if (!p || p.finished || state.phase === "FINISHED")
        return false;
    if (state.phase !== "ATTACKING" && state.phase !== "DEFENDING")
        return false;
    if (playerId === state.defenderId)
        return false;
    if (state.table.length === 0)
        return playerId === state.attackerId;
    if (state.table.length >= state.maxAttackCards)
        return false;
    if (state.table.length >= state.defenderInitialHandCount)
        return false;
    return tableRanks(state).has(card.rank);
}
export function attack(state, playerId, cardIdStr) {
    if (state.phase === "FINISHED")
        throw err("GAME_FINISHED", "Ván đã kết thúc");
    const p = playerById(state, playerId);
    if (!p)
        throw err("VALIDATION_ERROR", "Không tìm thấy người chơi");
    const idx = p.hand.findIndex((c) => c.id === cardIdStr);
    if (idx < 0)
        throw err("CARD_NOT_IN_HAND", "Lá bài không thuộc người chơi");
    const card = p.hand[idx];
    if (!canAttackCard(state, playerId, card))
        throw err("INVALID_ATTACK", "Lá tấn không hợp lệ / sai lượt / vượt giới hạn");
    if (state.table.length === 0)
        state.defenderInitialHandCount = playerById(state, state.defenderId).hand.length;
    p.hand.splice(idx, 1);
    state.table.push({ attack: card, defense: null, attackedBy: playerId });
    state.phase = "DEFENDING";
    state.version++;
    return state;
}
export function defend(state, playerId, attackCardId, defenseCardId) {
    if (state.phase === "FINISHED")
        throw err("GAME_FINISHED", "Ván đã kết thúc");
    if (playerId !== state.defenderId)
        throw err("NOT_YOUR_TURN", "Không phải lượt đỡ của bạn");
    const pair = state.table.find((x) => x.attack.id === attackCardId && !x.defense);
    if (!pair)
        throw err("INVALID_DEFENSE", "Không có lá tấn đang chờ đỡ này");
    const p = playerById(state, playerId);
    const idx = p.hand.findIndex((c) => c.id === defenseCardId);
    if (idx < 0)
        throw err("CARD_NOT_IN_HAND", "Lá bài không thuộc người chơi");
    if (!canBeat(pair.attack, p.hand[idx], state.trumpSuit))
        throw err("INVALID_DEFENSE", "Lá đỡ không hợp lệ");
    pair.defense = p.hand.splice(idx, 1)[0];
    state.version++;
    return state;
}
export function transfer(state, playerId, cardIdStr) {
    if (!state.allowTransfer)
        throw err("INVALID_TRANSFER", "Phòng này tắt chuyển tấn");
    if (playerId !== state.defenderId)
        throw err("NOT_YOUR_TURN", "Không phải lượt đỡ của bạn");
    if (state.table.some((x) => x.defense))
        throw err("INVALID_TRANSFER", "Đã đỡ một lá thì không được chuyển tấn");
    const p = playerById(state, playerId);
    const idx = p.hand.findIndex((c) => c.id === cardIdStr);
    if (idx < 0)
        throw err("CARD_NOT_IN_HAND", "Lá bài không thuộc người chơi");
    if (!state.table.some((x) => canTransferCard(x.attack, p.hand[idx])))
        throw err("INVALID_TRANSFER", "Lá chuyển phải cùng hạng với lá tấn");
    const newDefenderId = nextActiveId(state, playerId);
    const newDefender = playerById(state, newDefenderId);
    if (newDefender.hand.length < state.table.length + 1)
        throw err("INVALID_TRANSFER", "Người tiếp theo không đủ bài để nhận lượt tấn");
    const card = p.hand.splice(idx, 1)[0];
    state.table.push({ attack: card, defense: null, attackedBy: playerId });
    state.defenderId = newDefenderId;
    state.defenderInitialHandCount = newDefender.hand.length;
    state.version++;
    return state;
}
/** Lên bài (nhận cả bàn) nhưng CHƯA bốc: chuyển sang phase DRAWING, chờ bốc từng lá. */
export function resolveTake(state, playerId) {
    if (playerId !== state.defenderId)
        throw err("NOT_YOUR_TURN", "Không phải lượt đỡ của bạn");
    if (state.table.length === 0)
        throw err("VALIDATION_ERROR", "Không có bài trên bàn để nhận");
    const defender = playerById(state, playerId);
    // Ghi log lượt ôm TRƯỚC khi dọn bàn: đếm tất cả lá tấn (kể cả lá đã đỡ cặp),
    // vì người ôm phải ôm cả chồng bài trên bàn.
    {
        const counts = {};
        for (const pair of state.table)
            counts[pair.attackedBy] = (counts[pair.attackedBy] || 0) + 1;
        state.takeLog.push({ defenderId: playerId, counts, cardCount: state.table.length });
    }
    for (const pair of state.table) {
        defender.hand.push(pair.attack);
        if (pair.defense)
            defender.hand.push(pair.defense);
    }
    state.table = [];
    const order = [];
    const seatOrder = state.players.map((p) => p.id);
    const start = seatOrder.indexOf(state.attackerId);
    for (let i = 0; i < seatOrder.length; i++) {
        const id = seatOrder[(start + i) % seatOrder.length];
        if (id !== playerId)
            order.push(id);
    }
    const newAttackerId = nextActiveId(state, playerId);
    state.attackerId = newAttackerId;
    state.defenderId = nextActiveId(state, newAttackerId);
    state.defenderInitialHandCount = playerById(state, state.defenderId)?.hand.length || 0;
    state.pendingDraw = order.filter((id) => { const p = playerById(state, id); return p && !p.finished && p.hand.length < state.handSize; });
    // Hết nọc: không chờ bốc nữa, vào thẳng đợt mới.
    if (!state.drawPile.length)
        state.pendingDraw = [];
    state.phase = state.pendingDraw.length ? "DRAWING" : "ATTACKING";
    state.version++;
    checkFinished(state);
    return state;
}
/** Kết thúc đợt đỡ thành công nhưng CHƯA bốc: chuyển sang phase DRAWING. */
export function resolveFinishAttack(state, playerId) {
    if (playerId !== state.attackerId)
        throw err("NOT_YOUR_TURN", "Chỉ người tấn chính mới kết thúc đợt");
    if (state.table.length === 0)
        throw err("VALIDATION_ERROR", "Chưa có bài trên bàn");
    if (state.table.some((x) => !x.defense))
        throw err("INVALID_ATTACK", "Còn lá chưa được đỡ, chưa kết thúc được");
    for (const pair of state.table)
        state.discardPile.push(pair.attack, pair.defense);
    state.table = [];
    const order = [];
    const seatOrder = state.players.map((p) => p.id);
    const start = seatOrder.indexOf(state.attackerId);
    for (let i = 0; i < seatOrder.length; i++) {
        const id = seatOrder[(start + i) % seatOrder.length];
        if (id !== state.defenderId)
            order.push(id);
    }
    order.push(state.defenderId);
    const oldDefenderId = state.defenderId;
    state.attackerId = oldDefenderId;
    if (playerById(state, state.attackerId)?.finished)
        state.attackerId = nextActiveId(state, state.attackerId);
    state.defenderId = nextActiveId(state, state.attackerId);
    state.defenderInitialHandCount = playerById(state, state.defenderId)?.hand.length || 0;
    state.pendingDraw = order.filter((id) => { const p = playerById(state, id); return p && !p.finished && p.hand.length < state.handSize; });
    // Hết nọc: không chờ bốc nữa, vào thẳng đợt mới.
    if (!state.drawPile.length)
        state.pendingDraw = [];
    state.phase = state.pendingDraw.length ? "DRAWING" : "ATTACKING";
    state.version++;
    checkFinished(state);
    return state;
}
/** Bốc 1 lá cho người đầu tiên trong pendingDraw. Trả về lá đã bốc (hoặc null nếu hết nọc / hết người cần bốc). Hết lượt bốc thì về ATTACKING. */
export function drawStep(state) {
    if (state.phase !== "DRAWING")
        return null;
    while (state.pendingDraw.length) {
        const id = state.pendingDraw[0];
        const p = playerById(state, id);
        if (!p || p.finished || p.hand.length >= state.handSize || state.drawPile.length === 0) {
            state.pendingDraw.shift();
            continue;
        }
        const card = state.drawPile.shift();
        p.hand.push(card);
        state.version++;
        if (p.hand.length >= state.handSize)
            state.pendingDraw.shift();
        if (!state.pendingDraw.length) {
            state.phase = "ATTACKING";
            checkFinished(state);
        }
        return card;
    }
    state.phase = "ATTACKING";
    checkFinished(state);
    return null;
}
/** Tương thích cũ (server dùng): lên bài + bốc hết ngay. */
export function take(state, playerId) {
    resolveTake(state, playerId);
    while (state.phase === "DRAWING")
        if (!drawStep(state))
            break;
    return state;
}
/** Tương thích cũ (server dùng): kết thúc đợt + bốc hết ngay. */
export function finishAttack(state, playerId) {
    resolveFinishAttack(state, playerId);
    while (state.phase === "DRAWING")
        if (!drawStep(state))
            break;
    return state;
}
export function publicView(state, viewerId) {
    return {
        version: state.version, phase: state.phase, ruleSet: state.ruleSet,
        attackerId: state.attackerId, defenderId: state.defenderId,
        trumpSuit: state.trumpSuit, trumpCardId: state.trumpCardId,
        drawPileCount: state.drawPile.length, discardPileCount: state.discardPile.length,
        pendingDraw: [...state.pendingDraw],
        table: state.table.map((x) => ({ attack: x.attack.id, defense: x.defense ? x.defense.id : null })),
        players: state.players.map((p) => ({ id: p.id, name: p.name, cardCount: p.hand.length, finished: p.finished })),
        myHand: ((playerById(state, viewerId)?.hand) || []).map((c) => c.id),
        finishOrder: [...state.finishOrder], loserId: state.loserId, result: state.result,
        takeLog: state.takeLog.map((t) => ({ defenderId: t.defenderId, counts: { ...t.counts }, cardCount: t.cardCount })),
    };
}
//# sourceMappingURL=engine.js.map