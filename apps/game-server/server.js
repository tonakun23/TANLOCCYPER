// Tấn Online — backend WS + REST, server-authoritative, luật VN-8.
// - REST cũ giữ nguyên để tương thích (phòng uuid, ván bắt đầu ngay).
// - WS mới là đường chơi với người thật:
//   * Phòng chờ mã 6 số, chủ phòng tạo, người khác vào bằng mã, ấn Sẵn sàng,
//     chủ phòng ấn Bắt đầu khi đủ >=2 người và tất cả đã sẵn sàng.
//   * Ván chỉ server mới được chia bài và xử lý nước đi qua createCommandProcessor
//     (VAL-02/03/09/10), mỗi người chỉ nhận publicView của mình (không thấy tay người khác).
//   * Lên bài / Kết thúc đợt có cửa sổ theo 5s ở server: nếu có người khác còn lá
//     theo được (cùng hạng) thì server giữ lệnh lại 5s, phát "follow" cho mọi người,
//     trong 5s đó người theo vẫn được ADD_ATTACK, hết 5s (hoặc mọi người theo đã pass)
//     mới thực hiện lệnh gốc. Nếu người theo thêm bài trong lúc giữ Kết thúc đợt thì
//     lệnh kết thúc bị hủy (vì bàn đã có lá chưa đỡ).
// - Đăng nhập Google: FE dùng Google Identity Services lấy ID token, gửi về
//   POST /auth/google, server xác minh qua https://oauth2.googleapis.com/tokeninfo
//   (kiểm tra aud == GOOGLE_CLIENT_ID trên Render, hết hạn, iss Google) rồi cấp
//   sessionToken (uuid, chỉ lưu RAM). Chưa cấu hình GOOGLE_CLIENT_ID thì endpoint
//   trả 503 và FE chơi khách bằng tên tự gõ, WS vẫn chơi được.
// - Giới hạn cố ý: phòng/session chỉ RAM, restart server là mất; chưa có Postgres/Redis,
//   chưa có đồng hồ ép lượt server (client tự đếm giờ tấn/đỡ rồi gửi lệnh), người chơi
//   mất kết nối giữa ván thì ghế vẫn giữ để reconnect bằng token phòng.
import http from "node:http";
import { randomUUID, createPublicKey, createVerify, createHash } from "node:crypto";
import { WebSocketServer } from "ws";
import { createGame, createCommandProcessor, publicView, canAttackCard, take, finishAttack, settleGame, isValidLevel, formatCoins, minBalance, START_BALANCE } from "../../packages/game-core/dist/index.js";

const PORT = Number(process.env.PORT || 3000);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "";
function firebaseConfigFromEnv() {
  if (!FIREBASE_PROJECT_ID) return null;
  return {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${FIREBASE_PROJECT_ID}.appspot.com`,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || "",
  };
}
// Xác minh Firebase ID token bằng JWKS của Google (không cần firebase-admin hay service account):
// header.kid -> khóa công khai từ https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com
// kiểm tra chữ ký RS256, aud == projectId, iss == https://securetoken.google.com/<projectId>, hết hạn, sub.
let firebaseJwksCache = null, firebaseJwksAt = 0;
async function verifyFirebaseIdToken(idToken) {
  if (!FIREBASE_PROJECT_ID) throw Object.assign(new Error("Firebase chưa cấu hình trên Render (thiếu FIREBASE_PROJECT_ID)"), { code: "FIREBASE_NOT_CONFIGURED" });
  const parts = idToken.split(".");
  if (parts.length !== 3) throw Object.assign(new Error("ID token không hợp lệ"), { code: "INVALID_FIREBASE_TOKEN" });
  const b64url = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  let header, payload;
  try { header = JSON.parse(b64url(parts[0]).toString()); payload = JSON.parse(b64url(parts[1]).toString()); } catch { throw Object.assign(new Error("ID token không hợp lệ"), { code: "INVALID_FIREBASE_TOKEN" }); }
  if (Date.now() / 1000 > Number(payload.exp || 0)) throw Object.assign(new Error("Token đã hết hạn"), { code: "INVALID_FIREBASE_TOKEN" });
  if (payload.aud !== FIREBASE_PROJECT_ID) throw Object.assign(new Error("Token không phải của project này"), { code: "INVALID_FIREBASE_TOKEN" });
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) throw Object.assign(new Error("Issuer không phải Firebase"), { code: "INVALID_FIREBASE_TOKEN" });
  if (Date.now() - firebaseJwksAt > 3600_000 || !firebaseJwksCache) {
    const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    firebaseJwksCache = await r.json(); firebaseJwksAt = Date.now();
  }
  const jwk = (firebaseJwksCache.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) throw Object.assign(new Error("Không tìm thấy khóa ký token"), { code: "INVALID_FIREBASE_TOKEN" });
  const key = createPublicKey({ key: jwk, format: "jwk" });
  const ok = createVerify("RSA-SHA256").update(`${parts[0]}.${parts[1]}`).verify(key, b64url(parts[2]));
  if (!ok) throw Object.assign(new Error("Chữ ký token không hợp lệ"), { code: "INVALID_FIREBASE_TOKEN" });
  return { googleId: payload.sub, name: payload.name || payload.email, email: payload.email, avatar: payload.picture || null };
}
const API_BASE = process.env.API_BASE || "";

// ---- REST cũ (giữ nguyên) ----
const rooms = new Map(); // uuid -> { game, processor, memberIds, createdAt }
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

// ---- Session Google (RAM) ----
const sessions = new Map(); // sessionToken -> { googleId, name, email, avatar }
async function verifyGoogleIdToken(idToken) {
  if (!GOOGLE_CLIENT_ID) throw Object.assign(new Error("GOOGLE_NOT_CONFIGURED"), { code: "GOOGLE_NOT_CONFIGURED" });
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  const info = await r.json();
  if (!r.ok || info.error) throw Object.assign(new Error(info.error_description || "ID token không hợp lệ"), { code: "INVALID_GOOGLE_TOKEN" });
  if (info.aud !== GOOGLE_CLIENT_ID) throw Object.assign(new Error("Token không phải của app này"), { code: "INVALID_GOOGLE_TOKEN" });
  if (info.iss !== "https://accounts.google.com" && info.iss !== "accounts.google.com") throw Object.assign(new Error("Issuer không phải Google"), { code: "INVALID_GOOGLE_TOKEN" });
  if (Number(info.exp) * 1000 < Date.now()) throw Object.assign(new Error("Token đã hết hạn"), { code: "INVALID_GOOGLE_TOKEN" });
  return { googleId: info.sub, name: info.name || info.email, email: info.email, avatar: info.picture || null };
}

// ---- Phòng chờ WS ----
const lobbies = new Map(); // code -> lobby
function makeCode() {
  let code;
  do { code = String(148000 + Math.floor(Math.random() * 899)); } while (lobbies.has(code));
  return code;
}
function lobbyRoomView(lobby) {
  return {
    type: "room",
    code: lobby.code, bet: lobby.bet, level: lobby.level || 0, maxPlayers: lobby.maxPlayers, hostId: lobby.hostId,
    state: lobby.game ? (lobby.game.phase === "FINISHED" ? "finished" : "playing") : "waiting",
    players: lobby.players.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar || null, ready: p.ready, online: !!p.socket, isHost: p.id === lobby.hostId, google: !!p.googleId, balance: lobby.balances ? (lobby.balances.get(playerKey(p)) ?? START_BALANCE) : START_BALANCE })),
    rematchReady: [...(lobby.rematchReady || [])],
  };
}
// Khóa số dư: tài khoản Google dùng googleId (ổn định qua các phòng),
// khách vãng lai dùng id ghế trong phòng (mất khi phòng tan, backend chỉ RAM).
function playerKey(p) { return p.googleId || p.id; }
// Quyết toán xu khi ván kết thúc (chỉ chạy 1 lần mỗi ván): hạng + lượt tấn
// bị ôm + phí sàn 10% trên lãi ròng + chặn số dư ở 0 (xem coins.ts).
function maybeSettle(lobby) {
  if (!lobby.game || lobby.game.phase !== "FINISHED" || lobby.settlement) return;
  const game = lobby.game;
  const balances = {};
  for (const p of lobby.players) balances[p.engineId] = lobby.balances.get(playerKey(p)) ?? START_BALANCE;
  const s = settleGame({ level: lobby.level, takeLog: game.takeLog || [], finishOrder: game.finishOrder, loserId: game.loserId, playerIds: lobby.players.map((p) => p.engineId), balances });
  lobby.settlement = s;
  for (const p of lobby.players) lobby.balances.set(playerKey(p), s.perPlayer[p.engineId].balanceAfter);
  broadcast(lobby, {
    type: "settlement", level: lobby.level, totalFee: s.totalFee, totalShortfall: s.totalShortfall,
    players: lobby.players.map((p) => ({ engineId: p.engineId, name: p.name })),
    perPlayer: s.perPlayer,
  });
}
function sendTo(lobby, player, obj) {
  if (player.socket && player.socket.readyState === 1) player.socket.send(JSON.stringify(obj));
}
function broadcastRoom(lobby) {
  const v = lobbyRoomView(lobby);
  for (const p of lobby.players) sendTo(lobby, p, v);
}
function broadcastGame(lobby) {
  if (!lobby.game) return;
  for (const p of lobby.players) sendTo(lobby, p, { type: "game", view: publicView(lobby.game, p.engineId), myEngineId: p.engineId });
}
function broadcast(lobby, obj) {
  for (const p of lobby.players) sendTo(lobby, p, obj);
}
// Tự bắt đầu ván khi đủ 2 người (phòng chờ không còn nút Sẵn sàng/Bắt đầu).
// Trả về true nếu vừa bắt đầu ván. Thiếu xu vào bàn thì báo lỗi cho cả phòng
// (không im lặng treo phòng) và chưa bắt đầu.
function startLobbyGame(lobby) {
  if (lobby.game || lobby.players.length < 2) return false;
  const poor = lobby.players.find((p) => (lobby.balances.get(playerKey(p)) ?? START_BALANCE) < minBalance(lobby.level));
  if (poor) {
    broadcast(lobby, { type: "error", code: "NOT_ENOUGH_BALANCE", message: `${poor.name} chưa đủ xu vào bàn mức ${formatCoins(lobby.level)} (cần tối thiểu ${formatCoins(minBalance(lobby.level))})` });
    return false;
  }
  const names = lobby.players.map((p) => p.name);
  const game = createGame({ playerCount: lobby.players.length, playerNames: names, allowTransfer: false });
  lobby.players.forEach((p, i) => { p.engineId = game.players[i].id; });
  lobby.game = game; lobby.pending = null; lobby.settlement = null;
  broadcastRoom(lobby); broadcastGame(lobby); resetTurnTimer(lobby); return true;
}
// Ván lại online: chỉ bắt đầu khi mọi người còn online trong phòng đều đã
// chọn ván lại (và ít nhất 2 người). Người bấm Về sảnh (leave) hoặc mất kết
// nối sẽ bị xóa khỏi diện tính, nên không kẹt phòng. Người không chơi ván
// lại bị đánh dấu left để token cũ không gắn lại vào ván mới.
function maybeStartRematch(lobby) {
  if (!lobby.game || lobby.game.phase !== "FINISHED") return false;
  const eligible = lobby.players.filter((p) => !p.left && p.socket);
  if (eligible.length < 2) return false;
  if (!eligible.every((p) => lobby.rematchReady.has(p.id))) return false;
  const poor = eligible.find((p) => (lobby.balances.get(playerKey(p)) ?? START_BALANCE) < minBalance(lobby.level));
  if (poor) {
    broadcast(lobby, { type: "error", code: "NOT_ENOUGH_BALANCE", message: `${poor.name} chưa đủ xu vào bàn mức ${formatCoins(lobby.level)} (cần tối thiểu ${formatCoins(minBalance(lobby.level))})` });
    return false;
  }
  const game = createGame({ playerCount: eligible.length, playerNames: eligible.map((p) => p.name), allowTransfer: false });
  eligible.forEach((p, i) => { p.engineId = game.players[i].id; });
  for (const p of lobby.players) if (!eligible.includes(p)) p.left = true;
  clearPending(lobby);
  lobby.game = game; lobby.pending = null; lobby.settlement = null; lobby.rematchReady = new Set();
  broadcastRoom(lobby); broadcastGame(lobby); resetTurnTimer(lobby); return true;
}
function addablePlayers(lobby, excludeEngineIds) {
  if (!lobby.game) return [];
  const out = [];
  for (const p of lobby.players) {
    if (excludeEngineIds.includes(p.engineId)) continue;
    const full = lobby.game.players.find((x) => x.id === p.engineId);
    if (!full || full.finished) continue;
    if (full.hand.some((c) => canAttackCard(lobby.game, p.engineId, c))) out.push(p);
  }
  return out;
}
function clearPending(lobby) {
  if (lobby.pending?.timer) clearTimeout(lobby.pending.timer);
  lobby.pending = null;
}
function executePending(lobby) {
  const pend = lobby.pending; if (!pend || !lobby.game) return;
  clearPending(lobby);
  try {
    if (pend.type === "TAKE") take(lobby.game, pend.actorEngineId);
    else finishAttack(lobby.game, pend.actorEngineId);
  } catch { /* lệnh gốc không còn hợp lệ thì thôi */ }
  broadcast(lobby, { type: "follow-end", mode: pend.type === "TAKE" ? "take" : "finish" });
  broadcastGame(lobby);
  maybeSettle(lobby);
  resetTurnTimer(lobby);
}
// ---- Đồng hồ lượt phía server (30s, giống đồng hồ client) ----
// Người tới lượt mà không đánh (AFK, rớt mạng, tab bị bóp) thì server tự đánh
// thay, ván không kẹt. Không cầm đồng hồ trong lúc giữ theo 5s (lobby.pending)
// và khi ván đã xong. Đi qua cùng đường lệnh người chơi (kể cả giữ theo 5s).
const TURN_TIMEOUT_MS = 30000;
function clearTurnTimer(lobby) {
  if (lobby.turnTimer) { clearTimeout(lobby.turnTimer); lobby.turnTimer = null; }
}
// Ai đang phải hành động lúc này:
// - ATTACKING: người tấn.
// - DEFENDING còn lá chưa đỡ: người đỡ (hết giờ -> lên bài).
// - DEFENDING đã đỡ hết: người tấn (hết giờ -> thêm lá yếu nhất hoặc kết thúc đợt).
function turnHolder(game) {
  if (!game) return null;
  if (game.phase === "ATTACKING") return { engineId: game.attackerId, kind: "attack" };
  if (game.phase === "DEFENDING") {
    if (game.table.some((x) => !x.defense)) return { engineId: game.defenderId, kind: "take" };
    return { engineId: game.attackerId, kind: "attack" };
  }
  return null;
}
function weakestAttackCard(lobby, holderEngineId) {
  const game = lobby.game; if (!game) return null;
  const holder = game.players.find((p) => p.id === holderEngineId);
  if (!holder) return null;
  const playable = holder.hand.filter((c) => canAttackCard(game, holderEngineId, c));
  if (!playable.length) return null;
  // Yếu nhất: hạng thấp nhất; đồng hạng thì giữ lá chủ lại.
  playable.sort((a, b) => (a.rank - b.rank) || ((a.suit === game.trumpSuit ? 1 : 0) - (b.suit === game.trumpSuit ? 1 : 0)));
  return playable[0];
}
function resetTurnTimer(lobby) {
  clearTurnTimer(lobby);
  if (!lobby.game || lobby.game.phase === "FINISHED" || lobby.pending) return;
  if (!turnHolder(lobby.game)) return;
  lobby.turnTimer = setTimeout(() => runTurnTimeout(lobby), TURN_TIMEOUT_MS);
}
function runTurnTimeout(lobby) {
  lobby.turnTimer = null;
  if (lobbies.get(lobby.code) !== lobby || !lobby.game) return;
  const holder = turnHolder(lobby.game); if (!holder) return;
  const holderPlayer = lobby.players.find((p) => p.engineId === holder.engineId);
  if (holder.kind === "take") applyServerCommand(lobby, holderPlayer, holder.engineId, "TAKE", {});
  else {
    const card = weakestAttackCard(lobby, holder.engineId);
    if (card) applyServerCommand(lobby, holderPlayer, holder.engineId, "ATTACK", { cardId: card.id });
    else applyServerCommand(lobby, holderPlayer, holder.engineId, "FINISH_ATTACK", {});
  }
}
function applyServerCommand(lobby, player, engineId, cmdType, payload) {
  if (!lobby.game) return;
  const cmd = { actionId: randomUUID(), expectedVersion: lobby.game.version, playerId: engineId, type: cmdType, payload };
  if ((cmdType === "TAKE" || cmdType === "FINISH_ATTACK") && !lobby.pending) {
    if (startPending(lobby, cmdType, player || { name: "Máy chủ" }, engineId)) return;
  }
  const result = lobby.processor.apply(lobby.game, cmd, lobby.players.map((p) => p.engineId));
  if (result.accepted) {
    if (cmdType === "ATTACK" && lobby.pending?.type === "FINISH_ATTACK") {
      clearPending(lobby); broadcast(lobby, { type: "follow-end", mode: "finish" });
    }
    broadcastGame(lobby); broadcastRoom(lobby); maybeSettle(lobby);
  }
  // Lệnh bị từ chối (lượt đã đổi) thì cầm đồng hồ lại cho lượt hiện tại.
  resetTurnTimer(lobby);
}
function startPending(lobby, type, actorPlayer, actorEngineId) {
  clearTurnTimer(lobby); // trong lúc giữ theo 5s thì không cầm đồng hồ lượt
  const exclude = type === "TAKE" ? [actorEngineId] : [actorEngineId, lobby.game.defenderId];
  const adders = addablePlayers(lobby, exclude);
  if (!adders.length) return false;
  lobby.pending = { type, actorEngineId, adders: new Set(adders.map((p) => p.id)), passed: new Set(), timer: setTimeout(() => executePending(lobby), 5000) };
  broadcast(lobby, { type: "follow", mode: type === "TAKE" ? "take" : "finish", seconds: 5, actorName: actorPlayer.name, adders: adders.map((p) => p.id) });
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") { res.writeHead(204, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" }); return res.end(); }
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { ok: true, service: "tanloccyper-game-server", ruleSet: "VN_8_V1", restRooms: rooms.size, lobbies: lobbies.size, uptimeSec: Math.floor(process.uptime()), ws: true, googleConfigured: !!GOOGLE_CLIENT_ID, firebaseConfigured: !!FIREBASE_PROJECT_ID });
    }
    if (req.method === "GET" && url.pathname === "/auth/config") {
      return send(res, 200, { googleClientId: GOOGLE_CLIENT_ID || null, firebaseConfig: firebaseConfigFromEnv(), apiBase: API_BASE || null });
    }
    if (req.method === "POST" && url.pathname === "/auth/firebase") {
      const body = await readBody(req);
      if (!body.idToken) return send(res, 400, { error: "MISSING_ID_TOKEN" });
      try {
        const user = await verifyFirebaseIdToken(body.idToken);
        const sessionToken = randomUUID();
        sessions.set(sessionToken, user);
        return send(res, 200, { sessionToken, user });
      } catch (e) {
        return send(res, e.code === "FIREBASE_NOT_CONFIGURED" ? 503 : 401, { error: e.code || "INVALID_FIREBASE_TOKEN", message: e.message });
      }
    }
    // ---- Vào chơi ngay bằng IP (TẠM THỜI thay Google login) ----
    // Client IP qua Render proxy nằm ở X-Forwarded-For (mục đầu tiên); không có
    // thì dùng remoteAddress. guestId = hash(IP) nên cùng IP là cùng danh tính
    // (đóng vai googleId): số dư online bám theo guestId qua playerKey, giống
    // user Google trước đây. Hạn chế đã biết: chung NAT/wifi/4G thì chung danh
    // tính; đổi IP thì thành người mới; guestId không chống giả mạo — chỉ là
    // cổng tạm, không phải tài khoản thật.
    if (req.method === "POST" && url.pathname === "/auth/guest") {
      const fwd = req.headers["x-forwarded-for"];
      const ip = (typeof fwd === "string" && fwd.split(",")[0].trim()) || req.socket?.remoteAddress || "unknown";
      const hash = createHash("sha256").update(ip).digest("hex");
      const guestId = "ip-" + hash.slice(0, 12);
      const user = { googleId: guestId, name: "Khách " + hash.slice(0, 4), email: null, avatar: null };
      const sessionToken = randomUUID();
      sessions.set(sessionToken, user);
      return send(res, 200, { sessionToken, guestId, name: user.name });
    }
    if (req.method === "POST" && url.pathname === "/auth/google") {
      const body = await readBody(req);
      if (!body.idToken) return send(res, 400, { error: "MISSING_ID_TOKEN" });
      try {
        const user = await verifyGoogleIdToken(body.idToken);
        const sessionToken = randomUUID();
        sessions.set(sessionToken, user);
        return send(res, 200, { sessionToken, user });
      } catch (e) {
        return send(res, e.code === "GOOGLE_NOT_CONFIGURED" ? 503 : 401, { error: e.code || "INVALID_GOOGLE_TOKEN", message: e.message });
      }
    }
    if (req.method === "GET" && url.pathname === "/") {
      return send(res, 200, { service: "tanloccyper-game-server", ruleSet: "VN_8_V1", endpoints: ["GET /health", "GET /auth/config", "POST /auth/google", "WS /ws (create/join/ready/start/command/chat)", "POST /auth/firebase", "POST /auth/guest", "POST /rooms", "GET /rooms (phong public dang cho)", "GET /rooms/:id?playerId=", "POST /rooms/:id/commands"] });
    }
    if (req.method === "POST" && url.pathname === "/rooms") {
      const body = await readBody(req);
      const playerCount = Number(body.playerCount || 2);
      const names = Array.isArray(body.playerNames) ? body.playerNames : undefined;
      const game = createGame({ playerCount, playerNames: names, allowTransfer: false });
      const roomId = randomUUID();
      rooms.set(roomId, { game, processor: createCommandProcessor(), memberIds: game.players.map((p) => p.id), createdAt: new Date().toISOString() });
      return send(res, 201, { roomId, players: game.players.map((p) => ({ id: p.id, name: p.name })), attackerId: game.attackerId, defenderId: game.defenderId, trumpSuit: game.trumpSuit, version: game.version });
    }
    // Bảng phòng public đang chờ người (màn CHƠI NGAY): chỉ phòng chưa bắt đầu ván.
    if (req.method === "GET" && url.pathname === "/rooms") {
      const list = [...lobbies.values()].filter((lb) => lb.isPublic && !lb.game).map((lb) => ({ code: lb.code, bet: lb.bet, maxPlayers: lb.maxPlayers, playerCount: lb.players.length, hostName: lb.players[0]?.name || "Chủ phòng" }));
      return send(res, 200, { rooms: list });
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

// ---- WebSocket ----
const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws) => {
  let lobby = null, player = null;
  const err = (code, message) => ws.send(JSON.stringify({ type: "error", code, message }));
  const attach = (lb, pl) => { lobby = lb; player = pl; pl.socket = ws; };
  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return err("BAD_JSON", "Tin nhắn không phải JSON"); }
    try {
      if (msg.type === "create") {
        const session = msg.sessionToken ? sessions.get(msg.sessionToken) : null;
        const code = makeCode();
        const level = isValidLevel(Number(msg.level)) ? Number(msg.level) : 50_000;
        const lb = { code, bet: formatCoins(level), level, maxPlayers: Math.min(4, Math.max(2, Number(msg.maxPlayers || 4))), isPublic: !!msg.isPublic, hostId: null, players: [], game: null, processor: createCommandProcessor(), pending: null, balances: new Map(), settlement: null, rematchReady: new Set(), turnTimer: null };
        const pl = { id: randomUUID(), token: randomUUID(), name: (session?.name || msg.name || "Bạn").toString().slice(0, 30), avatar: session?.avatar || msg.avatar || null, googleId: session?.googleId || null, ready: false, socket: ws, engineId: null };
        lb.hostId = pl.id; lb.players.push(pl); lobbies.set(code, lb); attach(lb, pl);
        ws.send(JSON.stringify({ type: "joined", playerId: pl.id, token: pl.token, code, isHost: true }));
        broadcastRoom(lb); return;
      }
      if (msg.type === "join") {
        const lb = lobbies.get(String(msg.code || ""));
        if (!lb) return err("ROOM_NOT_FOUND", "Không có phòng với mã này");
        // Reconnect bằng token phòng (người đã rời phòng hoặc không chơi ván
        // lại thì không gắn lại — rơi xuống nhánh vào mới và bị chặn nếu ván đã chạy)
        if (msg.token) {
          const old = lb.players.find((p) => p.token === msg.token);
          if (old && !old.left) { attach(lb, old); ws.send(JSON.stringify({ type: "joined", playerId: old.id, token: old.token, code: lb.code, isHost: old.id === lb.hostId, reconnected: true })); broadcastRoom(lb); if (lb.game) sendTo(lb, old, { type: "game", view: publicView(lb.game, old.engineId), myEngineId: old.engineId }); return; }
        }
        if (lb.game) return err("GAME_ALREADY_STARTED", "Ván đã bắt đầu, không vào giữa ván được");
        if (lb.players.length >= lb.maxPlayers) return err("ROOM_FULL", "Phòng đã đủ người");
        const session = msg.sessionToken ? sessions.get(msg.sessionToken) : null;
        const pl = { id: randomUUID(), token: randomUUID(), name: (session?.name || msg.name || "Bạn").toString().slice(0, 30), avatar: session?.avatar || msg.avatar || null, googleId: session?.googleId || null, ready: false, socket: ws, engineId: null };
        lb.players.push(pl); attach(lb, pl);
        ws.send(JSON.stringify({ type: "joined", playerId: pl.id, token: pl.token, code: lb.code, isHost: false }));
        broadcastRoom(lb);
        // Đủ 2 người là tự vào ván, không chờ bấm Sẵn sàng/Bắt đầu.
        startLobbyGame(lb); return;
      }
      if (!lobby || !player) return err("NOT_IN_ROOM", "Chưa vào phòng");
      if (msg.type === "ready") {
        if (lobby.game) return err("GAME_ALREADY_STARTED", "Ván đã bắt đầu");
        player.ready = !!msg.ready; broadcastRoom(lobby); return;
      }
      if (msg.type === "start") {
        // Đường cũ cho client bản cũ còn nút Bắt đầu: vẫn chỉ chủ phòng được bấm,
        // nhưng không còn yêu cầu Sẵn sàng nữa (đủ 2 người + đủ xu là bắt đầu).
        if (player.id !== lobby.hostId) return err("NOT_HOST", "Chỉ chủ phòng mới bắt đầu được");
        if (lobby.game) return err("GAME_ALREADY_STARTED", "Ván đã bắt đầu");
        startLobbyGame(lobby); return;
      }
      if (msg.type === "rematch") {
        if (!lobby.game || lobby.game.phase !== "FINISHED") return err("GAME_NOT_FINISHED", "Ván chưa kết thúc");
        if (player.left) return err("NOT_IN_ROOM", "Bạn đã rời phòng");
        if (msg.ready) lobby.rematchReady.add(player.id); else lobby.rematchReady.delete(player.id);
        broadcastRoom(lobby); maybeStartRematch(lobby); return;
      }
      if (msg.type === "command") {
        if (!lobby.game) return err("GAME_NOT_STARTED", "Ván chưa bắt đầu");
        const cmd = { actionId: msg.actionId || randomUUID(), expectedVersion: Number(msg.expectedVersion), playerId: player.engineId, type: msg.cmdType, payload: msg.payload || {} };
        // Giữ lệnh lên bài / kết thúc đợt 5s nếu có người theo được
        if ((cmd.type === "TAKE" || cmd.type === "FINISH_ATTACK") && !lobby.pending) {
          if (startPending(lobby, cmd.type, player, player.engineId)) return;
        }
        if (cmd.type === "PASS_ADD" && lobby.pending) {
          lobby.pending.passed.add(player.id);
          const still = [...lobby.pending.adders].filter((id) => !lobby.pending.passed.has(id));
          if (!still.length) executePending(lobby);
          else broadcast(lobby, { type: "follow-pass", playerId: player.id });
          return;
        }
        const result = lobby.processor.apply(lobby.game, cmd, lobby.players.map((p) => p.engineId));
        if (!result.accepted) { ws.send(JSON.stringify({ type: "command-result", accepted: false, code: result.code, message: result.message, version: result.version })); if (result.code === "STALE_GAME_STATE") sendTo(lobby, player, { type: "game", view: publicView(lobby.game, player.engineId), myEngineId: player.engineId }); return; }
        // Người theo thêm bài trong lúc giữ Kết thúc đợt thì hủy lệnh kết thúc đó
        if (cmd.type === "ATTACK" && lobby.pending?.type === "FINISH_ATTACK") {
          clearPending(lobby); broadcast(lobby, { type: "follow-end", mode: "finish" });
        }
        ws.send(JSON.stringify({ type: "command-result", accepted: true, version: result.version }));
        broadcastGame(lobby); broadcastRoom(lobby); maybeSettle(lobby); resetTurnTimer(lobby); return;
      }
      if (msg.type === "chat") {
        const text = String(msg.text || "").slice(0, 200).trim(); if (!text) return;
        broadcast(lobby, { type: "chat", from: player.name, fromId: player.id, text }); return;
      }
      if (msg.type === "leave") {
        if (!lobby.game) {
          lobby.players = lobby.players.filter((p) => p.id !== player.id);
          if (!lobby.players.length) { clearTurnTimer(lobby); lobbies.delete(lobby.code); }
          else { if (lobby.hostId === player.id) lobby.hostId = lobby.players[0].id; broadcastRoom(lobby); }
        } else { player.socket = null; player.left = true; lobby.rematchReady.delete(player.id); broadcastRoom(lobby); maybeStartRematch(lobby); }
        lobby = null; player = null; return;
      }
      return err("UNKNOWN_TYPE", "Loại tin nhắn không hỗ trợ");
    } catch (e) {
      return err(e.code || "ERROR", e.message || String(e));
    }
  });
  ws.on("close", () => {
    if (!lobby || !player) return;
    player.socket = null;
    lobby.rematchReady.delete(player.id);
    if (!lobby.game) {
      // Phòng chờ: giữ ghế 1 lúc cho reconnect, nhưng nếu mọi người đều offline thì dọn phòng sau 60s
      const lb = lobby;
      setTimeout(() => { if (lb.players.every((p) => !p.socket)) lobbies.delete(lb.code); }, 60000);
    }
    broadcastRoom(lobby);
    maybeStartRematch(lobby);
  });
});

server.listen(PORT, "0.0.0.0", () => console.log(`tanloccyper-game-server listening on ${PORT} (WS /ws, Google configured: ${!!GOOGLE_CLIENT_ID}, Firebase configured: ${!!FIREBASE_PROJECT_ID})`));
