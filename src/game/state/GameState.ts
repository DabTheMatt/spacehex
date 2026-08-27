import type { BoardState } from '../board/HexMap'
import type { ExplorationDeck } from '../board/TileDeck'
import type { HexCoord } from '../board/HexCoord'
import type { Rotation } from '../board/tileRotation'
import type { EdgeNumbers } from '../board/edgeNumbers'
import type { GameEvent } from '../engine/events'
import type { ShipClass } from '../definitions/ships'
import type { PlanetMarket, ResourceId } from '../definitions/resources'

export type GamePhase = 'PLAYER_TURN' | 'TILE_PLACEMENT'

export type SelectionMode = 'NONE' | 'SELECTING_MOVE' | 'SELECTING_DIRECTION' | 'PLACING_TILE'

export interface ExplorationState {
  status: SelectionMode
  origin?: HexCoord
  target?: HexCoord
  pendingTileId?: string
  rotation?: Rotation
  pendingEdgeNumbers?: EdgeNumbers
}

export interface PlayerState {
  id: string
  name: string
  shipId: string
  fuel: number
  glory: number
  credits: number
  buysThisTurn: number
  salvagesThisTurn: number
  attacksThisTurn: number
}

export interface ShipState {
  id: string
  playerId: string
  class: ShipClass
  coord: HexCoord
  hull: number
  maxHull: number
  cargo: Record<ResourceId, number>
  probes: number
}

export interface ProbeState {
  id: string
  coord: HexCoord
  ownerPlayerId: string
  ownerShipId: string
}

export interface NpcShipState {
  id: string
  class: ShipClass
  coord: HexCoord
  hull: number
  maxHull: number
}

export interface GameState {
  version: number
  seed: string
  round: number
  activePlayerId: string
  phase: GamePhase
  board: BoardState
  explorationDeck: ExplorationDeck
  exploration: ExplorationState
  players: Record<string, PlayerState>
  ships: Record<string, ShipState>
  npcShips: Record<string, NpcShipState>
  planetMarkets: Record<string, PlanetMarket>
  probes: Record<string, ProbeState>
  log: GameEvent[]
  movementSpent: boolean
}
