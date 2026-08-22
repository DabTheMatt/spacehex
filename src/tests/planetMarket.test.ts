import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialState } from '../game/engine/GameEngine'
import {
  boardSupply,
  buyPrice,
  evaSellParts,
  formatSellParts,
  nearestHomeworldDistance,
  rollPlanetMarket,
  sellQuote,
  evaSellQuote,
} from '../game/rules/planetMarket'
import {
  cargoUsed,
  CARGO_CAPACITY,
  GREEK_LETTERS,
  LATIN_LETTERS,
  MAX_BUYS_PER_TURN,
  planetSizeCode,
  priceFromSupply,
  RESOURCE_IDS,
} from '../game/definitions/resources'
import { getNeighbor } from '../game/board/hexMath'
import { coordKey } from '../game/board/HexCoord'
import type { GameState } from '../game/state/GameState'
import type { ResourceId } from '../game/definitions/resources'

describe('supply prices', () => {
  it('follows the demand table', () => {
    expect(priceFromSupply(6)).toBe(1)
    expect(priceFromSupply(7)).toBe(1)
    expect(priceFromSupply(5)).toBe(2)
    expect(priceFromSupply(4)).toBe(3)
    expect(priceFromSupply(3)).toBe(4)
    expect(priceFromSupply(2)).toBe(5)
    expect(priceFromSupply(1)).toBe(6)
    expect(priceFromSupply(0)).toBe(10)
  })
})

describe('planet markets', () => {
  it('rolls every color, a designation, and is deterministic', () => {
    const a = rollPlanetMarket('seed-a', 'planet-small-1', 'player-1')
    const b = rollPlanetMarket('seed-a', 'planet-small-1', 'player-1')
    expect(a).toEqual(b)
    expect(a?.lots).toHaveLength(3)
    expect(a?.lots.map((lot) => lot.id).sort()).toEqual([...RESOURCE_IDS].sort())
    expect(a?.designation).toMatch(
      new RegExp(
        `^SG1-${planetSizeCode('PLANET_SMALL')}-[${GREEK_LETTERS.join('')}]-[${LATIN_LETTERS.join('')}]-sp$`,
      ),
    )
    const large = rollPlanetMarket('seed-a', 'planet-large-1', 'player-2')
    expect(large?.designation.startsWith('SG2-3-')).toBe(true)
    expect(large?.designation.endsWith('-lp')).toBe(true)
    expect(rollPlanetMarket('seed-a', 'void-1', 'player-1')).toBeNull()
  })

  it('names every discovered hex with a type suffix', () => {
    expect(createInitialState('names').board.tiles['0,0'].designation).toBe('EVA-1 Space Station')
    let state = createInitialState('names')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'void-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    expect(state.board.tiles[coordKey({ q: 1, r: 0 })].designation).toMatch(/-v$/)
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'asteroid-1',
      coord: { q: 2, r: 0 },
      rotation: 0,
    }).state
    expect(state.board.tiles[coordKey({ q: 2, r: 0 })].designation).toMatch(/-a$/)
  })

  it('stocks a planet on discovery and buys at the live supply price', () => {
    let state = rich(createInitialState('planet-buy'))
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'planet-small-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    const key = coordKey({ q: 1, r: 0 })
    state = withLots(state, key, { ORE: 4, BIOMASS: 0, ICE: 0 })
    expect(boardSupply(state, 'ORE')).toBe(4)
    const price = buyPrice(state, 'ORE')
    expect(price).toBe(3)
    state = applyCommand(state, { type: 'DECLARE_MOVE', target: { q: 1, r: 0 } }).state
    const credits = state.players['player-1'].credits
    const bought = applyCommand(state, { type: 'BUY_RESOURCE', coord: { q: 1, r: 0 }, resource: 'ORE' })
    expect(bought.events.some((event) => event.type === 'RESOURCE_BOUGHT')).toBe(true)
    expect(bought.state.players['player-1'].credits).toBe(credits - price)
    expect(bought.state.ships['mewa-1'].cargo.ORE).toBe(1)
    expect(cargoUsed(bought.state.ships['mewa-1'].cargo)).toBe(1)
    expect(CARGO_CAPACITY.MEWA).toBe(4)
    expect(boardSupply(bought.state, 'ORE')).toBe(3)
    expect(buyPrice(bought.state, 'ORE')).toBe(4)
  })

  it('caps buys at two containers per turn', () => {
    let state = rich(createInitialState('planet-cap'))
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'planet-medium-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    const key = coordKey({ q: 1, r: 0 })
    state = withLots(state, key, { ORE: 4, BIOMASS: 2, ICE: 1 })
    state = applyCommand(state, { type: 'DECLARE_MOVE', target: { q: 1, r: 0 } }).state
    state = applyCommand(state, { type: 'BUY_RESOURCE', coord: { q: 1, r: 0 }, resource: 'ORE' }).state
    state = applyCommand(state, { type: 'BUY_RESOURCE', coord: { q: 1, r: 0 }, resource: 'BIOMASS' }).state
    expect(state.players['player-1'].buysThisTurn).toBe(MAX_BUYS_PER_TURN)
    const third = applyCommand(state, { type: 'BUY_RESOURCE', coord: { q: 1, r: 0 }, resource: 'ICE' })
    expect(third.events.some((event) => event.type === 'COMMAND_REJECTED')).toBe(true)
  })

  it('rejects a buy when the ship is not on the planet', () => {
    let state = createInitialState('planet-away')
    const dest = getNeighbor({ q: 0, r: 0 }, 2)
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'planet-medium-1',
      coord: dest,
      rotation: 0,
    }).state
    const result = applyCommand(state, {
      type: 'BUY_RESOURCE',
      coord: dest,
      resource: 'ORE',
    })
    expect(result.events.some((event) => event.type === 'COMMAND_REJECTED')).toBe(true)
  })

  it('adds transport margin to the sale quote', () => {
    let state = createInitialState('margin')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'planet-small-1',
      coord: { q: 4, r: 0 },
      rotation: 0,
    }).state
    state = withLots(state, coordKey({ q: 4, r: 0 }), { ORE: 4, BIOMASS: 0, ICE: 0 })
    expect(nearestHomeworldDistance(state, { q: 0, r: 0 }, 'ORE')).toBe(4)
    expect(sellQuote(state, { q: 0, r: 0 }, 'ORE')).toBe(3 + 4)
    expect(formatSellParts(evaSellParts(state, 'ORE'))).toBe('3+4=7CR')

    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'planet-small-2',
      coord: { q: 2, r: 0 },
      rotation: 0,
    }).state
    state = withLots(state, coordKey({ q: 2, r: 0 }), { ORE: 0, BIOMASS: 0, ICE: 0 }, ['BIOMASS'])
    expect(boardSupply(state, 'BIOMASS')).toBe(0)
    expect(sellQuote(state, { q: 0, r: 0 }, 'BIOMASS')).toBe(10 + 2)
    expect(evaSellQuote(state, 'BIOMASS')).toBe(12)
  })

  it('sells cargo at EVA-1 without returning it to board supply', () => {
    let state = createInitialState('eva-sell')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'planet-small-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    state = withLots(state, coordKey({ q: 1, r: 0 }), { ORE: 4, BIOMASS: 0, ICE: 0 })
    const supply = boardSupply(state, 'ORE')
    const parts = evaSellParts(state, 'ORE')
    state = withCargo(state, { ORE: 2, BIOMASS: 0, ICE: 0 })
    const credits = state.players['player-1'].credits
    const sold = applyCommand(state, { type: 'SELL_RESOURCE', resource: 'ORE' })
    expect(sold.events.some((event) => event.type === 'RESOURCE_SOLD')).toBe(true)
    expect(sold.state.ships['mewa-1'].cargo.ORE).toBe(0)
    expect(sold.state.players['player-1'].credits).toBe(credits + parts.total * 2)
    expect(boardSupply(sold.state, 'ORE')).toBe(supply)
    expect(buyPrice(sold.state, 'ORE')).toBe(buyPrice(state, 'ORE'))
  })

  it('rejects a sale away from EVA-1', () => {
    let state = createInitialState('sell-away')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'void-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    state = withCargo(state, { ORE: 1, BIOMASS: 0, ICE: 0 })
    state = applyCommand(state, { type: 'DECLARE_MOVE', target: { q: 1, r: 0 } }).state
    const sold = applyCommand(state, { type: 'SELL_RESOURCE', resource: 'ORE' })
    expect(sold.events.some((event) => event.type === 'COMMAND_REJECTED')).toBe(true)
  })
})

function rich(state: GameState): GameState {
  return {
    ...state,
    players: {
      ...state.players,
      'player-1': { ...state.players['player-1'], credits: 80 },
    },
  }
}

function withCargo(state: GameState, cargo: Record<ResourceId, number>): GameState {
  const ship = state.ships['mewa-1']
  return {
    ...state,
    ships: {
      ...state.ships,
      'mewa-1': { ...ship, cargo: { ...cargo } },
    },
  }
}

function withLots(
  state: GameState,
  key: string,
  amounts: Record<ResourceId, number>,
  homeColors: ResourceId[] = RESOURCE_IDS.filter((id) => amounts[id] > 0),
): GameState {
  const market = state.planetMarkets[key]
  if (!market) throw new Error(`no market at ${key}`)
  return {
    ...state,
    planetMarkets: {
      ...state.planetMarkets,
      [key]: {
        ...market,
        homeColors,
        lots: RESOURCE_IDS.map((id) => ({ id, amount: amounts[id] })),
      },
    },
  }
}
