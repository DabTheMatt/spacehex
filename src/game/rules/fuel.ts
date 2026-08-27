import type { GameState } from '../state/GameState'
import type { HexCoord } from '../board/HexCoord'
import { getPlacedTile } from '../board/HexMap'
import { getTileDefinition } from '../definitions/tiles'
import { isRefuelTileType } from '../definitions/refuel'
import { FUEL_COST_EXPLORE, FUEL_COST_MOVE, FUEL_COST_SKIP } from '../definitions/constants'

export function activePlayer(state: GameState) {
  return state.players[state.activePlayerId]
}

export function activeShip(state: GameState) {
  const player = activePlayer(state)
  return state.ships[player.shipId]
}

export function canAffordMove(state: GameState): boolean {
  return activePlayer(state).fuel >= FUEL_COST_MOVE
}

export function canAffordExplore(state: GameState): boolean {
  return activePlayer(state).fuel >= FUEL_COST_EXPLORE
}

export function isRefuelHex(state: GameState, coord: HexCoord): boolean {
  const tile = getPlacedTile(state.board, coord)
  if (!tile) return false
  return isRefuelTileType(getTileDefinition(tile.definitionId).type)
}

/** Stay burns a fuel cell unless the ship is tanking on a refuel hex. */
export function stayFuelCost(state: GameState): number {
  return isRefuelHex(state, activeShip(state).coord) ? 0 : FUEL_COST_SKIP
}

export function spendFuel(state: GameState, amount: number): GameState {
  const player = activePlayer(state)
  return {
    ...state,
    players: {
      ...state.players,
      [player.id]: { ...player, fuel: Math.max(0, player.fuel - amount) },
    },
  }
}
