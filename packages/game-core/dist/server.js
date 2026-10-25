// Server adapter — tầng Colyseus/NestJS sẽ gọi hàm này, không gọi engine trực tiếp.
// Nhiệm vụ: VAL-01..VAL-10, idempotency theo actionId, stale version.
// VAL-01 (xác thực session) và VAL-02 (quyền phòng) do tầng ngoài kiểm tra
// trước khi gọi vào đây, vì adapter thuần không biết JWT/session.
import { attack, defend, transfer, take, finishAttack, GameError } from "./engine.js";
export function createCommandProcessor() {
    // actionId -> version sau khi xử lý xong. Trùng actionId thì trả kết quả cũ,
    // KHÔNG chạy lại engine (VAL-09).
    const processed = new Map();
    return {
        processedCount: () => processed.size,
        apply(state, command, memberIds) {
            if (!command.actionId || typeof command.actionId !== "string")
                return { accepted: false, replayed: false, version: state.version, code: "VALIDATION_ERROR", message: "Thiếu actionId" };
            if (processed.has(command.actionId))
                return { accepted: true, replayed: true, version: processed.get(command.actionId) };
            // VAL-03: trận đã kết thúc
            if (state.phase === "FINISHED")
                return { accepted: false, replayed: false, version: state.version, code: "GAME_FINISHED", message: "Ván đã kết thúc" };
            // VAL-02: người chơi có thuộc bàn không (memberIds do tầng ngoài cung cấp từ session)
            if (!memberIds.includes(command.playerId))
                return { accepted: false, replayed: false, version: state.version, code: "ROOM_ACCESS_DENIED", message: "Người chơi không thuộc bàn này" };
            // VAL-10: version cũ -> client phải đồng bộ lại, không chạy engine
            if (command.expectedVersion !== state.version)
                return { accepted: false, replayed: false, version: state.version, code: "STALE_GAME_STATE", message: "Client đang dùng state cũ, cần đồng bộ lại" };
            try {
                const p = command.payload ?? {};
                switch (command.type) {
                    case "ATTACK":
                    case "ADD_ATTACK":
                        if (!p.cardId)
                            throw new GameError("VALIDATION_ERROR", "Thiếu cardId");
                        attack(state, command.playerId, p.cardId);
                        break;
                    case "DEFEND":
                        if (!p.attackCardId || !p.defenseCardId)
                            throw new GameError("VALIDATION_ERROR", "Thiếu attackCardId/defenseCardId");
                        defend(state, command.playerId, p.attackCardId, p.defenseCardId);
                        break;
                    case "TRANSFER":
                        if (!p.cardId)
                            throw new GameError("VALIDATION_ERROR", "Thiếu cardId");
                        transfer(state, command.playerId, p.cardId);
                        break;
                    case "TAKE":
                        take(state, command.playerId);
                        break;
                    case "FINISH_ATTACK":
                        finishAttack(state, command.playerId);
                        break;
                    case "PASS_ADD": break; // không đổi state, chỉ ghi nhận người thêm đã pass (tầng room quản lý lượt thêm)
                    default: throw new GameError("VALIDATION_ERROR", "Loại command không hỗ trợ");
                }
            }
            catch (e) {
                if (e instanceof GameError)
                    return { accepted: false, replayed: false, version: state.version, code: e.code, message: e.message };
                throw e;
            }
            processed.set(command.actionId, state.version);
            return { accepted: true, replayed: false, version: state.version };
        },
    };
}
//# sourceMappingURL=server.js.map