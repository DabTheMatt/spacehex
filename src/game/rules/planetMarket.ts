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
  MAX_BUYS_PER_TURN,
  planetSizeCode,
  priceFromSupply,
  RESOURCE_IDS,
  type PlanetMarket,
  type ResourceId,
} from '../definitions/resources'
import { rollSectorName } from '../definitions/sectorNames'
import { activePlayer, activeShip, isRefuelHex } from './fuel'
import { FUEL_BUY_PRICE, FUEL_TANK, REPAIR_PRICE } from '../definitions/constants'

export type SellQuoteParts = { spot: number; margin: number; total: number }

export function formatSellParts(parts: SellQuoteParts): string {
  return `${parts.spot}+${parts.margin}=${parts.total}CR /1`
}

export function rollResourceAmount(size: 1 | 2 | 3, rng: RNG): number {
  if (size === 1) return rng.nextInt(3)
  if (size === 2) return rng.nextInt(4)
  return 1 + rng.nextInt(4)
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
    counts.ORE = 1
  }
  const designation = rollSectorName(seed, tileId, def.type, discovererId)
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

export function sellQuoteParts(
  state: GameState,
  from: HexCoord,
  resource: ResourceId,
): SellQuoteParts {
  const spot = buyPrice(state, resource)
  const margin = nearestHomeworldDistance(state, from, resource)
  return { spot, margin, total: spot + margin }
}

/** Sale quote: supply price + 1 CR per hex to the nearest homeworld of that color. */
export function sellQuote(state: GameState, from: HexCoord, resource: ResourceId): number {
  return sellQuoteParts(state, from, resource).total
}

export const EVA_COORD: HexCoord = { q: 0, r: 0 }

export function evaSellQuote(state: GameState, resource: ResourceId): number {
  return sellQuote(state, EVA_COORD, resource)
}

export function evaSellParts(state: GameState, resource: ResourceId) {
  return sellQuoteParts(state, EVA_COORD, resource)
}

export function isEvaHex(coord: HexCoord): boolean {
  return coord.q === EVA_COORD.q && coord.r === EVA_COORD.r
}

export function sellResource(
  state: GameState,
  resource: ResourceId,
):
  | { ok: true; state: GameState; qty: number; spot: number; margin: number; total: number }
  | { ok: false; reason: string } {
  const ship = activeShip(state)
  if (!isEvaHex(ship.coord)) return { ok: false, reason: 'NOT_AT_EVA' }
  const qty = ship.cargo[resource] ?? 0
  if (qty <= 0) return { ok: false, reason: 'NO_CARGO' }
  const player = activePlayer(state)
  const parts = evaSellParts(state, resource)
  const sold = 1
  const payout = parts.total * sold
  return {
    ok: true,
    qty: sold,
    ...parts,
    state: {
      ...state,
      players: {
        ...state.players,
        [player.id]: { ...player, credits: player.credits + payout },
      },
      ships: {
        ...state.ships,
        [ship.id]: {
          ...ship,
          cargo: { ...ship.cargo, [resource]: qty - sold },
        },
      },
    },
  }
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

export function buyFuel(
  state: GameState,
  coord: HexCoord,
): { ok: true; state: GameState; price: number } | { ok: false; reason: string } {
  if (!isRefuelHex(state, coord)) return { ok: false, reason: 'NO_MARKET' }
  const ship = activeShip(state)
  if (ship.coord.q !== coord.q || ship.coord.r !== coord.r) {
    return { ok: false, reason: 'NOT_IN_SECTOR' }
  }
  if (ship.hull <= 0) return { ok: false, reason: 'WRECK' }
  const player = activePlayer(state)
  if (player.fuel >= FUEL_TANK) return { ok: false, reason: 'TANK_FULL' }
  if (player.credits < FUEL_BUY_PRICE) return { ok: false, reason: 'NO_CREDITS' }
  return {
    ok: true,
    price: FUEL_BUY_PRICE,
    state: {
      ...state,
      players: {
        ...state.players,
        [player.id]: {
          ...player,
          credits: player.credits - FUEL_BUY_PRICE,
          fuel: player.fuel + 1,
        },
      },
    },
  }
}

export function repairHull(
  state: GameState,
): { ok: true; state: GameState; price: number } | { ok: false; reason: string } {
  const ship = activeShip(state)
  if (!isEvaHex(ship.coord)) return { ok: false, reason: 'NOT_EVA' }
  if (ship.hull <= 0) return { ok: false, reason: 'WRECK' }
  if (ship.hull >= ship.maxHull) return { ok: false, reason: 'HULL_FULL' }
  const player = activePlayer(state)
  if (player.credits < REPAIR_PRICE) return { ok: false, reason: 'NO_CREDITS' }
  return {
    ok: true,
    price: REPAIR_PRICE,
    state: {
      ...state,
      players: {
        ...state.players,
        [player.id]: { ...player, credits: player.credits - REPAIR_PRICE },
      },
      ships: {
        ...state.ships,
        [ship.id]: { ...ship, hull: ship.hull + 1 },
      },
    },
  }
}
