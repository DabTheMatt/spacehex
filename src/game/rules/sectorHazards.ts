import type { GameState } from '../state/GameState'
import type { HexCoord } from '../board/HexCoord'
import { coordKey } from '../board/HexCoord'
import { getPlacedTile } from '../board/HexMap'
import { getTileDefinition } from '../definitions/tiles'
import { RNG } from '../random/RNG'
import type { GameEvent } from '../engine/events'
import { applyHullDamage } from './damage'

/** TODO RULE CLARIFICATION T7 — Maciej: 0–2 damage on asteroid entry. */
export const ASTEROID_DAMAGE_FACES = 3

export function rollAsteroidDamage(
  seed: string,
  coord: HexCoord,
  shipId: string,
  nonce: number,
): number {
  return new RNG(`${seed}:asteroid:${coordKey(coord)}:${shipId}:${nonce}`).nextInt(ASTEROID_DAMAGE_FACES)
}

export function resolveEntryHazards(
  state: GameState,
  shipId: string,
  coord: HexCoord,
): { state: GameState; events: GameEvent[] } {
  const tile = getPlacedTile(state.board, coord)
  if (!tile) return { state, events: [] }
  const type = getTileDefinition(tile.definitionId).type
  if (type !== 'ASTEROID') return { state, events: [] }
  const damage = rollAsteroidDamage(state.seed, coord, shipId, state.log.length)
  const strike: GameEvent = { type: 'ASTEROID_STRIKE', shipId, coord: { ...coord }, damage }
  if (damage <= 0) return { state, events: [strike] }
  const hit = applyHullDamage(state, shipId, damage, { emitDamaged: false })
  return { state: hit.state, events: [strike, ...hit.events] }
}
