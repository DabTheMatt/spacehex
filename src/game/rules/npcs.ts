import type { GameState, NpcShipState, ShipState } from '../state/GameState'
import type { HexCoord } from '../board/HexCoord'
import { coordKey } from '../board/HexCoord'
import { getNeighbor, hexDistance } from '../board/hexMath'
import { getPlacedTile, isTilePlaced } from '../board/HexMap'
import { SHIP_DEFINITIONS } from '../definitions/ships'
import { TILE_DEFINITIONS, getTileDefinition } from '../definitions/tiles'
import type { GameEvent } from '../engine/events'
import { resolveCombatExchange } from './combat'
import { resolveEntryHazards } from './sectorHazards'

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

export function livingPlayerShips(state: GameState): ShipState[] {
  return Object.values(state.ships).filter((ship) => ship.hull > 0)
}

export function nearestPlayerShip(state: GameState, from: HexCoord): ShipState | null {
  const living = livingPlayerShips(state)
  if (!living.length) return null
  return [...living].sort((a, b) => {
    const da = hexDistance(from, a.coord)
    const db = hexDistance(from, b.coord)
    if (da !== db) return da - db
    return a.id.localeCompare(b.id)
  })[0]
}

function blockedForNpc(state: GameState, coord: HexCoord): boolean {
  const tile = getPlacedTile(state.board, coord)
  if (!tile) return true
  return getTileDefinition(tile.definitionId).type === 'BLACK_HOLE'
}

/** One hex toward the nearest living player, only onto placed tiles. */
export function npcStepCoord(state: GameState, npc: NpcShipState): HexCoord | null {
  if (npc.hull <= 0) return null
  const prey = nearestPlayerShip(state, npc.coord)
  if (!prey) return null
  const here = hexDistance(npc.coord, prey.coord)
  if (here === 0) return null
  let best: HexCoord | null = null
  let bestDist = here
  let bestDir = 99
  for (let dir = 0; dir < 6; dir++) {
    const step = getNeighbor(npc.coord, dir)
    if (!isTilePlaced(state.board, step) || blockedForNpc(state, step)) continue
    const dist = hexDistance(step, prey.coord)
    if (dist >= here) continue
    if (dist > bestDist) continue
    if (dist === bestDist && dir > bestDir) continue
    best = step
    bestDist = dist
    bestDir = dir
  }
  return best
}

/**
 * End-of-cycle hunt: each living NPC steps once, then fights if stacked on a player.
 */
export function runNpcPhase(state: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  let next = state
  const ids = Object.keys(next.npcShips).sort()
  for (const id of ids) {
    const npc = next.npcShips[id]
    if (!npc || npc.hull <= 0) continue
    const dest = npcStepCoord(next, npc)
    if (!dest) continue
    const from = { ...npc.coord }
    next = {
      ...next,
      npcShips: { ...next.npcShips, [id]: { ...npc, coord: dest } },
    }
    const moved: GameEvent = { type: 'SHIP_MOVED', shipId: id, from, to: dest }
    events.push(moved)
    const hazard = resolveEntryHazards(next, id, dest)
    next = hazard.state
    events.push(...hazard.events)
  }
  for (const id of ids) {
    const npc = next.npcShips[id]
    if (!npc || npc.hull <= 0) continue
    const prey = livingPlayerShips(next)
      .filter((ship) => ship.coord.q === npc.coord.q && ship.coord.r === npc.coord.r)
      .sort((a, b) => a.id.localeCompare(b.id))[0]
    if (!prey) continue
    const fight = resolveCombatExchange(next, npc.id, prey.id)
    next = fight.state
    events.push(...fight.events)
  }
  return { state: next, events }
}
