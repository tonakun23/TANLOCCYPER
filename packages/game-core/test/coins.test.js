import test from "node:test";
import assert from "node:assert/strict";
import { createGame, parseCard, attack, defend, resolveTake } from "../dist/engine.js";
import { TABLE_LEVELS, START_BALANCE, minBalance, isValidLevel, formatCoins, settleGame } from "../dist/coins.js";

// Ví dụ phí sàn của Tony, bàn 100K, 4 người (spec mục 4):
// Lượt ôm 1: D ôm 5 lá (A 2, B 1, C 2) -> A +20K, B +10K, C +20K, D -50K.
// Lượt ôm 2: C ôm 4 lá (A 3, D 1) -> A +30K, D +10K, C -40K.
// Hạng: A nhất +100K, B nhì +50K, C ba -50K, D tư -100K.
// Trước phí: A +150K, B +60K, C -70K, D -140K (tổng 0).
// Sau phí 10%: A +135K, B +54K, C -70K, D -140K, tổng phí 21K.
test("Coin: ví dụ phí sàn của Tony, bàn 100K 4 người", () => {
  const s = settleGame({
    level: 100_000,
    takeLog: [
      { defenderId: "D", counts: { A: 2, B: 1, C: 2 }, cardCount: 5 },
      { defenderId: "C", counts: { A: 3, D: 1 }, cardCount: 4 },
    ],
    finishOrder: ["A", "B", "C"],
    loserId: "D",
    playerIds: ["A", "B", "C", "D"],
    balances: { A: 1_000_000, B: 1_000_000, C: 1_000_000, D: 1_000_000 },
  });
  assert.equal(s.perPlayer.A.gross, 150_000);
  assert.equal(s.perPlayer.A.fee, 15_000);
  assert.equal(s.perPlayer.A.net, 135_000);
  assert.equal(s.perPlayer.B.net, 54_000);
  assert.equal(s.perPlayer.C.net, -70_000);
  assert.equal(s.perPlayer.D.net, -140_000);
  assert.equal(s.totalFee, 21_000);
  assert.equal(s.totalShortfall, 0);
});

// Ví dụ kiểm chứng thêm trong spec, bàn 200K, 3 người:
// A tấn 2 lá, C ôm -> A +40K, C -40K. B tấn 1 lá, C ôm -> B +20K, C -20K.
// Hạng: A nhất +200K, B nhì 0, C ba -200K. Trước phí: A +240K, B +20K, C -260K.
// Sau phí: A +216K, B +18K, C -260K. Tổng cuối -26K = đúng tổng phí.
test("Coin: ví dụ 3 người bàn 200K trong spec", () => {
  const s = settleGame({
    level: 200_000,
    takeLog: [
      { defenderId: "C", counts: { A: 2 }, cardCount: 2 },
      { defenderId: "C", counts: { B: 1 }, cardCount: 1 },
    ],
    finishOrder: ["A", "B"],
    loserId: "C",
    playerIds: ["A", "B", "C"],
    balances: { A: 2_000_000, B: 2_000_000, C: 2_000_000 },
  });
  assert.equal(s.perPlayer.A.net, 216_000);
  assert.equal(s.perPlayer.B.net, 18_000);
  assert.equal(s.perPlayer.C.net, -260_000);
  assert.equal(s.totalFee, 26_000);
});

// Chặn số dư ở 0: người thua không đủ trả thì hệ thống bù phần hụt,
// người thắng vẫn nhận đủ.
test("Coin: chặn ở 0, hệ thống bù hụt, người thắng nhận đủ", () => {
  const s = settleGame({
    level: 100_000,
    takeLog: [],
    finishOrder: ["A"],
    loserId: "B",
    playerIds: ["A", "B"],
    balances: { A: 1_000_000, B: 30_000 },
  });
  assert.equal(s.perPlayer.A.net, 90_000); // +100K hạng, phí 10K
  assert.equal(s.perPlayer.A.balanceAfter, 1_090_000);
  assert.equal(s.perPlayer.B.net, -100_000);
  assert.equal(s.perPlayer.B.balanceAfter, 0);
  assert.equal(s.perPlayer.B.shortfall, 70_000);
  assert.equal(s.totalShortfall, 70_000);
});

test("Coin: mức bàn, vào bàn tối thiểu, định dạng xu", () => {
  assert.deepEqual(TABLE_LEVELS, [50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000]);
  assert.equal(minBalance(100_000), 1_000_000);
  assert.equal(minBalance(50_000), 500_000);
  assert.equal(isValidLevel(100_000), true);
  assert.equal(isValidLevel(30_000), false);
  assert.equal(formatCoins(50_000), "50K");
  assert.equal(formatCoins(1_000_000), "1M");
  assert.equal(formatCoins(10_000_000), "10M");
  assert.equal(START_BALANCE, 1_000_000);
});

// Engine: resolveTake ghi log lượt ôm, đếm TẤT CẢ lá tấn kể cả lá đã đỡ cặp.
test("Engine: takeLog đếm cả lá đã đỡ cặp trước khi người đỡ bỏ cuộc", () => {
  const g = createGame({ playerCount: 2, rng: () => 0.5 });
  g.players[0].hand = [parseCard("S-8"), parseCard("H-8")];
  g.players[1].hand = [parseCard("S-10"), parseCard("S-3"), parseCard("S-4")];
  g.drawPile = [parseCard("D-4"), parseCard("D-5"), parseCard("H-6")];
  g.trumpSuit = "H"; g.trumpCardId = "H-6";
  g.attackerId = "player_0"; g.defenderId = "player_1"; g.defenderInitialHandCount = 3;
  attack(g, "player_0", "S-8");
  defend(g, "player_1", "S-8", "S-10");
  attack(g, "player_0", "H-8"); // cùng hạng 8 với lá trên bàn
  resolveTake(g, "player_1");
  assert.equal(g.takeLog.length, 1);
  assert.equal(g.takeLog[0].defenderId, "player_1");
  assert.deepEqual(g.takeLog[0].counts, { player_0: 2 });
  assert.equal(g.takeLog[0].cardCount, 2);
  // Quyết toán với log này, bàn 100K: người tấn +20K, người ôm -20K.
  const s = settleGame({
    level: 100_000,
    takeLog: g.takeLog,
    finishOrder: ["player_0"],
    loserId: "player_1",
    playerIds: ["player_0", "player_1"],
    balances: { player_0: 1_000_000, player_1: 1_000_000 },
  });
  assert.equal(s.perPlayer.player_0.attackDelta, 20_000);
  assert.equal(s.perPlayer.player_1.attackDelta, -20_000);
});
