import type { HexCoord } from '../board/HexCoord'
import { wrapRotation, getRotatedEdge, type Rotation } from '../board/tileRotation'
import { getTileDefinition } from '../definitions/tiles'
import { oppositeDirection } from '../board/HexMap'
import { directionFromTo } from '../board/hexMath'
import type { GameState } from '../state/GameState'

/** Pick a rotation so the world edge the ship enters through stays OPEN. */
export function straitRotationForEntry(
  _state: GameState,
  tileId: string,
  _coord: HexCoord,
  exploreDir: number,
): Rotation {
  const enter = oppositeDirection(exploreDir)
  const def = getTileDefinition(tileId)
  const open = [0, 1, 2, 3, 4, 5].filter((rot) => getRotatedEdge(def, enter, rot) === 'OPEN')
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
  const def = getTileDefinition(tileId)
  if (def.type !== 'STRAIT') return wrapRotation(fromRotation + delta)
  const dir = directionFromTo(origin, target)
  if (dir === null) return wrapRotation(fromRotation + delta)
  const enter = oppositeDirection(dir)
  let rotation = wrapRotation(fromRotation + delta)
  for (let i = 0; i < 6; i++) {
    if (getRotatedEdge(def, enter, rotation) === 'OPEN') return rotation
    rotation = wrapRotation(rotation + delta)
  }
  return rotation
}
