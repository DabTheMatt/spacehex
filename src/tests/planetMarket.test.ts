import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialState } from '../game/engine/GameEngine'
import { rollPlanetMarket } from '../game/rules/planetMarket'
import { cargoUsed, CARGO_CAPACITY, planetBudget } from '../game/definitions/resources'
import { getNeighbor } from '../game/board/hexMath'
import { coordKey } from '../game/board/HexCoord'

describe('planet markets', () => {
  it('rolls a deterministic offer from the game seed and tile id', () => {
    const a = rollPlanetMarket('seed-a', 'planet-small-1')
    const b = rollPlanetMarket('seed-a', 'planet-small-1')
    expect(a).toEqual(b)
    expect(a?.lots.reduce((sum, lot) => sum + lot.amount, 0)).toBe(planetBudget('PLANET_SMALL')?.units)
    expect(rollPlanetMarket('seed-a', 'planet-large-1')?.lots.reduce((sum, lot) => sum + lot.amount, 0)).toBe(
      planetBudget('PLANET_LARGE')?.units,
    )
    expect(rollPlanetMarket('seed-a', 'void-1')).toBeNull()
  })

  it('stocks a planet on discovery and lets the ship buy into the hold', () => {
    let state = createInitialState('planet-buy')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'planet-small-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    const key = coordKey({ q: 1, r: 0 })
    const market = state.planetMarkets[key]
    expect(market?.lots.length).toBeGreaterThan(0)
    const lot = market!.lots[0]
    const stock = lot.amount
    state = applyCommand(state, { type: 'DECLARE_MOVE', target: { q: 1, r: 0 } }).state
    const credits = state.players['player-1'].credits
    const bought = applyCommand(state, { type: 'BUY_RESOURCE', coord: { q: 1, r: 0 }, resource: lot.id })
    expect(bought.events.some((event) => event.type === 'RESOURCE_BOUGHT')).toBe(true)
    expect(bought.state.players['player-1'].credits).toBe(credits - lot.price)
    expect(bought.state.ships['mewa-1'].cargo[lot.id]).toBe(1)
    expect(cargoUsed(bought.state.ships['mewa-1'].cargo)).toBe(1)
    expect(CARGO_CAPACITY.MEWA).toBe(4)
    const left = bought.state.planetMarkets[key].lots.find((item) => item.id === lot.id)?.amount ?? 0
    expect(left).toBe(stock - 1)
  })

  it('rejects a buy when the ship is not on the planet', () => {
    let state = createInitialState('planet-away')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'planet-medium-1',
      coord: getNeighbor({ q: 0, r: 0 }, 2),
      rotation: 0,
    }).state
    const lot = state.planetMarkets[coordKey(getNeighbor({ q: 0, r: 0 }, 2))]?.lots[0]
    expect(lot).toBeTruthy()
    const result = applyCommand(state, {
      type: 'BUY_RESOURCE',
      coord: getNeighbor({ q: 0, r: 0 }, 2),
      resource: lot!.id,
    })
    expect(result.events.some((event) => event.type === 'COMMAND_REJECTED')).toBe(true)
  })
})
