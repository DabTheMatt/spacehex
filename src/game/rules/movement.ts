import type { HexCoord } from '../board/HexCoord'
import { isTilePlaced } from '../board/HexMap'
import { hexDistance } from '../board/hexMath'
import type { GameState } from '../state/GameState'
import { activeShip, canAffordMove } from './fuel'

import { canTraverse } from './passage'

export function canMoveTo(state: GameState, target: HexCoord): boolean {
  if (state.movementSpent) return false
  if (!canAffordMove(state)) return false
  if (!isTilePlaced(state.board, target)) return false
  const ship = activeShip(state)
  if (ship.hull <= 0) return false
  if (hexDistance(ship.coord, target) !== 1) return false
  return canTraverse(state, ship.coord, target)
}
