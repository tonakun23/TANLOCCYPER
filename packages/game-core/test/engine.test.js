import test from "node:test";
import assert from "node:assert/strict";
import { createDeck, createGame, canBeat, parseCard, attack, defend, transfer, take, finishAttack, publicView, assertInvariants } from "../dist/engine.js";
import { createCommandProcessor } from "../dist/server.js";

function fixedGame() {
  const g = createGame({ playerCount: 2, rng: () => 0.5 });
  g.players[0].hand = [parseCard("S-8"), parseCard("S-2")];
  g.players[1].hand = [parseCard("S-10"), parseCard("S-3")];
  g.drawPile = [parseCard("D-4"), parseCard("D-5"), parseCard("H-6")];
  g.trumpSuit = "H"; g.trumpCardId = "H-6";
  g.attackerId = "player_0"; g.defenderId = "player_1"; g.defenderInitialHandCount = 2;
  return g;
}

test("TC-001: 52 lá duy nhất, chia 8 lá/4 người còn 20 lá, invariants giữ sau mỗi nước", () => {
  const deck = createDeck(); assert.equal(deck.length, 52); assert.equal(new Set(deck.map((c) => c.id)).size, 52);
  const g = createGame({ playerCount: 4 }); assert.ok(g.players.every((p) => p.hand.length === 8)); assert.equal(g.drawPile.length, 20); assertInvariants(g);
});

test("Invariants giữ nguyên trong ván đầy đủ 52 lá", () => {
  const g = createGame({ playerCount: 2 });
  assertInvariants(g);
  const atk = g.players.find((p) => p.id === g.attackerId);
  attack(g, g.attackerId, atk.hand[0].id); assertInvariants(g);
});

test("TC-002/003/004: canBeat đúng bảng ví dụ, chủ ♥", () => {
  assert.equal(canBeat(parseCard("S-8"), parseCard("S-10"), "H"), true);
  assert.equal(canBeat(parseCard("C-12"), parseCard("H-2"), "H"), true);
  assert.equal(canBeat(parseCard("H-11"), parseCard("H-8"), "H"), false);
  assert.equal(canBeat(parseCard("D-10"), parseCard("C-14"), "H"), false);
  assert.equal(canBeat(parseCard("H-9"), parseCard("S-14"), "H"), false);
});

test("TC-005/006: tấn lá không có / sai lượt bị từ chối", () => {
  const g = createGame({ playerCount: 2 });
  assert.throws(() => attack(g, g.attackerId, "S-99"), (e) => e.code === "CARD_NOT_IN_HAND");
  assert.throws(() => attack(g, g.defenderId, g.players.find((p) => p.id === g.defenderId).hand[0].id), (e) => ["INVALID_ATTACK", "NOT_YOUR_TURN"].includes(e.code));
});

test("Đỡ thành công + kết thúc đợt: bài vào chồng bỏ, bốc đủ, người đỡ thành người tấn", () => {
  const g = fixedGame(); attack(g, "player_0", "S-8"); defend(g, "player_1", "S-8", "S-10"); finishAttack(g, "player_0");
  assert.equal(g.table.length, 0); assert.equal(g.discardPile.length, 2); assert.equal(g.attackerId, "player_1");
});

test("Không đỡ được -> nhận bài, lượt tấn chuyển sang người sau người đỡ", () => {
  const g = createGame({ playerCount: 3, rng: () => 0.5 });
  g.players[0].hand = [parseCard("S-8")]; g.players[1].hand = [parseCard("D-2")]; g.players[2].hand = [parseCard("C-3")];
  g.drawPile = []; g.trumpSuit = "H"; g.attackerId = "player_0"; g.defenderId = "player_1"; g.defenderInitialHandCount = 1;
  attack(g, "player_0", "S-8"); take(g, "player_1");
  assert.equal(g.players[1].hand.length, 2); assert.equal(g.attackerId, "player_2");
});

test("Thêm bài: chỉ cùng hạng mới được, vượt giới hạn người đỡ thì bị chặn", () => {
  const g = fixedGame();
  // defender chỉ có 2 lá khi đợt bắt đầu -> tối đa 2 quân tấn
  g.players[0].hand = [parseCard("S-8"), parseCard("S-8".replace("S-8", "D-8")), parseCard("C-5")];
  // thực tế: tay attacker = S-8, D-8, C-5 ; defender = S-10, S-3
  attack(g, "player_0", "S-8"); defend(g, "player_1", "S-8", "S-10");
  attack(g, "player_0", "D-8"); // thêm lá cùng hạng 8, hợp lệ (đủ 2 quân)
  assert.equal(g.table.length, 2);
  assert.throws(() => attack(g, "player_0", "C-5"), (e) => e.code === "INVALID_ATTACK"); // vượt 2 quân / khác hạng
});

test("Chuyển tấn: chưa đỡ lá nào + cùng hạng thì được, đã đỡ rồi thì không", () => {
  const g = createGame({ playerCount: 3, rng: () => 0.5 });
  g.players[0].hand = [parseCard("C-9")]; g.players[1].hand = [parseCard("D-9"), parseCard("S-2")]; g.players[2].hand = [parseCard("S-10"), parseCard("S-11")];
  g.drawPile = []; g.trumpSuit = "H"; g.attackerId = "player_0"; g.defenderId = "player_1"; g.defenderInitialHandCount = 2;
  attack(g, "player_0", "C-9"); transfer(g, "player_1", "D-9");
  assert.equal(g.defenderId, "player_2"); assert.equal(g.table.length, 2);
  const g2 = fixedGame(); attack(g2, "player_0", "S-8"); defend(g2, "player_1", "S-8", "S-10");
  assert.throws(() => transfer(g2, "player_1", "S-3"), (e) => e.code === "INVALID_TRANSFER");
});

test("publicView không lộ bài người khác và không lộ drawPile", () => {
  const g = createGame({ playerCount: 2 }); const v = publicView(g, "player_0");
  assert.ok(!("hand" in v.players[0])); assert.equal(v.myHand.length, 8); assert.equal(typeof v.drawPileCount, "number"); assert.ok(!("drawPile" in v));
});

test("Server adapter: trùng actionId không chạy lại, version cũ bị chặn, người ngoài bàn bị chặn", () => {
  const g = fixedGame(); const proc = createCommandProcessor(); const members = ["player_0", "player_1"];
  const cmd = { actionId: "a1", expectedVersion: g.version, playerId: "player_0", type: "ATTACK", payload: { cardId: "S-8" } };
  const r1 = proc.apply(g, cmd, members); assert.equal(r1.accepted, true); assert.equal(r1.replayed, false);
  const vAfter = g.version;
  const rReplay = proc.apply(g, cmd, members); assert.equal(rReplay.accepted, true); assert.equal(rReplay.replayed, true); assert.equal(g.version, vAfter); assert.equal(g.table.length, 1);
  const rStale = proc.apply(g, { actionId: "a2", expectedVersion: 999, playerId: "player_1", type: "DEFEND", payload: { attackCardId: "S-8", defenseCardId: "S-10" } }, members);
  assert.equal(rStale.accepted, false); assert.equal(rStale.code, "STALE_GAME_STATE");
  const rOutsider = proc.apply(g, { actionId: "a3", expectedVersion: g.version, playerId: "player_99", type: "TAKE" }, members);
  assert.equal(rOutsider.accepted, false); assert.equal(rOutsider.code, "ROOM_ACCESS_DENIED");
  const rDefend = proc.apply(g, { actionId: "a4", expectedVersion: g.version, playerId: "player_1", type: "DEFEND", payload: { attackCardId: "S-8", defenseCardId: "S-10" } }, members);
  assert.equal(rDefend.accepted, true);
});
