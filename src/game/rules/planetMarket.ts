import type { GameState } from '../state/GameState'
import type { HexCoord } from '../board/HexCoord'
import { coordKey } from '../board/HexCoord'
import { hexDistance } from '../board/hexMath'
import { RNG } from '../random/RNG'
import { getTileDefinition } from '../definitions/tiles'
import { getPlacedTile } from '../board/HexMap'
import {
  CARGO_CAPACITY,
  cargoUsed,
  emptyCargo,
  GREEK_LETTERS,
  LATIN_LETTERS,
  MAX_BUYS_PER_TURN,
  planetSizeCode,
  priceFromSupply,
  RESOURCE_IDS,
  type PlanetMarket,
  type ResourceId,
} from '../definitions/resources'
import { activePlayer, activeShip } from './fuel'

export function rollResourceAmount(size: 1 | 2 | 3, rng: RNG): number {
  if (size === 1) return rng.nextInt(3)
  if (size === 2) return rng.nextInt(4)
  return 1 + rng.nextInt(4)
}

export function discovererSlot(playerId: string | null | undefined): 1 | 2 {
  return playerId === 'player-2' ? 2 : 1
}

export function rollPlanetMarket(
  seed: string,
  tileId: string,
  discovererId: string | null,
): PlanetMarket | null {
  const def = getTileDefinition(tileId)
  const size = planetSizeCode(def.type)
  if (!size) return null
  const rng = new RNG(`${seed}:planet:${tileId}`)
  const counts = emptyCargo()
  for (const id of RESOURCE_IDS) {
    counts[id] = rollResourceAmount(size, rng)
  }
  if (RESOURCE_IDS.every((id) => counts[id] === 0)) {
    counts.RED = 1
  }
  const greek = GREEK_LETTERS[rng.nextInt(GREEK_LETTERS.length)]
  const latin = LATIN_LETTERS[rng.nextInt(LATIN_LETTERS.length)]
  const designation = `SG${discovererSlot(discovererId)}-${size}-${greek}-${latin}`
  const lots = RESOURCE_IDS.map((id) => ({ id, amount: counts[id] }))
  const homeColors = RESOURCE_IDS.filter((id) => counts[id] > 0)
  return { tileId, designation, lots, homeColors }
}

export function stockPlanetIfNeeded(state: GameState, tileId: string, coord: HexCoord): GameState {
  const key = coordKey(coord)
  if (state.planetMarkets[key]) return state
  const placed = getPlacedTile(state.board, coord)
  const market = rollPlanetMarket(state.seed, tileId, placed?.discoveredByPlayerId ?? state.activePlayerId)
  if (!market) return state
  return {
    ...state,
    planetMarkets: { ...state.planetMarkets, [key]: market },
  }
}

export function boardSupply(state: GameState, resource: ResourceId): number {
  let total = 0
  for (const market of Object.values(state.planetMarkets)) {
    const lot = market.lots.find((item) => item.id === resource)
    if (lot) total += lot.amount
  }
  return total
}

export function buyPrice(state: GameState, resource: ResourceId): number {
  return priceFromSupply(boardSupply(state, resource))
}

export function homeworldCoords(state: GameState, resource: ResourceId): HexCoord[] {
  const coords: HexCoord[] = []
  for (const [key, market] of Object.entries(state.planetMarkets)) {
    if (!market.homeColors.includes(resource)) continue
    const [q, r] = key.split(',').map(Number)
    coords.push({ q, r })
  }
  return coords
}

export function nearestHomeworldDistance(
  state: GameState,
  from: HexCoord,
  resource: ResourceId,
): number {
  const homes = homeworldCoords(state, resource)
  if (!homes.length) return 0
  return Math.min(...homes.map((home) => hexDistance(from, home)))
}

/** Sale quote: supply price + 1 CR per hex to the nearest homeworld of that color. */
export function sellQuote(state: GameState, from: HexCoord, resource: ResourceId): number {
  return buyPrice(state, resource) + nearestHomeworldDistance(state, from, resource)
}

export function buyResource(
  state: GameState,
  coord: HexCoord,
  resource: ResourceId,
): { ok: true; state: GameState; price: number } | { ok: false; reason: string } {
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
  if ((player.buysThisTurn ?? 0) >= MAX_BUYS_PER_TURN) {
    return { ok: false, reason: 'BUY_LIMIT' }
  }
  const price = buyPrice(state, resource)
  if (player.credits < price) return { ok: false, reason: 'NO_CREDITS' }
  const capacity = CARGO_CAPACITY[ship.class]
  if (cargoUsed(ship.cargo) >= capacity) return { ok: false, reason: 'HOLD_FULL' }

  const nextLots = market.lots.map((item) =>
    item.id === resource ? { ...item, amount: item.amount - 1 } : item,
  )
  return {
    ok: true,
    price,
    state: {
      ...state,
      planetMarkets: {
        ...state.planetMarkets,
        [key]: { ...market, lots: nextLots },
      },
      players: {
        ...state.players,
        [player.id]: {
          ...player,
          credits: player.credits - price,
          buysThisTurn: (player.buysThisTurn ?? 0) + 1,
        },
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
