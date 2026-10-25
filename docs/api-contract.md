# API Contract + WebSocket Contract (rút gọn, đủ để code theo)

## REST — prefix `/api/v1`
| Method | Endpoint | Quyền | Ghi chú |
|---|---|---|---|
| POST | /auth/guest | Public | Tạo phiên khách, trả access + refresh (refresh chỉ lưu hash) |
| POST | /auth/login | Public | Đăng nhập tài khoản chính thức (Sprint 5) |
| POST | /auth/refresh | Refresh token | Xoay refresh token |
| POST | /auth/logout | User | Thu hồi phiên |
| GET/PATCH | /users/me | User | Hồ sơ, nickname/avatar |
| GET | /rooms | User | Phòng công khai đang chờ |
| POST | /rooms | User | Body: name, maxPlayers 2-4, visibility, ruleSet VN_8_V1, turnTimeoutSeconds |
| GET | /rooms/:id | User/Member | Thông tin phòng, không lộ bài |
| POST | /rooms/:id/join-ticket | User | Cấp vé vào phòng, server game kiểm tra lại vé (mã phòng không phải là auth) |
| GET | /matches, /matches/:id | Participant/Admin | Lịch sử, chi tiết chỉ người tham gia/admin được xem |

Tạo phòng — response 201: `{data:{id, code, name, hostId, maxPlayers, status:"WAITING", visibility}}`.
Lỗi chuẩn: `{error:{code, message, requestId}}` với `VALIDATION_ERROR, UNAUTHORIZED,
ROOM_ACCESS_DENIED, ROOM_NOT_FOUND, ROOM_FULL, ROOM_ALREADY_STARTED`.

## WebSocket — Colyseus room `tan_room`
Endpoint dev: `ws://localhost:2567`, prod: `wss://ws.example.com`.
Client xác thực khi join bằng token/join-ticket; server map sessionId -> userId
đáng tin cậy, không tin userId trong payload.

### Client -> Server (envelope thống nhất)
```json
{"actionId":"uuid-v4","expectedVersion":42,"type":"DEFEND",
 "payload":{"attackCardId":"S-9","defenseCardId":"H-2"}}
```
| type | payload chính |
|---|---|
| ROOM_JOIN / PLAYER_READY / GAME_START | ready:boolean / (host only) |
| PLAY_ATTACK / ADD_ATTACK | cardId |
| PLAY_DEFENSE | attackCardId, defenseCardId |
| TRANSFER_ATTACK | cardId |
| TAKE_CARDS / FINISH_ATTACK / PASS_ADD | (không cần card) |
| ROOM_LEAVE | — |

### Server -> Client
`game.started, game.turn_changed, game.action_accepted, game.action_rejected,
game.private_hand, game.round_resolved, game.finished, room.player_joined,
room.player_left, room.player_disconnected`.

### Public view (không bao giờ chứa hand người khác hay drawPile)
```json
{"matchId":"match_001","version":42,"phase":"DEFENDING","trumpSuit":"H",
 "drawPileCount":19,"attackerId":"user_A","defenderId":"user_B",
 "turnDeadline":1792900000000,
 "players":[{"userId":"user_A","seat":0,"cardCount":6}],
 "table":[{"attack":"S-9","defense":null}]}
```
Private hand gửi riêng: `{type:"game.private_hand", matchId, version, cards:[...]}`.

## Validation pipeline (VAL-01..VAL-10, implement ở server.ts)
VAL-01 đã xác thực? VAL-02 thuộc bàn? VAL-03 trận chưa kết thúc?
VAL-04 đúng phase? VAL-05 đúng quyền tấn/đỡ/thêm? VAL-06 bài thuộc tay?
VAL-07 luật bài hợp lệ? VAL-08 không vượt giới hạn tấn?
VAL-09 actionId chưa xử lý? (trùng -> trả kết quả cũ, không chạy lại)
VAL-10 expectedVersion khớp? (lệch -> reject STALE_GAME_STATE + gửi snapshot)
Rate limiting, chống spam WS event và kiểm tra quyền phòng là trách nhiệm
của tầng Colyseus/NestJS, không phải của game-core thuần.
