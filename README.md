# TANLOCCYPER — Tấn Online

Game bài chiến thuật nhiều người chơi, phong cách casino đỏ đậm / vàng kim,
chơi trên Web / Mobile Browser, không cần cài đặt.

> **Phạm vi quan trọng:** Xu trong game chỉ là điểm thưởng trong trò chơi,
> **không nạp / rút, không đổi thành tiền thật** trong phiên bản đầu tiên.
> Dự án tập trung vào giải trí, tránh yếu tố cá cược.

## Chơi thử ngay (bản hiện tại)

Bản này chơi **offline với bot** để kiểm luật trước khi làm server online.
Đó là Sprint 1 + bàn chơi thử, chưa phải phòng online nhiều người thật.

```bash
cd TANLOCCYPER
python3 -m http.server 8000
# mở http://localhost:8000/apps/web/
```

Chọn tên, số người (2–4), bật/tắt chuyển tấn, bấm **Chơi ngay**.
- Bài của bạn ở dưới, bấm lá bài để tấn / đỡ.
- Nếu có nhiều cặp đang chờ đỡ, bấm lá bài rồi bấm vào cặp cần đỡ.
- Người đỡ có thể bấm **Nhận bài** hoặc **Chuyển tấn** (lá cùng hạng, khi chưa đỡ lá nào).
- Người tấn bấm **Kết thúc đợt** khi mọi lá đã được đỡ.
- Hết 30 giây ở lượt tấn đầu / lượt đỡ, hệ thống tự đánh lá thấp nhất / tự nhận bài.

Chạy test luật:

```bash
node --test packages/game-core/test/game-core.test.js
# 6/6 test pass (ngày 25/10/2026): chia bài, canBeat, tấn sai lượt,
# đỡ + kết thúc đợt, nhận bài, publicView không lộ bài kín
```

## Luật chơi — Tấn Việt Nam, VN-8 (đã chốt)

Xem đầy đủ ở [docs/overview-and-rules.md](docs/overview-and-rules.md).

- Bộ bài Tây 52 lá, không Joker. Hạng từ thấp đến cao: 2 → A.
- Mỗi bàn 2–4 người, mỗi người chia **8 lá** ban đầu.
- Lật 1 lá từ nọc để xác định **chất chủ**. Người giữ lá chủ nhỏ nhất tấn trước.
- Tấn: đánh 1 lá, sau đó chỉ được thêm lá **cùng hạng** với lá đã xuất hiện trên bàn.
- Đỡ: cùng chất lớn hơn, hoặc lá chủ đỡ lá không phải chủ. Lá tấn là chủ thì chỉ lá chủ lớn hơn mới đỡ được.
- Giới hạn đợt tấn: không vượt số lá người đỡ có khi đợt bắt đầu, tối đa 6 lá.
- Không đỡ được → nhận toàn bộ bài trên bàn, mất quyền tấn lượt kế tiếp.
- Đỡ hết → bài trên bàn vào chồng bỏ. Bốc bài theo thứ tự: tấn chính → người thêm bài → người đỡ, tối đa 8 lá.
- Hết nọc, người hết bài thì hoàn thành. Người cuối cùng còn bài là người thua.
- Chuyển tấn (bật/tắt theo phòng): người đỡ chưa đỡ lá nào, đánh lá cùng hạng để chuyển sang người kế tiếp.

## Cấu trúc

```
tan-online / TANLOCCYPER
├── apps/web/                 # Bàn chơi web chơi với bot (HTML/CSS/JS thuần, không cần build)
│   ├── index.html
│   ├── styles.css
│   └── app.js                # UI + bot đơn giản, dùng game-core
├── packages/game-core/       # Luật bài thuần, không phụ thuộc React/DB/WebSocket
│   ├── src/engine.js         # createGame, attack, defend, transfer, take, finishAttack, publicView
│   └── test/game-core.test.js
└── docs/
    ├── overview-and-rules.md # Bản tổng quan + luật chơi, dùng làm đầu vào cho AI coding
    └── spec.md               # Đặc tả nghiệp vụ/kỹ thuật, API contract, backlog sprint
```

## Lộ trình

- **Sprint 1 (đã làm ở đây):** game-core VN-8 + test + bàn chơi web với bot.
- **Sprint 2–3:** Colyseus game server, phòng chơi, REST API (NestJS), PostgreSQL/Redis, `publicView`/`privateHand` tách bạch — server quyết định mọi nước đi, client không được tự đổi bài/điểm.
- **Sprint 4–5:** Sảnh, tạo phòng bằng mã, tài khoản khách, xu ảo, bot nâng cao, chat nhanh, reconnect.
- **Sprint 6:** Kiểm thử 20 ván liên tiếp không lỗi đồng bộ, deploy Docker + Caddy (HTTPS/WSS).

Chi tiết backlog và API contract xem [docs/spec.md](docs/spec.md).

## Đẩy lên GitHub

Repo đích: https://github.com/tonakun23/TANLOCCYPER (public, tạo 25/10/2026, đang trống).

```bash
git init
git add .
git commit -m "feat: TANLOCCYPER Sprint 1 - game-core VN-8 + web vs bot"
git branch -M main
git remote add origin https://github.com/tonakun23/TANLOCCYPER.git
git push -u origin main
```

Lưu ý: nếu push bằng token cũ của Muse mà gặp `403 Resource not accessible`,
đó là token chưa có quyền Contents Read/Write cho repo này — sửa quyền token
rồi push lại, code local vẫn nguyên vẹn.
