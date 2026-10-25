# Đặc tả nghiệp vụ & kỹ thuật — Tấn Online (tóm tắt triển khai)

Document: TON-BRD-001 · Version 1.0 · 25/10/2026 · MVP · Luật VN_8_V1 · 2–4 người

## 1. Màn hình & chức năng MVP
SCR-01 Splash · SCR-02 Login (chơi khách) · SCR-03 Lobby · SCR-04 Room Browser ·
SCR-05 Create Room · SCR-06 Waiting Room · SCR-07 Game Table · SCR-08 Result ·
SCR-09 Profile · SCR-10 Settings.

FR P0: đăng nhập khách, tạo phòng, vào phòng bằng mã, sẵn sàng, bắt đầu trận,
xáo/chia bài server-side, xác định chủ, tấn/đỡ/thêm bài hợp lệ, nhận bài, bốc bổ
sung, đếm ngược lượt, xác định kết quả, kết nối lại, lưu lịch sử trận (P1).
Ngoài MVP: nạp/rút tiền thật, giải đấu tiền thật, xếp hạng toàn hệ thống, chat thoại.

## 2. Game state (server nội bộ, không gửi nguyên vẹn cho client)
`GameState { matchId, phase: WAITING|DEALING|ATTACKING|DEFENDING|RESOLVING|DRAWING|FINISHED,
players[{userId, seat, hand (server-only), connected, ready, finished}],
attackerId, defenderId, trumpSuit, trumpCardId, drawPile, discardPile,
table[{attack, defense|null}], maxAttackCards, defenderInitialHandCount,
turnDeadline, result{loserId, finishOrder} }`

Bất biến: 1 lá chỉ ở 1 nơi; tổng luôn 52 lá; 1 Card.id xuất hiện đúng 1 lần;
không có 2 lượt hợp lệ đồng thời mâu thuẫn; action đã xử lý không chạy lại;
FINISHED không nhận thêm nước đi.

## 3. API contract (khi làm server)
REST `/api/v1`: POST /auth/guest, /auth/login, /auth/refresh, /auth/logout,
GET/PATCH /users/me, GET/POST /rooms, GET /rooms/:id, POST /rooms/:id/join-ticket,
GET /matches, GET /matches/:id. Lỗi chuẩn: `{error:{code, message, requestId}}`
với ROOM_FULL, ROOM_ACCESS_DENIED, ROOM_ALREADY_STARTED, NOT_YOUR_TURN,
CARD_NOT_IN_HAND, INVALID_DEFENSE, STALE_GAME_STATE, ACTION_ALREADY_PROCESSED.

WebSocket (Colyseus, room `tan_room`): client→server `room.ready, room.start,
game.attack{cardId}, game.defend{attackCardId, defenseCardId}, game.add_attack,
game.transfer, game.take, game.finish_attack, game.pass_add, room.leave`
— mọi command có envelope `{actionId, expectedVersion, payload}`.
Server→client: `game.started, game.turn_changed, game.action_accepted/rejected,
game.private_hand, game.round_resolved, game.finished, room.player_*`.

## 4. Validation pipeline
Nhận command → xác thực token/phiên → quyền trong phòng → actionId + version →
phase + lượt + luật bài → cập nhật nguyên tử → ghi sự kiện + đồng bộ.
Timeout đề xuất: 30s/lượt; đỡ hết giờ → nhận bài; tấn/thêm hết giờ → pass nếu
đã có ít nhất 1 lá tấn hợp lệ; giữ reconnect 60s.

## 5. Database (PostgreSQL + Prisma, khi làm server)
users, auth_sessions (chỉ lưu hash refresh token), game_rooms (code unique cho
phòng đang hoạt động), room_members (room_id, seat unique), game_matches,
match_players, match_events (match_id, sequence unique). Game state đang chơi
giữ trong RAM game server + snapshot/log sự kiện để khôi phục sau restart.

## 6. Backlog sprint (6 sprint × 2 tuần, 1 dev full-stack + AI hỗ trợ)
- Sprint 1 — Foundation & Rules: monorepo, luật VN_8_V1, deck/shuffle, canBeat/
  canAttack/canTransfer, unit test engine. **→ Đã làm trong bản này (game-core + web vs bot).**
- Sprint 2 — Realtime: Colyseus TanRoom, command validation, public/private view, timer.
- Sprint 3 — Lobby & Room: REST API, tạo phòng/mã mời, sẵn sàng, bắt đầu trận.
- Sprint 4 — Bàn chơi: React/PixiJS, animation chia/đánh/nhận bài, responsive mobile.
- Sprint 5 — Tài khoản & xu: guest/đăng ký, xu ảo, thưởng ngày, bot, chat nhanh, reconnect.
- Sprint 6 — Kiểm thử & deploy: 20 ván liên tiếp không lỗi đồng bộ, load test, Docker + Caddy.

## 7. Test luật (đã có trong game-core, mở rộng khi làm server)
TC-001 chia 8 lá/4 người còn 20 lá · TC-002 9♠ đỡ 8♠ hợp lệ · TC-003 8♥ đỡ J♥
(chủ ♥) không hợp lệ · TC-004 2♥ đỡ A♠ (chủ ♥) hợp lệ · TC-005 tấn lá không có
bị từ chối · TC-006 sai lượt bị từ chối · TC-007 hai nước cùng lúc chỉ 1 hợp lệ ·
TC-008 gửi lại actionId không nhân đôi · TC-009 reconnect khôi phục đúng bài/state ·
TC-010 hết nọc, 1 người còn bài · TC-011 4 người rời phòng giải phóng room an toàn ·
TC-012 truy vấn dữ liệu đối thủ không lộ bài kín.

## 8. Kiến trúc mục tiêu (khi làm online)
Web/PWA (React + TypeScript + PixiJS + Tailwind) → Caddy (HTTPS/WSS) →
REST NestJS (login/profile/history) + Colyseus WebSocket (room/turn/timer) →
PostgreSQL (dữ liệu bền) + Redis (session/matchmaking). Xem chi tiết trong
bản đặc tả dài mà Tony đã có; file này là bản rút gọn để code theo.
