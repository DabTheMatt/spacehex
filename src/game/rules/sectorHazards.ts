import type { GameState } from '../state/GameState'
import type { HexCoord } from '../board/HexCoord'
import { coordKey } from '../board/HexCoord'
import { getNeighbor } from '../board/hexMath'
import { getPlacedTile, isTilePlaced } from '../board/HexMap'
import type { PlacedTile } from '../board/Tile'
import { worldDirectionForFace, rollEdgeNumbers } from '../board/edgeNumbers'
import { asteroidCollisionPercent, asteroidEdgeCount, getTileDefinition } from '../definitions/tiles'
import { RNG } from '../random/RNG'
import type { GameEvent } from '../engine/events'
import { drawFromDeck } from '../board/TileDeck'
import { rollSectorName } from '../definitions/sectorNames'
import { applyHullDamage } from './damage'
import { canLeaveDirection, canTraverse } from './passage'
import { resolveDiscovery } from './glory'
import { stockPlanetIfNeeded } from './planetMarket'
import { spawnThornsForPlacedTile } from './npcs'
import { straitRotationForEntry } from './strait'

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

function shipPlayerId(state: GameState, shipId: string): string | null {
  return state.ships[shipId]?.playerId ?? null
}

/** Living hulls on `coord` that are not `shipId` (other players and NPCs). */
export function hostileAt(state: GameState, coord: HexCoord, shipId: string): boolean {
  const myPlayer = shipPlayerId(state, shipId)
  for (const ship of Object.values(state.ships)) {
    if (ship.id === shipId || ship.hull <= 0) continue
    if (ship.coord.q !== coord.q || ship.coord.r !== coord.r) continue
    if (myPlayer && ship.playerId === myPlayer) continue
    return true
  }
  return Object.values(state.npcShips).some(
    (npc) => npc.id !== shipId && npc.hull > 0 && npc.coord.q === coord.q && npc.coord.r === coord.r,
  )
}

function destTileType(state: GameState, coord: HexCoord): string | null {
  const tile = getPlacedTile(state.board, coord)
  if (!tile) return null
  return getTileDefinition(tile.definitionId).type
}

function vortexDestOk(
  state: GameState,
  from: HexCoord,
  dest: HexCoord,
  shipId: string,
  allowEmpty: boolean,
): boolean {
  if (hostileAt(state, dest, shipId)) return false
  if (destTileType(state, dest) === 'BLACK_HOLE') return false
  if (!isTilePlaced(state.board, dest)) return allowEmpty && state.explorationDeck.drawPile.length > 0
  if (!canLeaveDirection(state, from, destDir(from, dest)!)) return false
  return canTraverse(state, from, dest)
}

function destDir(from: HexCoord, dest: HexCoord): number | null {
  for (let d = 0; d < 6; d++) {
    const n = getNeighbor(from, d)
    if (n.q === dest.q && n.r === dest.r) return d
  }
  return null
}

export function pickVortexDestination(
  state: GameState,
  shipId: string,
  coord: HexCoord,
  rolledFace: number,
): { face: number; dest: HexCoord } | null {
  const tile = getPlacedTile(state.board, coord)
  if (!tile) return null
  const player = Boolean(shipPlayerId(state, shipId))
  const tryFace = (allowEmpty: boolean, requirePlaced: boolean): { face: number; dest: HexCoord } | null => {
    for (let offset = 0; offset < 6; offset++) {
      const face = ((rolledFace - 1 + offset) % 6) + 1
      const dir = worldDirectionForFace(tile.edgeNumbers, tile.rotation, face)
      if (dir === null) continue
      const dest = getNeighbor(coord, dir)
      const placed = isTilePlaced(state.board, dest)
      if (requirePlaced && !placed) continue
      if (!requirePlaced && placed) continue
      if (vortexDestOk(state, coord, dest, shipId, allowEmpty)) return { face, dest }
    }
    return null
  }
  return tryFace(false, true) ?? (player ? tryFace(true, false) : null)
}

function placeVortexDiscovery(
  state: GameState,
  dest: HexCoord,
  from: HexCoord,
  playerId: string,
): { state: GameState; events: GameEvent[]; placed: PlacedTile } | null {
  const drawn = drawFromDeck(state.explorationDeck)
  if (!drawn) return null
  const dir = destDir(from, dest) ?? 0
  const rotation = straitRotationForEntry(state, drawn.tileId, dest, dir)
  const definition = getTileDefinition(drawn.tileId)
  const placed: PlacedTile = {
    id: drawn.tileId,
    definitionId: drawn.tileId,
    coord: { ...dest },
    rotation,
    discoveredByPlayerId: playerId,
    discoveredRound: state.round,
    designation: rollSectorName(state.seed, drawn.tileId, definition.type, playerId),
    edgeNumbers: rollEdgeNumbers(state.seed, drawn.tileId, coordKey(dest)),
  }
  const events: GameEvent[] = [
    { type: 'TILE_DRAWN', tileId: placed.id },
    { type: 'TILE_PLACED', tileId: placed.id, coord: placed.coord },
    { type: 'HEX_DISCOVERED', tileId: placed.id, playerId },
  ]
  let next: GameState = {
    ...state,
    board: { tiles: { ...state.board.tiles, [coordKey(dest)]: placed } },
    explorationDeck: drawn.deck,
  }
  const spawn = spawnThornsForPlacedTile(next, placed.id, dest)
  next = spawn.state
  if (spawn.spawned) {
    events.push({
      type: 'NPC_SPAWNED',
      shipId: spawn.spawned.id,
      class: spawn.spawned.class,
      coord: { ...dest },
    })
  }
  const beforeMarket = next
  next = stockPlanetIfNeeded(next, placed.id, dest)
  if (next.planetMarkets[coordKey(dest)] && !beforeMarket.planetMarkets[coordKey(dest)]) {
    events.push({ type: 'PLANET_STOCKED', tileId: placed.id, coord: dest })
  }
  const discovered = resolveDiscovery(next, placed.id, dest, playerId)
  next = discovered.state
  events.push(...discovered.events)
  return { state: next, events, placed }
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
  const rolled =
    new RNG(`${state.seed}:vortex:${coordKey(coord)}:${shipId}:${state.log.length}`).nextInt(6) + 1
  let pick = pickVortexDestination(state, shipId, coord, rolled)
  const events: GameEvent[] = [
    {
      type: 'VORTEX_ROLL',
      shipId,
      face: pick?.face ?? rolled,
      coord: { ...coord },
      dest: pick ? { ...pick.dest } : { ...coord },
    },
  ]
  if (!pick || (pick.dest.q === coord.q && pick.dest.r === coord.r)) {
    return { state, events }
  }
  let next = state
  if (!isTilePlaced(next.board, pick.dest)) {
    const playerId = shipPlayerId(next, shipId)
    if (!playerId) return { state, events }
    const placed = placeVortexDiscovery(next, pick.dest, coord, playerId)
    if (!placed) return { state, events }
    next = placed.state
    events.push(...placed.events)
    if (getTileDefinition(placed.placed.definitionId).type === 'BLACK_HOLE') {
      const retry = pickVortexDestination(next, shipId, coord, pick.face)
      if (!retry || (retry.dest.q === pick.dest.q && retry.dest.r === pick.dest.r)) {
        return { state: next, events }
      }
      pick = retry
      const roll = events[0]
      if (roll && roll.type === 'VORTEX_ROLL') {
        roll.face = pick.face
        roll.dest = { ...pick.dest }
      }
      if (!isTilePlaced(next.board, pick.dest)) {
        const again = placeVortexDiscovery(next, pick.dest, coord, playerId)
        if (!again) return { state: next, events }
        next = again.state
        events.push(...again.events)
        if (getTileDefinition(again.placed.definitionId).type === 'BLACK_HOLE') {
          return { state: next, events }
        }
      }
    }
  }

  next = setShipCoord(next, shipId, pick.dest)
  events.push({ type: 'SHIP_MOVED', shipId, from: coord, to: pick.dest })
  const destTile = getPlacedTile(next.board, pick.dest)
  if (destTile && getTileDefinition(destTile.definitionId).type === 'ASTEROID') {
    const rock = resolveAsteroid(next, shipId, pick.dest, destTile.definitionId)
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
