import type { GameState } from '../state/GameState'
import type { GameEvent } from '../engine/events'
import { emptyCargo, RESOURCE_IDS } from '../definitions/resources'
import { CARGO_KINDS, type CargoKind } from '../definitions/cargoFigures'
import { coordKey } from '../board/HexCoord'
import { RNG } from '../random/RNG'

export function applyHullDamage(
  state: GameState,
  shipId: string,
  amount: number,
  options: { emitDamaged?: boolean } = {},
): { state: GameState; events: GameEvent[]; hullAfter: number; destroyed: boolean } {
  const playerShip = state.ships[shipId]
  const npcShip = state.npcShips[shipId]
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
  let next = playerShip
    ? {
        ...state,
        ships: { ...state.ships, [shipId]: { ...playerShip, hull: hullAfter } },
      }
    : {
        ...state,
        npcShips: { ...state.npcShips, [shipId]: { ...npcShip!, hull: hullAfter } },
      }
  if (destroyed) {
    const spill = spillDestroyedHold(next, shipId)
    next = spill.state
    events.push(...spill.events)
  }
  return { state: next, events, hullAfter, destroyed }
}

/** Dump hold contents as drifting debris on the wreck hex. */
export function spillDestroyedHold(
  state: GameState,
  shipId: string,
): { state: GameState; events: GameEvent[] } {
  const playerShip = state.ships[shipId]
  const npcShip = state.npcShips[shipId]
  const ship = playerShip ?? npcShip
  if (!ship) return { state, events: [] }
  const kinds: CargoKind[] = []
  if (playerShip) {
    for (const id of RESOURCE_IDS) {
      const qty = playerShip.cargo[id] ?? 0
      for (let i = 0; i < qty; i++) kinds.push(id)
    }
  } else {
    const rng = new RNG(`${state.seed}:spill:${shipId}:${coordKey(ship.coord)}`)
    const count = 1 + rng.nextInt(2)
    for (let i = 0; i < count; i++) kinds.push(CARGO_KINDS[rng.nextInt(CARGO_KINDS.length)])
  }
  const debris = [
    ...state.debris,
    ...kinds.map((kind, index) => ({
      id: `${shipId}-crate-${state.debris.length + index}`,
      kind,
      coord: { ...ship.coord },
    })),
  ]
  const next = playerShip
    ? {
        ...state,
        debris,
        ships: { ...state.ships, [shipId]: { ...playerShip, cargo: emptyCargo() } },
      }
    : { ...state, debris }
  return {
    state: next,
    events: [{ type: 'SHIP_DESTROYED', shipId, coord: { ...ship.coord }, cargo: kinds }],
  }
}
