import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialState } from '../game/engine/GameEngine'
import { EXPLORATION_TILE_IDS } from '../game/definitions/tiles'
import { FUEL_BUY_PRICE, FUEL_TANK, STARTING_FUEL } from '../game/definitions/constants'
import { formatLogLine } from '../ui/eventLog'
import { discoveryNoun } from '../ui/discoveryCopy'
import { hullPipCount, hullPipFilled } from '../ui/hullPips'
import { rollAsteroidDamage } from '../game/rules/sectorHazards'

describe('exploration deck', () => {
  it('shuffles the 24-tile pile at game start', () => {
    const a = createInitialState('deck-a')
    const b = createInitialState('deck-b')
    expect(a.explorationDeck.drawPile).toHaveLength(24)
    expect([...a.explorationDeck.drawPile].sort()).toEqual([...EXPLORATION_TILE_IDS].sort())
    expect(a.explorationDeck.drawPile).not.toEqual(EXPLORATION_TILE_IDS)
    expect(a.explorationDeck.drawPile).not.toEqual(b.explorationDeck.drawPile)
    expect(a.log.some((e) => e.type === 'DECK_SHUFFLED' && e.count === 24)).toBe(true)
  })
})

describe('discovery log', () => {
  it('names who found which sector', () => {
    expect(discoveryNoun('planet-medium-1')).toBe('a medium planet')
    expect(discoveryNoun('asteroid-2')).toBe('an asteroid field')
    let state = createInitialState('log-find')
    const placed = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'planet-medium-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    })
    const found = placed.events.find((e) => e.type === 'HEX_DISCOVERED')
    expect(found).toMatchObject({ tileId: 'planet-medium-1', playerId: 'player-1' })
    expect(formatLogLine(placed.state, found!)).toBe('Player 1 discovered a medium planet.')
    state = applyCommand(placed.state, { type: 'DEV_NEXT_PLAYER' }).state
    const second = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'asteroid-1',
      coord: { q: 2, r: 0 },
      rotation: 0,
    })
    const ast = second.events.find((e) => e.type === 'HEX_DISCOVERED')
    expect(formatLogLine(second.state, ast!)).toBe('Player 2 discovered an asteroid field.')
  })
})

describe('asteroid entry', () => {
  it('rolls 0–2 damage deterministically', () => {
    const a = rollAsteroidDamage('s', { q: 1, r: 0 }, 'mewa-1', 4)
    const b = rollAsteroidDamage('s', { q: 1, r: 0 }, 'mewa-1', 4)
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThanOrEqual(2)
  })

  it('strikes a ship that flies into an asteroid field', () => {
    let state = createInitialState('rock-fly')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'asteroid-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    const before = state.ships['mewa-1'].hull
    const moved = applyCommand(state, { type: 'DECLARE_MOVE', target: { q: 1, r: 0 } })
    const strike = moved.events.find((e) => e.type === 'ASTEROID_STRIKE')
    expect(strike).toBeTruthy()
    if (strike && strike.type === 'ASTEROID_STRIKE') {
      expect(strike.damage).toBeGreaterThanOrEqual(0)
      expect(strike.damage).toBeLessThanOrEqual(2)
      expect(moved.state.ships['mewa-1'].hull).toBe(before - strike.damage)
    }
  })

  it('does not strike when a probe lays the asteroid', () => {
    let state = createInitialState('rock-probe')
    state = applyCommand(state, { type: 'DEV_FORCE_NEXT_TILE', tileId: 'asteroid-1' }).state
    const launched = applyCommand(state, { type: 'LAUNCH_PROBE', direction: 0 })
    expect(launched.events.some((e) => e.type === 'ASTEROID_STRIKE')).toBe(false)
    expect(launched.state.ships['mewa-1'].hull).toBe(3)
  })
})

describe('destruction', () => {
  it('destroys a ship at 0 hull', () => {
    let state = createInitialState('wreck')
    const hit = applyCommand(state, { type: 'DEV_DAMAGE_SHIP', shipId: 'mewa-1', amount: 3 })
    expect(hit.state.ships['mewa-1'].hull).toBe(0)
    expect(hit.events.some((e) => e.type === 'SHIP_DESTROYED')).toBe(true)
    expect(formatLogLine(hit.state, { type: 'SHIP_DESTROYED', shipId: 'mewa-1' })).toBe(
      'SG-1 was destroyed.',
    )
    const move = applyCommand(hit.state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'void-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    const fly = applyCommand(move, { type: 'DECLARE_MOVE', target: { q: 1, r: 0 } })
    expect(fly.events.some((e) => e.type === 'COMMAND_REJECTED')).toBe(true)
  })
})

describe('planet fuel', () => {
  it('sells one fuel at the stub price', () => {
    let state = createInitialState('refuel')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'planet-small-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    state = applyCommand(state, { type: 'DEV_REMOVE_FUEL', playerId: 'player-1', amount: 2 }).state
    expect(state.players['player-1'].fuel).toBe(STARTING_FUEL - 2)
    state = applyCommand(state, { type: 'DECLARE_MOVE', target: { q: 1, r: 0 } }).state
    const credits = state.players['player-1'].credits
    const bought = applyCommand(state, { type: 'BUY_FUEL', coord: { q: 1, r: 0 } })
    expect(bought.events.some((e) => e.type === 'FUEL_BOUGHT')).toBe(true)
    expect(bought.state.players['player-1'].fuel).toBe(STARTING_FUEL - 2)
    expect(bought.state.players['player-1'].credits).toBe(credits - FUEL_BUY_PRICE)
    expect(FUEL_TANK).toBe(STARTING_FUEL)
  })
})

describe('hull pips', () => {
  it('has one pip per max hull and fills the current value', () => {
    expect(hullPipCount(3)).toEqual([0, 1, 2])
    expect(hullPipFilled(0, 2)).toBe(true)
    expect(hullPipFilled(1, 2)).toBe(true)
    expect(hullPipFilled(2, 2)).toBe(false)
  })
})
