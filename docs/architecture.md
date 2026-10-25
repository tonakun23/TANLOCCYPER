# Kiến trúc tổng thể — Tấn Online

## Trạng thái hiện tại (25/10/2026, kiểm chứng từ repo)
Repo `tonakun23/TANLOCCYPER` đã có Sprint 1 ban đầu, nhánh `main` @ `562f864`:
- `packages/game-core/src/engine.js` (JS) + test 6/6 + bàn chơi web với bot (`apps/web/`).
- Lần nâng cấp này KHÔNG xóa bàn chơi đó. Nó thêm lớp TypeScript canonical
  (`packages/game-core/src/*.ts` -> `dist/`) và lớp server adapter, để Sprint 2
  (Colyseus) dùng chung engine mà không phải viết lại luật.

## Mục tiêu kiến trúc
Server authoritative, tuyệt đối. Client chỉ là “màn hình + nút bấm”:
client gửi command, server validate, server mới đổi state, server mới broadcast
public view. Không có trường hợp client tự tính kết quả, tự cộng xu, tự xem
bài đối thủ.

## Sơ đồ
```
Web/PWA (React + Vite + Tailwind + PixiJS + Zustand)   [Sprint 4, chưa làm]
        |  HTTPS (REST)                |  WSS (Colyseus)
        v                              v
Caddy (HTTPS/WSS, reverse proxy)     [Sprint 6, chưa làm]
        |                              |
REST API (NestJS)                    Game Server (Node + Colyseus, TanRoom)
  - /auth/guest, /auth/login            - nhận command qua server adapter
  - /rooms, /rooms/:id/join-ticket     - validate VAL-01..VAL-10
  - /users/me, /matches                 - broadcast publicView + privateHand
        |                              |
PostgreSQL (Prisma)                  Redis (session/matchmaking/cache)
  users, auth_sessions, game_rooms,     matchmaking queue, reconnect token,
  room_members, game_matches,           rate-limit counters
  match_players, match_events
        ^                              ^
        +---- packages/game-core (TS thuần, không phụ thuộc React/DB/WS) ----+
               cards / rules / engine / server adapter / tests
```

## Luồng một nước đi
1. Client gửi `{actionId, expectedVersion, payload}` qua Colyseus room.
2. TanRoom xác thực session -> userId đáng tin cậy (không tin userId client gửi).
3. `server.ts: applyCommand()` kiểm tra: phòng, lượt, phase, bài thuộc tay,
   luật, giới hạn tấn, actionId trùng, version cũ.
4. Nếu hợp lệ: engine đổi state nguyên tử, `version++`, ghi `match_events`
   (sequence unique), broadcast public view cho mọi người + private hand cho
   từng người.
5. Nếu không hợp lệ: trả `game.action_rejected {code}` và, khi version lệch,
   gửi lại snapshot để client tự đồng bộ, không tự sửa state.

## Chia sẻ code trong monorepo
- `packages/game-core`: luật + adapter, dùng chung cho web, game-server, test.
- `packages/shared`: (Sprint 2) type của REST/WS contract, sinh từ docs này.
- `apps/web`: React app (Sprint 4). Bản `apps/web/` hiện tại là demo vanilla
  với bot, giữ lại để kiểm luật cho tới khi React app thay thế nó.
- `apps/api`: NestJS (Sprint 3). Hiện chỉ có Prisma schema, chưa có code chạy.
- `apps/game-server`: Colyseus (Sprint 2). Hiện chỉ có khung thư mục, chưa có code chạy.

## Quyết định kiến trúc đã chốt
- Monorepo, game-core không phụ thuộc framework/DB/WS.
- Một ván = nhiều đợt tấn. State machine: WAITING -> DEALING -> ATTACKING /
  DEFENDING -> RESOLVING -> DRAWING -> (ATTACKING | FINISHED). Các trạng thái
  ADDING/TRANSFERRING/TAKING là pha con trong một đợt, không phải phase riêng
  của ván, để tránh state machine phình ra.
- Game state đang chơi giữ trong RAM game server + snapshot/log sự kiện để
  khôi phục sau restart; DB chỉ lưu dữ liệu bền (tài khoản, phòng, kết quả).
- Xu: chỉ là điểm thưởng trong game, không nạp/rút/đổi tiền thật ở MVP.
