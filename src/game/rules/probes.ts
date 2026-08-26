import { isTilePlaced } from '../board/HexMap'
import { getNeighbor } from '../board/hexMath'
import { coordKey } from '../board/HexCoord'
import type { HexCoord } from '../board/HexCoord'
import type { GameState, ProbeState } from '../state/GameState'
import { activeShip, canAffordExplore } from './fuel'

export type ProbeReject =
  | 'NOT_IN_MOVEMENT'
  | 'NO_PROBES'
  | 'WRECK'
  | 'ILLEGAL_HEX'
  | 'OCCUPIED'
  | 'NO_FUEL'
  | 'EMPTY_DECK'

export function probeAt(state: GameState, coord: HexCoord): ProbeState | undefined {
  return state.probes[coordKey(coord)]
}

export function canLaunchAnyProbe(state: GameState): boolean {
  for (let dir = 0; dir < 6; dir++) {
    if (canLaunchProbe(state, dir).ok) return true
  }
  return false
}

export function canLaunchProbe(
  state: GameState,
  direction: number,
): { ok: true; target: HexCoord } | { ok: false; reason: ProbeReject } {
  if (state.phase !== 'PLAYER_TURN' || state.movementSpent) {
    return { ok: false, reason: 'NOT_IN_MOVEMENT' }
  }
  const ship = activeShip(state)
  if (ship.hull <= 0) return { ok: false, reason: 'WRECK' }
  if ((ship.probes ?? 0) <= 0) return { ok: false, reason: 'NO_PROBES' }
  if (!canAffordExplore(state)) return { ok: false, reason: 'NO_FUEL' }
  if (state.explorationDeck.drawPile.length === 0) return { ok: false, reason: 'EMPTY_DECK' }
  const target = getNeighbor(ship.coord, direction)
  if (isTilePlaced(state.board, target)) return { ok: false, reason: 'OCCUPIED' }
  if (probeAt(state, target)) return { ok: false, reason: 'OCCUPIED' }
  if (direction < 0 || direction > 5) return { ok: false, reason: 'ILLEGAL_HEX' }
  return { ok: true, target }
}

export function shipPresentAt(state: GameState, coord: HexCoord): string | null {
  for (const ship of Object.values(state.ships)) {
    if (ship.coord.q === coord.q && ship.coord.r === coord.r) return ship.id
  }
  for (const npc of Object.values(state.npcShips)) {
    if (npc.coord.q === coord.q && npc.coord.r === coord.r) return npc.id
  }
  return null
}

export function dismissProbesUnderShips(state: GameState): {
  state: GameState
  events: Array<{ type: 'PROBE_DISMISSED'; coord: HexCoord; shipId: string }>
} {
  const events: Array<{ type: 'PROBE_DISMISSED'; coord: HexCoord; shipId: string }> = []
  let probes = state.probes
  for (const probe of Object.values(state.probes)) {
    const shipId = shipPresentAt(state, probe.coord)
    if (!shipId) continue
    const next = { ...probes }
    delete next[coordKey(probe.coord)]
    probes = next
    events.push({ type: 'PROBE_DISMISSED', coord: probe.coord, shipId })
  }
  if (events.length === 0) return { state, events }
  return { state: { ...state, probes }, events }
}
