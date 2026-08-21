import type { GameState } from '../state/GameState'
import { COMBAT_DAMAGE } from '../definitions/constants'
import type { HexCoord } from '../board/HexCoord'
import type { GameEvent } from '../engine/events'
import type { ShipState } from '../state/GameState'

export function shipsAt(state: GameState, coord: HexCoord): ShipState[] {
  return Object.values(state.ships).filter(
    (s) => s.coord.q === coord.q && s.coord.r === coord.r,
  )
}

/** TODO RULE CLARIFICATION T5 — wejście na pole z wrogim statkiem: 1 obrażenie. */
export function resolveCombatOnEntry(
  state: GameState,
  attackerId: string,
  coord: HexCoord,
): { state: GameState; events: GameEvent[] } {
  const others = shipsAt(state, coord).filter((s) => s.id !== attackerId)
  if (others.length === 0) {
    return { state, events: [] }
  }
  const events: GameEvent[] = []
  let ships = { ...state.ships }
  const attacker = ships[attackerId]
  for (const defender of others) {
    ships = {
      ...ships,
      [defender.id]: {
        ...defender,
        hull: Math.max(0, defender.hull - COMBAT_DAMAGE),
      },
      [attacker.id]: {
        ...ships[attacker.id],
        hull: Math.max(0, ships[attacker.id].hull - COMBAT_DAMAGE),
      },
    }
    events.push({
      type: 'COMBAT_RESOLVED',
      attackerId,
      defenderId: defender.id,
      damage: COMBAT_DAMAGE,
    })
  }
  return { state: { ...state, ships }, events }
}
