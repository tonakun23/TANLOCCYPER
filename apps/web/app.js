import { createGame, attack, defend, take, finishAttack, transfer, canAttackCard, canBeat, parseCard, cardLabel, SUIT_SYMBOL, SUIT_NAME } from "../../packages/game-core/src/engine.js";

const $ = (id) => document.getElementById(id);
let game = null, humanId = "player_0", selected = null, humanAddPassed = false, timerLeft = 30, timerHandle = null, busy = false;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function log(msg) { const el = $("log"); el.innerHTML = `<div>${msg}</div>` + el.innerHTML; }
function human() { return game.players.find((p) => p.id === humanId); }
function nameOf(id) { return game.players.find((p) => p.id === id)?.name || id; }
function isBot(id) { return id !== humanId; }
function allDefended() { return game.table.length > 0 && game.table.every((x) => x.defense); }
function undefended() { return game.table.filter((x) => !x.defense); }
function cardEl(card, extra = "") {
  const c = typeof card === "string" ? parseCard(card) : card;
  const red = c.suit === "H" || c.suit === "D" ? " red" : "";
  return `<div class="card${red} ${extra}" data-card="${c.id}"><div>${c.rank === 14 ? "A" : c.rank === 13 ? "K" : c.rank === 12 ? "Q" : c.rank === 11 ? "J" : c.rank}</div><div style="font-size:28px">${SUIT_SYMBOL[c.suit]}</div></div>`;
}
function lowestCard(cards, trump) {
  return [...cards].sort((a, b) => {
    const at = a.suit === trump ? 1 : 0, bt = b.suit === trump ? 1 : 0;
    return at - bt || a.rank - b.rank;
  })[0];
}

function startGame() {
  const count = Number($("playerCount").value);
  const names = [$("playerName").value.trim() || "Bạn"];
  for (let i = 1; i < count; i++) names.push(`Bot ${i}`);
  game = createGame({ playerCount: count, playerNames: names, allowTransfer: $("allowTransfer").checked });
  selected = null; humanAddPassed = false;
  $("setup").classList.add("hidden"); $("game").classList.remove("hidden"); $("result").classList.add("hidden");
  log(`Ván mới: ${count} người, chất chủ là ${SUIT_NAME[game.trumpSuit]} (${SUIT_SYMBOL[game.trumpSuit]}). Người tấn đầu: ${nameOf(game.attackerId)}.`);
  render(); runBots();
}

function render() {
  if (!game) return;
  const me = human();
  $("status").textContent = game.phase === "FINISHED" ? "Ván đã kết thúc" : `${nameOf(game.attackerId)} tấn · ${nameOf(game.defenderId)} đỡ`;
  $("trumpInfo").textContent = `Chủ: ${SUIT_NAME[game.trumpSuit]} ${SUIT_SYMBOL[game.trumpSuit]}`;
  $("pileInfo").textContent = `Nọc: ${game.drawPile.length} lá · Bỏ: ${game.discardPile.length} lá`;
  $("opponents").innerHTML = game.players.filter((p) => p.id !== humanId).map((p) => `
    <div class="opp ${p.id === game.attackerId ? "active" : ""} ${p.id === game.defenderId ? "active" : ""}">
      <div>${p.name} ${p.id === game.attackerId ? "⚔️ tấn" : ""} ${p.id === game.defenderId ? "🛡️ đỡ" : ""} ${p.finished ? "✅ xong" : ""}</div>
      <div>${p.hand.length} lá</div>
      <div class="mini-cards">${p.hand.map(() => `<span class="mini"></span>`).join("")}</div>
    </div>`).join("");
  $("table").innerHTML = game.table.length ? game.table.map((pair) => `
    <div class="pair" data-attack="${pair.attack.id}">
      ${cardEl(pair.attack)}
      ${pair.defense ? cardEl(pair.defense, "def") : `<div style="position:absolute;left:22px;top:18px;color:#fde68a">chờ đỡ…</div>`}
    </div>`).join("") : `<div style="color:#fecaca">Chưa có bài trên bàn</div>`;
  $("centerInfo").textContent = game.table.length ? "Bấm vào lá bài của bạn, rồi bấm vào cặp bài cần đỡ (nếu có nhiều cặp)." : "";
  $("myHand").innerHTML = me.hand.map((c) => cardEl(c, c.id === selected ? "selected" : "")).join("");
  // Nút
  const iAmDefender = game.defenderId === humanId;
  const iAmAttacker = game.attackerId === humanId;
  $("finishBtn").disabled = !(iAmAttacker && allDefended());
  $("takeBtn").disabled = !(iAmDefender && game.table.length > 0);
  $("transferBtn").disabled = !(iAmDefender && selected && game.table.length > 0 && !game.table.some((x) => x.defense) && game.table.some((x) => x.attack.rank === parseCard(selected).rank));
  $("passBtn").disabled = !(game.table.length > 0 && !iAmDefender && game.players.some((p) => p.id === humanId && !p.finished));
  let hint = "";
  if (game.phase === "FINISHED") hint = game.loserId === humanId ? "Bạn là người thua ván này. Chơi lại nhé!" : `${nameOf(game.loserId)} thua ván này.`;
  else if (iAmDefender && undefended().length) hint = "Tới lượt bạn đỡ: bấm lá bài của bạn để đỡ, hoặc bấm Nhận bài / Chuyển tấn.";
  else if (iAmAttacker && game.table.length === 0) hint = "Tới lượt bạn tấn: bấm 1 lá bài để đánh ra.";
  else if (iAmAttacker && allDefended()) hint = "Bạn có thể thêm bài cùng hạng, hoặc bấm Kết thúc đợt.";
  else if (!iAmDefender && game.table.length > 0) hint = "Bạn có thể thêm bài cùng hạng với bài trên bàn, hoặc bấm Không thêm nữa.";
  else hint = "Đang chờ bot đánh…";
  $("hint").textContent = hint;
  if (game.phase === "FINISHED") {
    $("result").classList.remove("hidden");
    $("result").innerHTML = `<h2>Kết quả</h2><p>Người thua: <b>${nameOf(game.loserId)}</b></p><p>Thứ tự hoàn thành: ${game.finishOrder.map(nameOf).join(" → ") || "—"}</p><button onclick="location.reload()">Chơi ván mới</button>`;
  }
  bind();
}

function bind() {
  document.querySelectorAll("#myHand .card").forEach((el) => {
    el.onclick = () => onMyCard(el.dataset.card);
  });
  document.querySelectorAll("#table .pair").forEach((el) => {
    el.onclick = () => onPair(el.dataset.attack);
  });
}

function onMyCard(cardIdStr) {
  if (!game || game.phase === "FINISHED" || busy) return;
  const me = human();
  if (game.defenderId === humanId) {
    const card = parseCard(cardIdStr);
    const beatable = undefended().filter((x) => canBeat(x.attack, card, game.trumpSuit));
    if (beatable.length === 1) { doDefend(beatable[0].attack.id, cardIdStr); return; }
    if (beatable.length > 1) { selected = cardIdStr; render(); return; }
    selected = cardIdStr; render(); return; // có thể để chuyển tấn
  }
  // Tấn / thêm bài
  const card = me.hand.find((c) => c.id === cardIdStr);
  if (card && canAttackCard(game, humanId, card)) {
    try { attack(game, humanId, cardIdStr); log(`Bạn đánh ${cardLabel(card)}.`); selected = null; humanAddPassed = false; render(); runBots(); }
    catch (e) { alert(e.message); }
  } else { selected = cardIdStr; render(); }
}

function onPair(attackId) {
  if (!selected || game.defenderId !== humanId) return;
  doDefend(attackId, selected);
}
function doDefend(attackId, defenseId) {
  try { defend(game, humanId, attackId, defenseId); log(`Bạn đỡ ${attackId} bằng ${defenseId}.`); selected = null; humanAddPassed = false; render(); runBots(); }
  catch (e) { alert(e.message); }
}

// ---- Bot ----
function botDefendStep(bot) {
  const pair = undefended()[0];
  if (!pair) return false;
  // Chuyển tấn nếu có lá cùng hạng và chưa đỡ lá nào (bot ưu tiên chuyển khi không đỡ được rẻ)
  if (game.allowTransfer && !game.table.some((x) => x.defense)) {
    const t = bot.hand.find((c) => c.rank === pair.attack.rank);
    const nextId = game.players[(game.players.findIndex((p) => p.id === bot.id) + 1) % game.players.length].id;
    const next = game.players.find((p) => p.id === nextId);
    if (t && !bot.hand.some((c) => canBeat(pair.attack, c, game.trumpSuit)) && next && next.hand.length >= game.table.length + 1 && next.id !== humanId) {
      try { transfer(game, bot.id, t.id); log(`${bot.name} chuyển tấn bằng ${cardLabel(t)}.`); return true; } catch {}
    }
  }
  const beating = bot.hand.filter((c) => canBeat(pair.attack, c, game.trumpSuit));
  if (!beating.length) { take(game, bot.id); log(`${bot.name} không đỡ được, nhận cả bàn.`); return true; }
  const card = lowestCard(beating, game.trumpSuit);
  defend(game, bot.id, pair.attack.id, card.id);
  log(`${bot.name} đỡ ${cardLabel(pair.attack)} bằng ${cardLabel(card)}.`);
  return true;
}
function botAttackStep(bot) {
  if (game.table.length === 0) {
    const card = lowestCard(bot.hand, game.trumpSuit);
    attack(game, bot.id, card.id); log(`${bot.name} tấn ${cardLabel(card)}.`); return true;
  }
  if (allDefended()) {
    const addable = bot.hand.filter((c) => canAttackCard(game, bot.id, c));
    if (addable.length) { const card = lowestCard(addable, game.trumpSuit); attack(game, bot.id, card.id); log(`${bot.name} thêm ${cardLabel(card)}.`); return true; }
    finishAttack(game, bot.id); log(`${bot.name} kết thúc đợt.`); return true;
  }
  return false;
}

async function runBots() {
  if (busy || !game || game.phase === "FINISHED") return;
  busy = true;
  try {
    let guard = 0;
    while (game.phase !== "FINISHED" && guard++ < 100) {
      await delay(450);
      const defender = game.players.find((p) => p.id === game.defenderId);
      const attacker = game.players.find((p) => p.id === game.attackerId);
      if (game.table.length > 0 && undefended().length > 0) {
        if (isBot(defender.id)) { botDefendStep(defender); humanAddPassed = false; render(); continue; }
        break; // chờ người đỡ
      }
      if (game.table.length === 0) {
        if (isBot(attacker.id) && !attacker.finished) { botAttackStep(attacker); render(); continue; }
        break; // chờ người tấn
      }
      // Tất cả đã đỡ xong
      if (isBot(attacker.id)) { botAttackStep(attacker); render(); continue; }
      if (attacker.id === humanId) break; // chờ người tấn thêm / kết thúc
      // Người thêm bài không phải tấn chính
      const humanCanAdd = human() && !human().finished && human().hand.some((c) => canAttackCard(game, humanId, c));
      if (humanCanAdd && !humanAddPassed) break; // chờ người quyết định thêm hay không
      const adderBot = game.players.find((p) => isBot(p.id) && p.id !== game.defenderId && !p.finished && p.hand.some((c) => canAttackCard(game, p.id, c)));
      if (adderBot) { const card = lowestCard(adderBot.hand.filter((c) => canAttackCard(game, adderBot.id, c)), game.trumpSuit); attack(game, adderBot.id, card.id); log(`${adderBot.name} thêm ${cardLabel(card)}.`); render(); continue; }
      break; // không ai thêm nữa, chờ người tấn kết thúc (đã break ở trên nếu attacker là người; nếu attacker là bot thì đã xử lý)
    }
  } finally { busy = false; render(); }
}

// ---- Nút ----
$("startBtn").onclick = startGame;
$("newBtn").onclick = () => { $("game").classList.add("hidden"); $("setup").classList.remove("hidden"); };
$("finishBtn").onclick = () => { try { finishAttack(game, humanId); log("Bạn kết thúc đợt."); render(); runBots(); } catch (e) { alert(e.message); } };
$("takeBtn").onclick = () => { try { take(game, humanId); log("Bạn nhận cả bàn."); selected = null; render(); runBots(); } catch (e) { alert(e.message); } };
$("transferBtn").onclick = () => { if (!selected) return; try { transfer(game, humanId, selected); log(`Bạn chuyển tấn bằng ${selected}.`); selected = null; render(); runBots(); } catch (e) { alert(e.message); } };
$("passBtn").onclick = () => { humanAddPassed = true; render(); runBots(); };

// Đồng hồ 30s cho lượt người
setInterval(() => {
  if (!game || game.phase === "FINISHED" || busy) return;
  const myTurn = (game.defenderId === humanId && undefended().length > 0) || (game.attackerId === humanId && game.table.length === 0);
  if (!myTurn) { timerLeft = 30; $("timer").textContent = ""; return; }
  timerLeft--;
  $("timer").textContent = `⏱ ${timerLeft}s`;
  if (timerLeft <= 0) {
    timerLeft = 30;
    if (game.defenderId === humanId) { try { take(game, humanId); log("Hết giờ: bạn tự nhận bài."); } catch {} }
    else { const card = lowestCard(human().hand, game.trumpSuit); try { attack(game, humanId, card.id); log(`Hết giờ: tự đánh ${cardLabel(card)}.`); } catch {} }
    render(); runBots();
  }
}, 1000);
