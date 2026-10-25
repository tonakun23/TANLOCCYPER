// Tấn Online — backend tối thiểu chạy được (REST, server-authoritative).
// Dùng game-core đã kiểm chứng (luật VN-8): server chỉ chấp nhận nước đi qua
// createCommandProcessor() (VAL-02/03/09/10), và chỉ trả publicView() cho từng
// người xem — không bao giờ gửi tay bài của người khác.
// Giới hạn cố ý của bản này (không phải Colyseus/NestJS đầy đủ):
// - Phòng lưu trong RAM, restart server là mất phòng (chưa có Postgres/Redis).
// - Chưa có JWT/tài khoản: playerId là id trong phòng, phải thuộc phòng mới được đi.
// - Chưa có WebSocket realtime: client poll GET /rooms/:id?playerId=.
// - Chưa có bot phía server: phòng này dành cho người thật; bản web hiện tại vẫn chơi bot local.
import http from "node:http";
import { randomUUID } from "node:crypto";
import { createGame, createCommandProcessor, publicView } from "../../packages/game-core/dist/index.js";

const PORT = Number(process.env.PORT || 3000);
const rooms = new Map(); // roomId -> { game, processor, memberIds, createdAt }

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 1_000_000) req.destroy(); });
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new Error("JSON không hợp lệ")); }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" }); return res.end(); }
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { ok: true, service: "tanloccyper-game-server", ruleSet: "VN_8_V1", rooms: rooms.size, uptimeSec: Math.floor(process.uptime()) });
    }
    if (req.method === "GET" && url.pathname === "/") {
      return send(res, 200, { service: "tanloccyper-game-server", ruleSet: "VN_8_V1", endpoints: ["GET /health", "POST /rooms", "GET /rooms/:id?playerId=", "POST /rooms/:id/commands"] });
    }
    if (req.method === "POST" && url.pathname === "/rooms") {
      const body = await readBody(req);
      const playerCount = Number(body.playerCount || 2);
      const names = Array.isArray(body.playerNames) ? body.playerNames : undefined;
      const game = createGame({ playerCount, playerNames: names, allowTransfer: body.allowTransfer !== false });
      const roomId = randomUUID();
      rooms.set(roomId, { game, processor: createCommandProcessor(), memberIds: game.players.map((p) => p.id), createdAt: new Date().toISOString() });
      return send(res, 201, { roomId, players: game.players.map((p) => ({ id: p.id, name: p.name })), attackerId: game.attackerId, defenderId: game.defenderId, trumpSuit: game.trumpSuit, version: game.version });
    }
    const roomMatch = url.pathname.match(/^\/rooms\/([^/]+)$/);
    if (req.method === "GET" && roomMatch) {
      const room = rooms.get(roomMatch[1]);
      if (!room) return send(res, 404, { error: "ROOM_NOT_FOUND" });
      const playerId = url.searchParams.get("playerId") || room.memberIds[0];
      return send(res, 200, { roomId: roomMatch[1], view: publicView(room.game, playerId) });
    }
    const cmdMatch = url.pathname.match(/^\/rooms\/([^/]+)\/commands$/);
    if (req.method === "POST" && cmdMatch) {
      const room = rooms.get(cmdMatch[1]);
      if (!room) return send(res, 404, { error: "ROOM_NOT_FOUND" });
      const body = await readBody(req);
      const result = room.processor.apply(room.game, body, room.memberIds);
      return send(res, result.accepted ? 200 : 400, { ...result, view: publicView(room.game, body.playerId) });
    }
    return send(res, 404, { error: "NOT_FOUND" });
  } catch (e) {
    return send(res, 400, { error: e.code || "ERROR", message: e.message || String(e) });
  }
});

server.listen(PORT, "0.0.0.0", () => console.log(`tanloccyper-game-server listening on ${PORT}`));
