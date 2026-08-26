import type { HexCoord } from '../board/HexCoord'
import { isTilePlaced } from '../board/HexMap'
import { hexDistance } from '../board/hexMath'
import type { GameState } from '../state/GameState'
import { activeShip, canAffordMove } from './fuel'

export function canMoveTo(state: GameState, target: HexCoord): boolean {
  if (state.movementSpent) return false
  if (!canAffordMove(state)) return false
  if (!isTilePlaced(state.board, target)) return false
  const ship = activeShip(state)
  if (ship.hull <= 0) return false
  return hexDistance(ship.coord, target) === 1
}
