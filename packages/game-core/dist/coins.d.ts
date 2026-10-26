import type { TakeEntry } from "./engine.js";
export declare const TABLE_LEVELS: number[];
export declare const START_BALANCE = 1000000;
export declare const FEE_RATE = 0.1;
export declare const ATTACK_RATE = 0.1;
export declare const ENTRY_MULTIPLIER = 10;
export declare function minBalance(level: number): number;
export declare function isValidLevel(level: number): boolean;
export declare function formatCoins(n: number): string;
export declare function rankPct(playerCount: number): number[];
export interface PlayerSettlement {
    attackDelta: number;
    rankDelta: number;
    gross: number;
    fee: number;
    net: number;
    balanceBefore: number;
    balanceAfter: number;
    shortfall: number;
}
export interface Settlement {
    level: number;
    perPlayer: Record<string, PlayerSettlement>;
    totalFee: number;
    totalShortfall: number;
}
export interface SettleInput {
    level: number;
    takeLog: TakeEntry[];
    finishOrder: string[];
    loserId: string | null;
    playerIds: string[];
    balances: Record<string, number>;
}
export declare function settleGame(input: SettleInput): Settlement;
