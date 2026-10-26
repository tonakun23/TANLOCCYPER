// Tấn Online — cơ chế xu (thuần, không phụ thuộc React / DB).
// Luật theo bản chốt coin-economy-spec.md (Tony duyệt 2026-10-26):
// - 8 mức bàn, vào bàn cần 10 lần mức bàn.
// - Lượt tấn bị ôm: mỗi lá tấn hợp lệ = 10% mức bàn cho người đánh lá đó
//   (đếm TẤT CẢ lá tấn trong lượt bị ôm, kể cả lá đã được đỡ cặp).
// - Thứ hạng cuối ván: 2 người +100/−100, 3 người +100/0/−100,
//   4 người +100/+50/−50/−100 (tổng luôn bằng 0, không tự sinh xu).
// - Phí sàn 10% CHỈ trên lãi ròng dương, quyết toán theo số ròng từng người.
// - Số dư chặn ở 0: phần hụt do hệ thống bù (người thắng vẫn nhận đủ),
//   ghi rõ vào lịch sử. Xu chỉ trong game, không đổi tiền thật.
import type { TakeEntry } from "./engine.js";

export const TABLE_LEVELS: number[] = [50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000];
export const START_BALANCE = 1_000_000;
export const FEE_RATE = 0.10;
export const ATTACK_RATE = 0.10;
export const ENTRY_MULTIPLIER = 10;

export function minBalance(level: number): number { return level * ENTRY_MULTIPLIER; }
export function isValidLevel(level: number): boolean { return TABLE_LEVELS.includes(level); }
export function formatCoins(n: number): string {
  if (n >= 1_000_000 && n % 1_000_000 === 0) return `${n / 1_000_000}M`;
  if (n >= 1_000 && n % 1_000 === 0) return `${n / 1_000}K`;
  return n.toLocaleString("vi-VN");
}
export function rankPct(playerCount: number): number[] {
  if (playerCount === 2) return [100, -100];
  if (playerCount === 3) return [100, 0, -100];
  return [100, 50, -50, -100];
}

export interface PlayerSettlement {
  attackDelta: number; rankDelta: number; gross: number;
  fee: number; net: number;
  balanceBefore: number; balanceAfter: number; shortfall: number;
}
export interface Settlement {
  level: number;
  perPlayer: Record<string, PlayerSettlement>;
  totalFee: number; totalShortfall: number;
}

export interface SettleInput {
  level: number;
  takeLog: TakeEntry[];
  finishOrder: string[];
  loserId: string | null;
  playerIds: string[];
  balances: Record<string, number>;
}

export function settleGame(input: SettleInput): Settlement {
  const { level, takeLog, finishOrder, loserId, playerIds, balances } = input;
  const perPlayer: Record<string, PlayerSettlement> = {};
  for (const id of playerIds) {
    perPlayer[id] = { attackDelta: 0, rankDelta: 0, gross: 0, fee: 0, net: 0, balanceBefore: balances[id] ?? START_BALANCE, balanceAfter: 0, shortfall: 0 };
  }
  // 1) Thưởng/phạt lượt tấn: chỉ các lượt bị ôm (đã ghi trong takeLog).
  const perCard = Math.round(level * ATTACK_RATE);
  for (const take of takeLog) {
    for (const [attackerId, count] of Object.entries(take.counts)) {
      if (perPlayer[attackerId]) perPlayer[attackerId].attackDelta += perCard * count;
    }
    if (perPlayer[take.defenderId]) perPlayer[take.defenderId].attackDelta -= perCard * take.cardCount;
  }
  // 2) Thưởng/phạt thứ hạng: finishOrder = thứ tự hết bài (hạng 1..n-1),
  // loserId = hạng cuối (người còn bài khi ván kết thúc).
  const order = [...finishOrder];
  if (loserId && !order.includes(loserId)) order.push(loserId);
  const pcts = rankPct(playerIds.length);
  order.forEach((id, i) => {
    if (perPlayer[id] && pcts[i] !== undefined) perPlayer[id].rankDelta = Math.round((pcts[i] / 100) * level);
  });
  // 3) Phí sàn + chặn số dư ở 0.
  let totalFee = 0, totalShortfall = 0;
  for (const id of playerIds) {
    const p = perPlayer[id];
    p.gross = p.attackDelta + p.rankDelta;
    p.fee = p.gross > 0 ? Math.round(p.gross * FEE_RATE) : 0;
    p.net = p.gross - p.fee;
    p.balanceAfter = Math.max(0, p.balanceBefore + p.net);
    p.shortfall = Math.max(0, -(p.balanceBefore + p.net));
    totalFee += p.fee;
    totalShortfall += p.shortfall;
  }
  return { level, perPlayer, totalFee, totalShortfall };
}
