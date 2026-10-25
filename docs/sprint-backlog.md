# Sprint backlog — Tấn Online (6 sprint x 2 tuần, 1 dev full-stack + AI)

Trạng thái ngày 25/10/2026: Sprint 1 đang làm, các sprint sau chưa bắt đầu.
Không ghi task nào là “xong” khi chưa có test/build kiểm chứng.

## Sprint 1 — Foundation & Rules [ĐANG LÀM]
- [x] TAN-001 Khởi tạo monorepo + README + docs tổng quan/spec
- [x] TAN-002 Bàn chơi web với bot để kiểm luật (vanilla, giữ lại tới Sprint 4)
- [x] TAN-003 Chuẩn hóa luật VN_8_V1 + bảng biến thể (docs/rules-variants.md)
- [x] TAN-004 Deck 52 lá, shuffle, chia 8 lá, chọn chủ
- [x] TAN-005 canBeat, canAttack, canTransfer, take, finish, draw
- [ ] TAN-006 TypeScript strict cho game-core + server adapter (đang làm ở đợt này)
- [ ] TAN-007 Test mở rộng: transfer, giới hạn tấn, bốc bài, invariants 52 lá,
  duplicate action, stale version, không lộ bài kín
- [ ] TAN-008 Docker dev: postgres + redis (file compose, chưa chạy test tải)
Definition of Done Sprint 1: engine xử lý đúng test luật cốt lõi, adapter
chặn được sai lượt/sai bài/trùng action/version cũ, docs kiến trúc + contract
đủ để Sprint 2 code theo mà không phải hỏi lại luật.

## Sprint 2 — Realtime [CHƯA LÀM]
- Colyseus TanRoom, dùng server adapter, timer 30s, reconnect 60s, AFK policy.
- Broadcast publicView/privateHand, snapshot khi lệch version.
- Integration test: 2 client cùng phòng, 1 ván hoàn chỉnh, không lỗi đồng bộ.

## Sprint 3 — Lobby & Account [CHƯA LÀM]
- NestJS REST API, auth guest/JWT, tạo phòng/mã mời, ready/start, Prisma schema
  áp dụng thật lên Postgres, match_events ghi sequence unique.

## Sprint 4 — Bàn chơi React [CHƯA LÀM]
- React + Vite + TS + Tailwind + PixiJS + Zustand, sảnh/phòng chờ/bàn chơi,
  animation chia/đánh/đỡ/nhận bài, responsive desktop + mobile dọc/ngang.
- Thay thế bàn vanilla hiện tại, giữ nguyên engine và contract.

## Sprint 5 — Tài khoản, xu, bot, xã hội [CHƯA LÀM]
- Tài khoản chính thức, xu ảo (không tiền thật), thưởng ngày, bot cơ bản,
  chat nhanh/emoji, lịch sử trận, bảng xếp hạng.

## Sprint 6 — Kiểm thử & Deploy [CHƯA LÀM]
- 20 ván liên tiếp 2–4 người không lỗi đồng bộ, load test, logging/healthcheck/
  backup, Docker + Caddy HTTPS/WSS lên Ubuntu Server, GitLab CI.
