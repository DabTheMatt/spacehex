import type { GameState } from '../state/GameState'
import { FUEL_COST_EXPLORE, FUEL_COST_MOVE } from '../definitions/constants'

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
