import type { HexCoord } from '../board/HexCoord'
import { directionFromTo } from '../board/hexMath'
import { getPlacedTile, oppositeDirection } from '../board/HexMap'
import { getRotatedEdge, type EdgeType } from '../board/tileRotation'
import { getTileDefinition } from '../definitions/tiles'
import type { GameState } from '../state/GameState'

export function isPassableEdge(type: EdgeType): boolean {
  return type !== 'BLOCKED'
}

export function leavingEdge(state: GameState, from: HexCoord, direction: number): EdgeType | null {
  const tile = getPlacedTile(state.board, from)
  if (!tile) return null
  return getRotatedEdge(getTileDefinition(tile.definitionId), direction, tile.rotation)
}

export function canLeaveDirection(state: GameState, from: HexCoord, direction: number): boolean {
  const edge = leavingEdge(state, from, direction)
  return edge !== null && isPassableEdge(edge)
}

export function canTraverse(state: GameState, from: HexCoord, to: HexCoord): boolean {
  const dir = directionFromTo(from, to)
  if (dir === null) return false
  const origin = getPlacedTile(state.board, from)
  const dest = getPlacedTile(state.board, to)
  if (!origin || !dest) return false
  const leave = getRotatedEdge(getTileDefinition(origin.definitionId), dir, origin.rotation)
  const enter = getRotatedEdge(
    getTileDefinition(dest.definitionId),
    oppositeDirection(dir),
    dest.rotation,
  )
  return isPassableEdge(leave) && isPassableEdge(enter)
}
