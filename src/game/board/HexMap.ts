import type { HexCoord } from './HexCoord'
import { coordKey } from './HexCoord'
import { getNeighbor, getNeighbors } from './hexMath'
import type { PlacedTile } from './Tile'
import type { EdgeType, TileDefinition } from './tileRotation'
import { getRotatedEdge } from './tileRotation'

export interface BoardState {
  tiles: Record<string, PlacedTile>
}

export function emptyBoard(): BoardState {
  return { tiles: {} }
}

export function isTilePlaced(board: BoardState, coord: HexCoord): boolean {
  return coordKey(coord) in board.tiles
}

export function getPlacedTile(board: BoardState, coord: HexCoord): PlacedTile | undefined {
  return board.tiles[coordKey(coord)]
}

export function getEmptyNeighborCoords(board: BoardState, coord: HexCoord): HexCoord[] {
  return getNeighbors(coord).filter((n) => !isTilePlaced(board, n))
}

export function getOccupiedNeighborCoords(board: BoardState, coord: HexCoord): HexCoord[] {
  return getNeighbors(coord).filter((n) => isTilePlaced(board, n))
}

/**
 * TODO RULE CLARIFICATION T1 — regulamin nie wymaga jeszcze dopasowania krawędzi.
 */
export function validateEdgeCompatibility(edgeA: EdgeType, edgeB: EdgeType): boolean {
  void edgeA
  void edgeB
  return true
}

export function oppositeDirection(direction: number): number {
  return (direction + 3) % 6
}

export interface PlacementValidation {
  ok: boolean
  reason?: string
}

export function validateTilePlacement(
  board: BoardState,
  target: HexCoord,
  origin: HexCoord,
  definition: TileDefinition,
  rotation: number,
  getDefinition: (id: string) => TileDefinition,
): PlacementValidation {
  if (isTilePlaced(board, target)) {
    return { ok: false, reason: 'TARGET_OCCUPIED' }
  }
  if (!isTilePlaced(board, origin)) {
    return { ok: false, reason: 'ORIGIN_MISSING' }
  }

  let touchesOrigin = false
  for (let dir = 0; dir < 6; dir++) {
    const neighbor = getNeighbor(target, dir)
    const placed = getPlacedTile(board, neighbor)
    if (!placed) continue
    if (neighbor.q === origin.q && neighbor.r === origin.r) {
      touchesOrigin = true
    }
    const edgeHere = getRotatedEdge(definition, dir, rotation)
    const neighborDef = getDefinition(placed.definitionId)
    const edgeThere = getRotatedEdge(neighborDef, oppositeDirection(dir), placed.rotation)
    if (!validateEdgeCompatibility(edgeHere, edgeThere)) {
      return { ok: false, reason: 'EDGE_MISMATCH' }
    }
  }

  if (!touchesOrigin) {
    return { ok: false, reason: 'MUST_TOUCH_ORIGIN' }
  }

  return { ok: true }
}
