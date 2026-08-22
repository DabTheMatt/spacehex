import type { GameState } from '../state/GameState'
import type { HexCoord } from '../board/HexCoord'
import { coordKey } from '../board/HexCoord'
import { RNG } from '../random/RNG'
import { getTileDefinition } from '../definitions/tiles'
import {
  CARGO_CAPACITY,
  cargoUsed,
  planetBudget,
  RESOURCE_IDS,
  RESOURCE_PRICE,
  type PlanetMarket,
  type ResourceId,
  type ResourceLot,
} from '../definitions/resources'
import { activePlayer, activeShip } from './fuel'

export function rollPlanetMarket(seed: string, tileId: string): PlanetMarket | null {
  const def = getTileDefinition(tileId)
  const budget = planetBudget(def.type)
  if (!budget) return null
  const rng = new RNG(`${seed}:planet:${tileId}`)
  const kinds = rng.shuffle([...RESOURCE_IDS]).slice(0, budget.kinds)
  const counts: Record<ResourceId, number> = { ORE: 0, ICE: 0, RARE: 0 }
  for (let i = 0; i < budget.units; i++) {
    const id = kinds[rng.nextInt(kinds.length)]
    counts[id] += 1
  }
  const lots: ResourceLot[] = kinds
    .filter((id) => counts[id] > 0)
    .map((id) => ({ id, amount: counts[id], price: RESOURCE_PRICE[id] }))
  return { tileId, lots }
}

export function stockPlanetIfNeeded(state: GameState, tileId: string, coord: HexCoord): GameState {
  const key = coordKey(coord)
  if (state.planetMarkets[key]) return state
  const market = rollPlanetMarket(state.seed, tileId)
  if (!market) return state
  return {
    ...state,
    planetMarkets: { ...state.planetMarkets, [key]: market },
  }
}

export function buyResource(
  state: GameState,
  coord: HexCoord,
  resource: ResourceId,
): { ok: true; state: GameState } | { ok: false; reason: string } {
  const key = coordKey(coord)
  const market = state.planetMarkets[key]
  if (!market) return { ok: false, reason: 'NO_MARKET' }
  const ship = activeShip(state)
  if (ship.coord.q !== coord.q || ship.coord.r !== coord.r) {
    return { ok: false, reason: 'NOT_IN_SECTOR' }
  }
  const lot = market.lots.find((item) => item.id === resource)
  if (!lot || lot.amount <= 0) return { ok: false, reason: 'SOLD_OUT' }
  const player = activePlayer(state)
  if (player.credits < lot.price) return { ok: false, reason: 'NO_CREDITS' }
  const capacity = CARGO_CAPACITY[ship.class]
  if (cargoUsed(ship.cargo) >= capacity) return { ok: false, reason: 'HOLD_FULL' }

  const nextLots = market.lots
    .map((item) => (item.id === resource ? { ...item, amount: item.amount - 1 } : item))
    .filter((item) => item.amount > 0)
  return {
    ok: true,
    state: {
      ...state,
      planetMarkets: {
        ...state.planetMarkets,
        [key]: { ...market, lots: nextLots },
      },
      players: {
        ...state.players,
        [player.id]: { ...player, credits: player.credits - lot.price },
      },
      ships: {
        ...state.ships,
        [ship.id]: {
          ...ship,
          cargo: { ...ship.cargo, [resource]: ship.cargo[resource] + 1 },
        },
      },
    },
  }
}
