# Game Server — CHƯA TRIỂN KHAI (Sprint 2)

Thư mục này giữ chỗ cho Colyseus TanRoom. TanRoom sẽ:
- Xác thực session -> userId, map sessionId -> userId.
- Gọi `createCommandProcessor()` từ `@tanloccyper/game-core` cho mọi command.
- Broadcast `publicView()` + private hand, timer 30s, reconnect 60s.
- Ghi snapshot + match_events khi cần khôi phục sau restart.

Chưa có code chạy ở đây. Không được tuyên bố “server online đã xong” khi
chưa có TanRoom + integration test 2 client cùng phòng.
