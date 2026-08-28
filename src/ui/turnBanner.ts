import type { GameState } from '@/game/state/GameState'
import { activeShip, isRefuelHex } from '@/game/rules/fuel'
import { availableActions } from '@/ui/availableActions'

export type TurnBannerKind = 'TANKING' | 'MOVEMENT' | 'ACTION' | 'END_TURN'

const KIND_LABEL: Record<TurnBannerKind, string> = {
  TANKING: 'TANKING PHASE',
  MOVEMENT: 'MOVEMENT PHASE',
  ACTION: 'ACTION PHASE',
  END_TURN: 'END TURN',
}

export function turnBannerKind(state: GameState): TurnBannerKind {
  if (state.phase === 'TILE_PLACEMENT') return 'MOVEMENT'
  if (!state.movementSpent) {
    const ship = activeShip(state)
    if (ship.hull > 0 && isRefuelHex(state, ship.coord)) return 'TANKING'
    return 'MOVEMENT'
  }
  const actions = availableActions(state)
  if (actions.ATTACK || actions.BUY || actions.SELL || actions.REFUEL) return 'ACTION'
  return 'END_TURN'
}

export function turnBannerText(state: GameState): string {
  const n = state.activePlayerId.replace(/\D/g, '') || '1'
  return `PLAYER ${n} · ${KIND_LABEL[turnBannerKind(state)]}`
}
