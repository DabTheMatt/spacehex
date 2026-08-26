import type { GameState, NpcShipState } from '../state/GameState'
import type { HexCoord } from '../board/HexCoord'
import { coordKey } from '../board/HexCoord'
import { SHIP_DEFINITIONS } from '../definitions/ships'
import { TILE_DEFINITIONS } from '../definitions/tiles'

export function npcPresentAt(state: GameState, coord: HexCoord): boolean {
  return Object.values(state.npcShips).some(
    (s) => s.coord.q === coord.q && s.coord.r === coord.r && s.hull > 0,
  )
}

export function livingNpcAt(state: GameState, coord: HexCoord): NpcShipState | undefined {
  return Object.values(state.npcShips).find(
    (s) => s.coord.q === coord.q && s.coord.r === coord.r && s.hull > 0,
  )
}

/**
 * TODO RULE CLARIFICATION T12 — one Thorn on Shadow Base when that tile is placed.
 * Spawn numbers/timing for Splinters are still unspecified; not invented here.
 */
export function spawnThornsForPlacedTile(
  state: GameState,
  tileId: string,
  coord: HexCoord,
): { state: GameState; spawned: NpcShipState | null } {
  const def = TILE_DEFINITIONS[tileId]
  if (def?.type !== 'SHADOW_BASE') return { state, spawned: null }
  const id = `ciern-${coordKey(coord)}`
  if (state.npcShips[id]) return { state, spawned: null }

  const hull = SHIP_DEFINITIONS.CIERN.hull
  const spawned: NpcShipState = {
    id,
    class: 'CIERN',
    coord: { ...coord },
    hull,
    maxHull: hull,
  }
  return {
    state: {
      ...state,
      npcShips: { ...state.npcShips, [id]: spawned },
    },
    spawned,
  }
}
