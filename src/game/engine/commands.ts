import type { HexCoord } from '../board/HexCoord'
import type { Rotation } from '../board/tileRotation'

import type { ResourceId } from '../definitions/resources'

export type GameCommand =
  | { type: 'START_GAME'; seed: string }
  | { type: 'BEGIN_MOVE' }
  | { type: 'BEGIN_EXPLORATION' }
  | { type: 'CANCEL_SELECTION' }
  | { type: 'DECLARE_MOVE'; target: HexCoord }
  | { type: 'DECLARE_ATTACK'; defenderId: string }
  | { type: 'START_EXPLORATION'; direction: number }
  | { type: 'ROTATE_PENDING_TILE'; direction: 'LEFT' | 'RIGHT' }
  | { type: 'CONFIRM_TILE_PLACEMENT' }
  | { type: 'SKIP_MOVEMENT' }
  | { type: 'LAUNCH_PROBE'; direction: number }
  | { type: 'BUY_RESOURCE'; coord: HexCoord; resource: ResourceId }
  | { type: 'SELL_RESOURCE'; resource: ResourceId }
  | { type: 'END_TURN' }
  | { type: 'DEV_ADD_FUEL'; playerId: string; amount: number }
  | { type: 'DEV_REMOVE_FUEL'; playerId: string; amount: number }
  | { type: 'DEV_ADD_GLORY'; playerId: string; amount: number }
  | { type: 'DEV_DAMAGE_SHIP'; shipId: string; amount: number }
  | { type: 'DEV_FORCE_NEXT_TILE'; tileId: string }
  | { type: 'DEV_PLACE_TILE'; tileId: string; coord: HexCoord; rotation: Rotation }
  | { type: 'DEV_ROTATE_PLACED'; coord: HexCoord; direction: 'LEFT' | 'RIGHT' }
  | { type: 'DEV_NEXT_PLAYER' }
  | { type: 'DEV_RESET'; seed: string }
