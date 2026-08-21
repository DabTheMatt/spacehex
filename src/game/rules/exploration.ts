import { isTilePlaced } from '../board/HexMap'
import { getNeighbor } from '../board/hexMath'
import type { GameState } from '../state/GameState'
import { activeShip, canAffordExplore } from './fuel'

export function canExploreDirection(state: GameState, direction: number): boolean {
  if (state.movementSpent) return false
  if (!canAffordExplore(state)) return false
  const ship = activeShip(state)
  const target = getNeighbor(ship.coord, direction)
  return !isTilePlaced(state.board, target)
}
