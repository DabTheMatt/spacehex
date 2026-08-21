import type { GameState } from '../state/GameState'
import type { GameEvent } from '../engine/events'
import { getTileDefinition } from '../definitions/tiles'

/** TODO RULE CLARIFICATION T7 — sektory logują obecność; bez wymyślonych efektów. */
export function resolveSector(_state: GameState, tileId: string): GameEvent {
  const def = getTileDefinition(tileId)
  return {
    type: 'SECTOR_RESOLVED',
    tileId,
    note: `TODO RULE CLARIFICATION T7: efekt sektora ${def.type} (${def.label}) nie jest jeszcze zdefiniowany.`,
  }
}

export function addGlory(state: GameState, playerId: string, amount: number): GameState {
  const player = state.players[playerId]
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, glory: player.glory + amount },
    },
  }
}
