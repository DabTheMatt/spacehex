import type { HexCoord } from '../board/HexCoord'
import { wrapRotation, getRotatedEdge, type Rotation } from '../board/tileRotation'
import { getTileDefinition } from '../definitions/tiles'
import { oppositeDirection } from '../board/HexMap'
import { directionFromTo } from '../board/hexMath'
import type { GameState } from '../state/GameState'
import { isPassableEdge } from './passage'

function keepsEntryOpen(tileId: string): boolean {
  return getTileDefinition(tileId).edges.some((edge) => !isPassableEdge(edge))
}

/** Pick a rotation so the world edge the ship enters through is passable. */
export function straitRotationForEntry(
  _state: GameState,
  tileId: string,
  _coord: HexCoord,
  exploreDir: number,
): Rotation {
  const enter = oppositeDirection(exploreDir)
  const def = getTileDefinition(tileId)
  const open = [0, 1, 2, 3, 4, 5].filter((rot) =>
    isPassableEdge(getRotatedEdge(def, enter, rot)),
  )
  if (!open.length) return 0
  return wrapRotation(open[0])
}

/** Step rotation but skip faces that would close the ship's entry. */
export function straitRotationStep(
  tileId: string,
  origin: HexCoord,
  target: HexCoord,
  fromRotation: Rotation,
  delta: number,
): Rotation {
  if (!keepsEntryOpen(tileId)) return wrapRotation(fromRotation + delta)
  const def = getTileDefinition(tileId)
  const dir = directionFromTo(origin, target)
  if (dir === null) return wrapRotation(fromRotation + delta)
  const enter = oppositeDirection(dir)
  let rotation = wrapRotation(fromRotation + delta)
  for (let i = 0; i < 6; i++) {
    if (isPassableEdge(getRotatedEdge(def, enter, rotation))) return rotation
    rotation = wrapRotation(rotation + delta)
  }
  return rotation
}
