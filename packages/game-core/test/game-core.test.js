import test from "node:test";
import assert from "node:assert/strict";
import { createDeck, createGame, canBeat, parseCard, attack, defend, take, finishAttack, publicView } from "../src/engine.js";

test("TC-001: bộ bài 52 lá duy nhất, chia 8 lá cho 4 người còn 20 lá", () => {
  const deck = createDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map((c) => c.id)).size, 52);
  const g = createGame({ playerCount: 4 });
  assert.ok(g.players.every((p) => p.hand.length === 8));
  assert.equal(g.drawPile.length, 20);
  assert.equal(g.trumpCardId, g.drawPile[g.drawPile.length - 1].id);
});

test("TC-002/003/004: canBeat đúng bảng ví dụ, chủ ♥", () => {
  assert.equal(canBeat(parseCard("S-8"), parseCard("S-10"), "H"), true);
  assert.equal(canBeat(parseCard("C-12"), parseCard("H-2"), "H"), true);
  assert.equal(canBeat(parseCard("H-11"), parseCard("H-8"), "H"), false);
  assert.equal(canBeat(parseCard("D-10"), parseCard("C-14"), "H"), false);
  assert.equal(canBeat(parseCard("H-9"), parseCard("S-14"), "H"), false);
  assert.equal(canBeat(parseCard("S-14"), parseCard("H-2"), "H"), true);
});

test("TC-005/006: tấn bằng lá không có / sai lượt bị từ chối", () => {
  const g = createGame({ playerCount: 2 });
  assert.throws(() => attack(g, g.attackerId, "S-99"), (e) => e.code === "CARD_NOT_IN_HAND");
  assert.throws(() => attack(g, g.defenderId, g.players.find((p) => p.id === g.defenderId).hand[0].id), (e) => ["INVALID_ATTACK","NOT_YOUR_TURN"].includes(e.code));
});

test("Đỡ thành công rồi kết thúc đợt: bài vào chồng bỏ, bốc đủ 8 lá", () => {
  // Dựng ván cố định để test không phụ thuộc shuffle
  const g = createGame({ playerCount: 2, rng: () => 0.5 });
  // Ép tay bài đơn giản: attacker có S-8, defender có S-10
  g.players[0].hand = [parseCard("S-8"), parseCard("S-2")];
  g.players[1].hand = [parseCard("S-10"), parseCard("S-3")];
  g.drawPile = [parseCard("D-4"), parseCard("D-5"), parseCard("H-6")];
  g.trumpSuit = "H"; g.trumpCardId = "H-6";
  g.attackerId = "player_0"; g.defenderId = "player_1";
  g.defenderInitialHandCount = 2;
  attack(g, "player_0", "S-8");
  defend(g, "player_1", "S-8", "S-10");
  finishAttack(g, "player_0");
  assert.equal(g.table.length, 0);
  assert.equal(g.discardPile.length, 2);
  assert.equal(g.attackerId, "player_1"); // người đỡ cũ thành người tấn mới
});

test("Không đỡ được -> nhận bài, lượt tấn chuyển sang người sau người đỡ", () => {
  const g = createGame({ playerCount: 3, rng: () => 0.5 });
  g.players[0].hand = [parseCard("S-8")];
  g.players[1].hand = [parseCard("D-2")];
  g.players[2].hand = [parseCard("C-3")];
  g.drawPile = [];
  g.trumpSuit = "H";
  g.attackerId = "player_0"; g.defenderId = "player_1"; g.defenderInitialHandCount = 1;
  attack(g, "player_0", "S-8");
  take(g, "player_1");
  assert.equal(g.players[1].hand.length, 2); // D-2 + S-8 nhận về
  assert.equal(g.attackerId, "player_2");
});

test("publicView không lộ bài người khác và không lộ drawPile", () => {
  const g = createGame({ playerCount: 2 });
  const v = publicView(g, "player_0");
  assert.ok(!("hand" in v.players[0]));
  assert.equal(v.myHand.length, 8);
  assert.equal(typeof v.drawPileCount, "number");
  assert.ok(!v.drawPile);
});
