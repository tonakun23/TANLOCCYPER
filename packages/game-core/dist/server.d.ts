import { GameState } from "./engine.js";
export type CommandType = "ATTACK" | "ADD_ATTACK" | "DEFEND" | "TRANSFER" | "TAKE" | "FINISH_ATTACK" | "PASS_ADD";
export interface GameCommand {
    actionId: string;
    expectedVersion: number;
    playerId: string;
    type: CommandType;
    payload?: {
        cardId?: string;
        attackCardId?: string;
        defenseCardId?: string;
    };
}
export interface CommandResult {
    accepted: boolean;
    replayed: boolean;
    version: number;
    code?: string;
    message?: string;
}
export interface CommandProcessor {
    apply: (state: GameState, command: GameCommand, memberIds: string[]) => CommandResult;
    processedCount: () => number;
}
export declare function createCommandProcessor(): CommandProcessor;
