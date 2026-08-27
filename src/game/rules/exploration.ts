import { isTilePlaced } from '../board/HexMap'
import { getNeighbor } from '../board/hexMath'
import type { GameState } from '../state/GameState'
import { activeShip, canAffordExplore } from './fuel'

import { canLeaveDirection } from './passage'

export function canExploreDirection(state: GameState, direction: number): boolean {
  if (state.movementSpent) return false
  if (!canAffordExplore(state)) return false
  const ship = activeShip(state)
  if (ship.hull <= 0) return false
  if (!canLeaveDirection(state, ship.coord, direction)) return false
  const target = getNeighbor(ship.coord, direction)
  return !isTilePlaced(state.board, target)
}
