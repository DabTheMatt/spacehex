import type { GameState } from '../state/GameState'
import type { HexCoord } from '../board/HexCoord'
import { coordKey } from '../board/HexCoord'
import { getNeighbor } from '../board/hexMath'
import { getPlacedTile, isTilePlaced } from '../board/HexMap'
import { worldDirectionForFace } from '../board/edgeNumbers'
import { asteroidCollisionPercent, asteroidEdgeCount, getTileDefinition } from '../definitions/tiles'
import { RNG } from '../random/RNG'
import type { GameEvent } from '../engine/events'
import { applyHullDamage } from './damage'
import { canTraverse } from './passage'

export function rollAsteroidCollision(
  seed: string,
  coord: HexCoord,
  shipId: string,
  nonce: number,
  asteroidEdges: number,
): boolean {
  return new RNG(`${seed}:asteroid-hit:${coordKey(coord)}:${shipId}:${nonce}`).nextInt(6) < asteroidEdges
}

function setShipCoord(state: GameState, shipId: string, coord: HexCoord): GameState {
  const ship = state.ships[shipId]
  if (ship) {
    return { ...state, ships: { ...state.ships, [shipId]: { ...ship, coord } } }
  }
  const npc = state.npcShips[shipId]
  if (!npc) return state
  return { ...state, npcShips: { ...state.npcShips, [shipId]: { ...npc, coord } } }
}

function resolveAsteroid(
  state: GameState,
  shipId: string,
  coord: HexCoord,
  tileId: string,
): { state: GameState; events: GameEvent[] } {
  const def = getTileDefinition(tileId)
  const edges = asteroidEdgeCount(def.edges)
  const hit = rollAsteroidCollision(state.seed, coord, shipId, state.log.length, edges)
  if (!hit) {
    return {
      state,
      events: [{ type: 'ASTEROID_STRIKE', shipId, coord: { ...coord }, damage: 0 }],
    }
  }
  const damage = 1
  const strike: GameEvent = { type: 'ASTEROID_STRIKE', shipId, coord: { ...coord }, damage }
  const applied = applyHullDamage(state, shipId, damage, { emitDamaged: false })
  return { state: applied.state, events: [strike, ...applied.events] }
}

function resolveVortex(
  state: GameState,
  shipId: string,
  coord: HexCoord,
): { state: GameState; events: GameEvent[] } {
  const tile = getPlacedTile(state.board, coord)
  if (!tile) return { state, events: [] }
  const face = new RNG(`${state.seed}:vortex:${coordKey(coord)}:${shipId}:${state.log.length}`).nextInt(6) + 1
  const dir = worldDirectionForFace(tile.edgeNumbers, tile.rotation, face)
  const events: GameEvent[] = [{ type: 'VORTEX_ROLL', shipId, face, coord: { ...coord } }]
  if (dir === null) return { state, events }
  const dest = getNeighbor(coord, dir)
  if (!isTilePlaced(state.board, dest) || !canTraverse(state, coord, dest)) {
    return { state, events }
  }
  const destTile = getPlacedTile(state.board, dest)
  if (!destTile || getTileDefinition(destTile.definitionId).type === 'BLACK_HOLE') {
    return { state, events }
  }
  let next = setShipCoord(state, shipId, dest)
  events.push({ type: 'SHIP_MOVED', shipId, from: coord, to: dest })
  if (getTileDefinition(destTile.definitionId).type === 'ASTEROID') {
    const rock = resolveAsteroid(next, shipId, dest, destTile.definitionId)
    next = rock.state
    events.push(...rock.events)
  }
  return { state: next, events }
}

export function resolveEntryHazards(
  state: GameState,
  shipId: string,
  coord: HexCoord,
): { state: GameState; events: GameEvent[] } {
  const tile = getPlacedTile(state.board, coord)
  if (!tile) return { state, events: [] }
  const type = getTileDefinition(tile.definitionId).type
  if (type === 'ASTEROID') return resolveAsteroid(state, shipId, coord, tile.definitionId)
  if (type === 'VORTEX') return resolveVortex(state, shipId, coord)
  return { state, events: [] }
}

export { asteroidCollisionPercent }
