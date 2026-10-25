// Client WebSocket cho chơi với người thật + cấu hình API.
// API_BASE: VITE_API_BASE nếu build có set, không thì backend Render đã live.
export const API_BASE = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE || "https://tanloccyper-api.onrender.com";
export const WS_URL = API_BASE.replace(/^http/, "ws") + "/ws";
export function viewToGame(view: Record<string, unknown>, myEngineId: string): Record<string, unknown> {
  // publicView của server -> GameState mà App đã vẽ được (tay người khác chỉ là lá úp dummy, không bao giờ là bài thật).
  const players = (view.players as { id: string; name: string; cardCount: number; finished: boolean }[]).map((p) => ({
    id: p.id,
    name: p.name,
    finished: p.finished,
    hand: p.id === myEngineId
      ? (view.myHand as string[]).map((id) => { const [suit, r] = id.split("-"); return { id, suit, rank: Number(r) }; })
      : Array.from({ length: p.cardCount }, (_, i) => ({ id: `back-${p.id}-${i}`, suit: "S", rank: 2 })),
  }));
  const table = (view.table as { attack: string; defense: string | null }[]).map((x) => {
    const pa = (id: string) => { const [suit, r] = id.split("-"); return { id, suit, rank: Number(r) }; };
    return { attack: pa(x.attack), defense: x.defense ? pa(x.defense) : null };
  });
  return {
    version: view.version, phase: view.phase, ruleSet: view.ruleSet,
    players, table,
    drawPile: Array.from({ length: Number(view.drawPileCount || 0) }, (_, i) => ({ id: `pile-${i}`, suit: "S", rank: 2 })),
    discardPile: Array.from({ length: Number(view.discardPileCount || 0) }, (_, i) => ({ id: `discard-${i}`, suit: "S", rank: 2 })),
    trumpSuit: view.trumpSuit, trumpCardId: view.trumpCardId,
    attackerId: view.attackerId, defenderId: view.defenderId,
    defenderInitialHandCount: 8, maxAttackCards: 6, handSize: 8, allowTransfer: false,
    finishOrder: view.finishOrder, loserId: view.loserId, result: view.result,
    pendingDraw: view.pendingDraw,
  };
}
