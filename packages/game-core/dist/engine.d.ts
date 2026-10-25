export type Suit = "S" | "H" | "D" | "C";
export type Phase = "WAITING" | "DEALING" | "ATTACKING" | "DEFENDING" | "RESOLVING" | "DRAWING" | "FINISHED";
export interface Card {
    id: string;
    suit: Suit;
    rank: number;
}
export interface AttackPair {
    attack: Card;
    defense: Card | null;
}
export interface PlayerState {
    id: string;
    name: string;
    hand: Card[];
    finished: boolean;
}
export interface GameResult {
    loserId: string | null;
    finishOrder: string[];
}
export interface GameState {
    version: number;
    phase: Phase;
    ruleSet: string;
    players: PlayerState[];
    drawPile: Card[];
    discardPile: Card[];
    table: AttackPair[];
    trumpSuit: Suit;
    trumpCardId: string;
    attackerId: string;
    defenderId: string;
    defenderInitialHandCount: number;
    maxAttackCards: number;
    handSize: number;
    allowTransfer: boolean;
    finishOrder: string[];
    loserId: string | null;
    result: GameResult | null;
}
export interface GameOptions {
    playerCount?: number;
    playerNames?: string[];
    allowTransfer?: boolean;
    maxAttackCards?: number;
    handSize?: number;
    rng?: () => number;
}
export declare const SUITS: Suit[];
export declare const SUIT_SYMBOL: Record<Suit, string>;
export declare const SUIT_NAME: Record<Suit, string>;
export declare const RANK_LABEL: Record<number, string>;
export declare class GameError extends Error {
    code: string;
    constructor(code: string, message: string);
}
export declare function cardId(suit: Suit, rank: number): string;
export declare function parseCard(id: string): Card;
export declare function cardLabel(card: Card | string): string;
export declare function createDeck(): Card[];
export declare function shuffleDeck(deck: Card[], rng?: () => number): Card[];
export declare function canBeat(attack: Card, defense: Card, trumpSuit: Suit): boolean;
export declare function canTransferCard(attack: Card, card: Card): boolean;
export declare function assertInvariants(state: GameState): void;
export declare function createGame(opts?: GameOptions): GameState;
export declare function tableRanks(state: GameState): Set<number>;
export declare function canAttackCard(state: GameState, playerId: string, card: Card): boolean;
export declare function attack(state: GameState, playerId: string, cardIdStr: string): GameState;
export declare function defend(state: GameState, playerId: string, attackCardId: string, defenseCardId: string): GameState;
export declare function transfer(state: GameState, playerId: string, cardIdStr: string): GameState;
export declare function take(state: GameState, playerId: string): GameState;
export declare function finishAttack(state: GameState, playerId: string): GameState;
export declare function publicView(state: GameState, viewerId: string): Record<string, unknown>;
