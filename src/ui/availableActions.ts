import type { GameState } from '@/game/state/GameState'
import { cargoUsed, MAX_BUYS_PER_TURN } from '@/game/definitions/resources'
import { FUEL_BUY_PRICE, FUEL_TANK } from '@/game/definitions/constants'
import { canExploreDirection } from '@/game/rules/exploration'
import { canMoveTo } from '@/game/rules/movement'
import { canLaunchAnyProbe } from '@/game/rules/probes'
import { canDeclareAttack } from '@/game/rules/combat'
import { buyPrice, isEvaHex } from '@/game/rules/planetMarket'
import { activePlayer, activeShip } from '@/game/rules/fuel'
import { getNeighbor } from '@/game/board/hexMath'
import { coordKey } from '@/game/board/HexCoord'

export const ACTION_IDS = [
  'EXPLORE',
  'MOVE',
  'STAY',
  'PROBE',
  'ATTACK',
  'BUY',
  'SELL',
  'REFUEL',
] as const

export type ActionId = (typeof ACTION_IDS)[number]

export function canExploreAny(state: GameState): boolean {
  for (let dir = 0; dir < 6; dir++) {
    if (canExploreDirection(state, dir)) return true
  }
  return false
}

export function canMoveAny(state: GameState): boolean {
  const origin = activeShip(state).coord
  for (let dir = 0; dir < 6; dir++) {
    if (canMoveTo(state, getNeighbor(origin, dir))) return true
  }
  return false
}

export function canStay(state: GameState): boolean {
  return state.phase === 'PLAYER_TURN' && !state.movementSpent && activeShip(state).hull > 0
}

export function canAttackAny(state: GameState): boolean {
  for (const ship of Object.values(state.ships)) {
    if (canDeclareAttack(state, ship.id).ok) return true
  }
  for (const npc of Object.values(state.npcShips)) {
    if (canDeclareAttack(state, npc.id).ok) return true
  }
  return false
}

export function canBuyAny(state: GameState): boolean {
  if (state.phase !== 'PLAYER_TURN') return false
  const ship = activeShip(state)
  if (ship.hull <= 0) return false
  const market = state.planetMarkets[coordKey(ship.coord)]
  if (!market) return false
  const player = activePlayer(state)
  if ((player.buysThisTurn ?? 0) >= MAX_BUYS_PER_TURN) return false
  return market.lots.some((lot) => lot.amount > 0 && player.credits >= buyPrice(state, lot.id))
}

export function canSellAny(state: GameState): boolean {
  if (state.phase !== 'PLAYER_TURN') return false
  const ship = activeShip(state)
  if (ship.hull <= 0) return false
  if (!isEvaHex(ship.coord)) return false
  return cargoUsed(ship.cargo) > 0
}

export function canRefuel(state: GameState): boolean {
  if (state.phase !== 'PLAYER_TURN') return false
  const ship = activeShip(state)
  if (ship.hull <= 0) return false
  if (!state.planetMarkets[coordKey(ship.coord)]) return false
  const player = activePlayer(state)
  if (player.fuel >= FUEL_TANK) return false
  return player.credits >= FUEL_BUY_PRICE
}

export function availableActions(state: GameState): Record<ActionId, boolean> {
  return {
    EXPLORE: canExploreAny(state),
    MOVE: canMoveAny(state),
    STAY: canStay(state),
    PROBE: canLaunchAnyProbe(state),
    ATTACK: canAttackAny(state),
    BUY: canBuyAny(state),
    SELL: canSellAny(state),
    REFUEL: canRefuel(state),
  }
}
