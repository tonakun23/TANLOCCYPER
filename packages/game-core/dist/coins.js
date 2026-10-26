export const TABLE_LEVELS = [50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000];
export const START_BALANCE = 1_000_000;
export const FEE_RATE = 0.10;
export const ATTACK_RATE = 0.10;
export const ENTRY_MULTIPLIER = 10;
export function minBalance(level) { return level * ENTRY_MULTIPLIER; }
export function isValidLevel(level) { return TABLE_LEVELS.includes(level); }
export function formatCoins(n) {
    if (n >= 1_000_000 && n % 1_000_000 === 0)
        return `${n / 1_000_000}M`;
    if (n >= 1_000 && n % 1_000 === 0)
        return `${n / 1_000}K`;
    return n.toLocaleString("vi-VN");
}
// Hiển thị số dư dưới avatar trong ván (quy tắc Tony 2026-10-26):
// dưới 100K hiện đủ (50.000), từ 100K viết gọn K, từ 1M viết gọn M,
// từ 1B viết gọn B; M/B lẻ giữ tối đa 2 chữ số thập phân, bỏ số 0 thừa.
export function formatBalanceShort(n) {
    const neg = n < 0;
    const v = Math.abs(n);
    let out;
    if (v < 100_000)
        out = v.toLocaleString("vi-VN");
    else if (v < 1_000_000)
        out = `${Math.floor(v / 1_000)}K`;
    else if (v < 1_000_000_000) {
        const m = v / 1_000_000;
        out = `${Number.isInteger(m) ? m : parseFloat(m.toFixed(2))}M`;
    }
    else {
        const b = v / 1_000_000_000;
        out = `${Number.isInteger(b) ? b : parseFloat(b.toFixed(2))}B`;
    }
    return neg ? `-${out}` : out;
}
// Tổng tiền tấn bị ôm đã cộng/trừ tới thời điểm hiện tại, tính từ takeLog
// (dùng để hiện số dư live trong ván mà không cần chờ quyết toán cuối ván).
// Mỗi lá tấn hợp lệ = 10% mức bàn cho người đánh lá đó, người ôm trừ theo
// tổng số lá trên bàn — khớp đúng settleGame nên quyết toán cuối ván vẫn đúng.
export function liveTakeTotals(level, takeLog) {
    const totals = {};
    const perCard = Math.round(level * ATTACK_RATE);
    for (const take of takeLog) {
        for (const [attackerId, count] of Object.entries(take.counts)) {
            totals[attackerId] = (totals[attackerId] ?? 0) + perCard * count;
        }
        totals[take.defenderId] = (totals[take.defenderId] ?? 0) - perCard * take.cardCount;
    }
    return totals;
}
export function rankPct(playerCount) {
    if (playerCount === 2)
        return [100, -100];
    if (playerCount === 3)
        return [100, 0, -100];
    return [100, 50, -50, -100];
}
export function settleGame(input) {
    const { level, takeLog, finishOrder, loserId, playerIds, balances } = input;
    const perPlayer = {};
    for (const id of playerIds) {
        perPlayer[id] = { attackDelta: 0, rankDelta: 0, gross: 0, fee: 0, net: 0, balanceBefore: balances[id] ?? START_BALANCE, balanceAfter: 0, shortfall: 0 };
    }
    // 1) Thưởng/phạt lượt tấn: chỉ các lượt bị ôm (đã ghi trong takeLog).
    const perCard = Math.round(level * ATTACK_RATE);
    for (const take of takeLog) {
        for (const [attackerId, count] of Object.entries(take.counts)) {
            if (perPlayer[attackerId])
                perPlayer[attackerId].attackDelta += perCard * count;
        }
        if (perPlayer[take.defenderId])
            perPlayer[take.defenderId].attackDelta -= perCard * take.cardCount;
    }
    // 2) Thưởng/phạt thứ hạng: finishOrder = thứ tự hết bài (hạng 1..n-1),
    // loserId = hạng cuối (người còn bài khi ván kết thúc).
    const order = [...finishOrder];
    if (loserId && !order.includes(loserId))
        order.push(loserId);
    const pcts = rankPct(playerIds.length);
    order.forEach((id, i) => {
        if (perPlayer[id] && pcts[i] !== undefined)
            perPlayer[id].rankDelta = Math.round((pcts[i] / 100) * level);
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
//# sourceMappingURL=coins.js.map