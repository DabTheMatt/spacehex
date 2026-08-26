import type { GameState, NpcShipState, ShipState } from '../state/GameState'
import type { GameEvent } from '../engine/events'

export function applyHullDamage(
  state: GameState,
  shipId: string,
  amount: number,
  options: { emitDamaged?: boolean } = {},
): { state: GameState; events: GameEvent[]; hullAfter: number; destroyed: boolean } {
  const playerShip: ShipState | undefined = state.ships[shipId]
  const npcShip: NpcShipState | undefined = state.npcShips[shipId]
  const ship = playerShip ?? npcShip
  if (!ship || amount <= 0) {
    return { state, events: [], hullAfter: ship?.hull ?? 0, destroyed: false }
  }
  const hullAfter = Math.max(0, ship.hull - amount)
  const applied = ship.hull - hullAfter
  const destroyed = ship.hull > 0 && hullAfter === 0
  const events: GameEvent[] = []
  if (options.emitDamaged !== false) {
    events.push({ type: 'SHIP_DAMAGED', shipId, damage: applied, hullAfter })
  }
  if (destroyed) events.push({ type: 'SHIP_DESTROYED', shipId })
  const next = playerShip
    ? {
        ...state,
        ships: { ...state.ships, [shipId]: { ...playerShip, hull: hullAfter } },
      }
    : {
        ...state,
        npcShips: { ...state.npcShips, [shipId]: { ...npcShip!, hull: hullAfter } },
      }
  return { state: next, events, hullAfter, destroyed }
}
