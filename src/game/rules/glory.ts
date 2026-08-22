import type { GameState } from '../state/GameState'
import type { GameEvent } from '../engine/events'
import type { HexCoord } from '../board/HexCoord'
import type { TileType } from '../board/tileRotation'
import type { ShipClass } from '../definitions/ships'
import { getTileDefinition } from '../definitions/tiles'
import { hexDistance } from '../board/hexMath'
import { activePlayer } from './fuel'

const EVA = { q: 0, r: 0 }

export const GLORY_VOID = 1
export const GLORY_FEATURE = 2
export const GLORY_PLANET = 3
export const GLORY_DAMAGE = 3

export const GLORY_DESTROY: Record<ShipClass, number> = {
  MEWA: 5,
  DRZAZGA: 5,
  CIERN: 12,
}

export function discoveryGlory(type: TileType, coord: HexCoord): number {
  if (type === 'PLANET_LARGE' || type === 'PLANET_MEDIUM' || type === 'PLANET_SMALL') {
    return GLORY_PLANET + hexDistance(coord, EVA)
  }
  if (type === 'VOID') return GLORY_VOID
  return GLORY_FEATURE
}

export function resolveDiscovery(
  state: GameState,
  tileId: string,
  coord: HexCoord,
): { state: GameState; events: GameEvent[] } {
  const def = getTileDefinition(tileId)
  const player = activePlayer(state)
  const delta = discoveryGlory(def.type, coord)
  const next = addGlory(state, player.id, delta)
  const events: GameEvent[] = [
    {
      type: 'SECTOR_RESOLVED',
      tileId,
      note: `${def.label}: +${delta} GLORY`,
    },
    {
      type: 'GLORY_CHANGED',
      playerId: player.id,
      glory: next.players[player.id].glory,
      delta,
    },
  ]
  return { state: next, events }
}

export function addGlory(state: GameState, playerId: string, amount: number): GameState {
  if (!amount) return state
  const player = state.players[playerId]
  if (!player) return state
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, glory: player.glory + amount },
    },
  }
}
