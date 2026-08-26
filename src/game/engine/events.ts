import type { HexCoord } from '../board/HexCoord'
import type { Rotation } from '../board/tileRotation'
import type { ResourceId } from '../definitions/resources'
import type { ShipClass } from '../definitions/ships'

export type GameEvent =
  | { type: 'GAME_STARTED'; seed: string }
  | { type: 'EXPLORATION_STARTED' }
  | { type: 'MOVE_SELECTION_STARTED' }
  | { type: 'SELECTION_CANCELLED' }
  | { type: 'TILE_DRAWN'; tileId: string }
  | { type: 'TILE_ROTATED'; rotation: Rotation }
  | { type: 'TILE_PLACED'; tileId: string; coord: HexCoord }
  | { type: 'SHIP_MOVED'; shipId: string; from: HexCoord; to: HexCoord }
  | { type: 'HEX_DISCOVERED'; tileId: string; playerId: string }
  | { type: 'DECK_SHUFFLED'; count: number }
  | { type: 'SECTOR_RESOLVED'; tileId: string; note: string }
  | { type: 'PLANET_STOCKED'; tileId: string; coord: HexCoord }
  | { type: 'RESOURCE_BOUGHT'; playerId: string; resource: ResourceId; price: number; coord: HexCoord }
  | {
      type: 'RESOURCE_SOLD'
      playerId: string
      resource: ResourceId
      qty: number
      spot: number
      margin: number
      total: number
    }
  | { type: 'CREDITS_CHANGED'; playerId: string; credits: number }
  | { type: 'COMBAT_STARTED'; attackerId: string; defenderId: string; coord: HexCoord; attackerHull: number; defenderHull: number }
  | { type: 'COMBAT_SHOT'; attackerId: string; defenderId: string; damage: number; hullAfter: number }
  | { type: 'COMBAT_ENDED'; attackerId: string; defenderId: string }
  | { type: 'COMBAT_RESOLVED'; attackerId: string; defenderId: string; damage: number }
  | { type: 'GLORY_CHANGED'; playerId: string; glory: number; delta: number }
  | { type: 'TURN_ENDED'; playerId: string }
  | { type: 'ROUND_STARTED'; round: number }
  | { type: 'FUEL_CHANGED'; playerId: string; fuel: number }
  | { type: 'PROBE_LAUNCHED'; playerId: string; shipId: string; coord: HexCoord }
  | { type: 'PROBE_DISMISSED'; coord: HexCoord; shipId: string }
  | { type: 'NPC_SPAWNED'; shipId: string; class: ShipClass; coord: HexCoord }
  | { type: 'SHIP_DAMAGED'; shipId: string; damage: number; hullAfter: number }
  | { type: 'SHIP_DESTROYED'; shipId: string }
  | { type: 'ASTEROID_STRIKE'; shipId: string; coord: HexCoord; damage: number }
  | { type: 'FUEL_BOUGHT'; playerId: string; price: number; fuel: number; coord: HexCoord }
  | { type: 'COMMAND_REJECTED'; command: string; reason: string }
