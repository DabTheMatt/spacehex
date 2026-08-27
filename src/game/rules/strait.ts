import type { HexCoord } from '../board/HexCoord'
import { coordKey } from '../board/HexCoord'
import { wrapRotation, getRotatedEdge, type Rotation } from '../board/tileRotation'
import { getTileDefinition } from '../definitions/tiles'
import { oppositeDirection } from '../board/HexMap'
import { RNG } from '../random/RNG'
import type { GameState } from '../state/GameState'

/** Pick a rotation so the world edge the ship enters through stays OPEN. */
export function straitRotationForEntry(
  state: GameState,
  tileId: string,
  coord: HexCoord,
  exploreDir: number,
): Rotation {
  const enter = oppositeDirection(exploreDir)
  const def = getTileDefinition(tileId)
  const open = [0, 1, 2, 3, 4, 5].filter((rot) => getRotatedEdge(def, enter, rot) === 'OPEN')
  const rng = new RNG(`${state.seed}:strait:${tileId}:${coordKey(coord)}`)
  if (!open.length) return wrapRotation(rng.nextInt(6))
  return wrapRotation(open[rng.nextInt(open.length)])
}
