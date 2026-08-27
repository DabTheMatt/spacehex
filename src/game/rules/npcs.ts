import type { GameState, NpcShipState, ShipState } from '../state/GameState'
import type { HexCoord } from '../board/HexCoord'
import { coordKey } from '../board/HexCoord'
import { getNeighbor } from '../board/hexMath'
import { getPlacedTile, isTilePlaced } from '../board/HexMap'
import { worldDirectionForFace } from '../board/edgeNumbers'
import { SHIP_DEFINITIONS } from '../definitions/ships'
import { TILE_DEFINITIONS, getTileDefinition } from '../definitions/tiles'
import { RNG } from '../random/RNG'
import type { GameEvent } from '../engine/events'
import { resolveCombatExchange } from './combat'
import { resolveEntryHazards } from './sectorHazards'
import { canTraverse } from './passage'

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

export function rollNpcFace(state: GameState, npcId: string): number {
  return (
    new RNG(`${state.seed}:npc-face:${state.round}:${state.activePlayerId}:${npcId}:${state.log.length}`).nextInt(
      6,
    ) + 1
  )
}

export function npcStepByFace(state: GameState, npc: NpcShipState, face: number): HexCoord | null {
  if (npc.hull <= 0) return null
  const tile = getPlacedTile(state.board, npc.coord)
  if (!tile) return null
  const dir = worldDirectionForFace(tile.edgeNumbers, tile.rotation, face)
  if (dir === null) return null
  const dest = getNeighbor(npc.coord, dir)
  if (!isTilePlaced(state.board, dest)) return null
  const destTile = getPlacedTile(state.board, dest)
  if (!destTile) return null
  if (getTileDefinition(destTile.definitionId).type === 'BLACK_HOLE') return null
  if (!canTraverse(state, npc.coord, dest)) return null
  return dest
}

/**
 * Start of the active player's action phase: each living NPC rolls a face and steps that edge.
 */
export function runNpcPhase(state: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  let next = state
  const ids = Object.keys(next.npcShips).sort()
  for (const id of ids) {
    const npc = next.npcShips[id]
    if (!npc || npc.hull <= 0) continue
    const face = rollNpcFace(next, id)
    const dest = npcStepByFace(next, npc, face)
    events.push({ type: 'NPC_FACE_ROLLED', shipId: id, face })
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
