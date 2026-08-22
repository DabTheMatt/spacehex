import type { HexCoord } from './HexCoord'
import type { Rotation } from './tileRotation'

export interface PlacedTile {
  id: string
  definitionId: string
  coord: HexCoord
  rotation: Rotation
  discoveredByPlayerId: string | null
  discoveredRound: number | null
  designation: string
}
