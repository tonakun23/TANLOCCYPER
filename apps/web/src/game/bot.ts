import { canAttackCard, canBeat, defend, attack, resolveFinishAttack, resolveTake, cardLabel, parseCard } from "../../../../packages/game-core/src/engine";
import type { Card, GameState, PlayerState } from "../../../../packages/game-core/src/engine";

export function lowestCard(cards: Card[], trump: string): Card {
  return [...cards].sort((a, b) => {
    const at = a.suit === trump ? 1 : 0, bt = b.suit === trump ? 1 : 0;
    return at - bt || a.rank - b.rank;
  })[0];
}
function undefended(state: GameState) { return state.table.filter((x) => !x.defense); }
function allDefended(state: GameState) { return state.table.length > 0 && state.table.every((x) => x.defense); }

export function botDefendStep(state: GameState, bot: PlayerState): string {
  const pair = undefended(state)[0];
  if (!pair) return "";
  const beating = bot.hand.filter((c) => canBeat(pair.attack, c, state.trumpSuit));
  if (!beating.length) { resolveTake(state, bot.id); return `${bot.name} không đỡ được, lên bài, nhận cả bàn.`; }
  const card = lowestCard(beating, state.trumpSuit);
  defend(state, bot.id, pair.attack.id, card.id);
  return `${bot.name} đỡ ${cardLabel(pair.attack)} bằng ${cardLabel(card)}.`;
}
export function botAttackStep(state: GameState, bot: PlayerState): string {
  if (state.table.length === 0) {
    const card = lowestCard(bot.hand, state.trumpSuit);
    attack(state, bot.id, card.id); return `${bot.name} tấn ${cardLabel(card)}.`;
  }
  if (allDefended(state)) {
    const addable = bot.hand.filter((c) => canAttackCard(state, bot.id, c));
    if (addable.length) { const card = lowestCard(addable, state.trumpSuit); attack(state, bot.id, card.id); return `${bot.name} thêm ${cardLabel(card)}.`; }
    resolveFinishAttack(state, bot.id); return `${bot.name} kết thúc đợt.`;
  }
  return "";
}
export function botAdderStep(state: GameState, bot: PlayerState): string | null {
  const addable = bot.hand.filter((c) => canAttackCard(state, bot.id, c));
  if (!addable.length) return null;
  const card = lowestCard(addable, state.trumpSuit);
  attack(state, bot.id, card.id);
  return `${bot.name} thêm ${cardLabel(card)}.`;
}
export function parseCardId(id: string): Card { return parseCard(id); }
