import type { HexCoord } from '../board/HexCoord'
import type { Rotation } from '../board/tileRotation'

export type GameEvent =
  | { type: 'GAME_STARTED'; seed: string }
  | { type: 'EXPLORATION_STARTED' }
  | { type: 'MOVE_SELECTION_STARTED' }
  | { type: 'SELECTION_CANCELLED' }
  | { type: 'TILE_DRAWN'; tileId: string }
  | { type: 'TILE_ROTATED'; rotation: Rotation }
  | { type: 'TILE_PLACED'; tileId: string; coord: HexCoord }
  | { type: 'SHIP_MOVED'; shipId: string; from: HexCoord; to: HexCoord }
  | { type: 'HEX_DISCOVERED'; tileId: string }
  | { type: 'SECTOR_RESOLVED'; tileId: string; note: string }
  | { type: 'COMBAT_RESOLVED'; attackerId: string; defenderId: string; damage: number }
  | { type: 'TURN_ENDED'; playerId: string }
  | { type: 'ROUND_STARTED'; round: number }
  | { type: 'FUEL_CHANGED'; playerId: string; fuel: number }
  | { type: 'COMMAND_REJECTED'; command: string; reason: string }
