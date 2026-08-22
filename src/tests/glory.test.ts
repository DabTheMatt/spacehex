import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialState } from '../game/engine/GameEngine'
import { discoveryGlory, GLORY_DAMAGE, GLORY_DESTROY } from '../game/rules/glory'
import { COMBAT_DAMAGE } from '../game/definitions/constants'

describe('glory', () => {
  it('awards 1 for void, 2 for other features, and 3 plus range for planets', () => {
    expect(discoveryGlory('VOID', { q: 1, r: 0 })).toBe(1)
    expect(discoveryGlory('ASTEROID', { q: 1, r: 0 })).toBe(2)
    expect(discoveryGlory('PLANET_SMALL', { q: 1, r: 0 })).toBe(4)
    expect(discoveryGlory('PLANET_LARGE', { q: 2, r: 0 })).toBe(5)
  })

  it('grants glory when a tile is discovered', () => {
    let state = createInitialState('glory-void')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'void-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    expect(state.players['player-1'].glory).toBe(1)

    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'planet-small-1',
      coord: { q: 2, r: 0 },
      rotation: 0,
    }).state
    expect(state.players['player-1'].glory).toBe(1 + 5)
  })

  it('grants glory for dealing damage and destroying a Mewa', () => {
    let state = createInitialState('glory-fight')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'void-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    state = applyCommand(state, { type: 'DEV_DAMAGE_SHIP', shipId: 'mewa-2', amount: 2 }).state
    expect(state.ships['mewa-2'].hull).toBe(1)
    state = {
      ...state,
      ships: {
        ...state.ships,
        'mewa-2': { ...state.ships['mewa-2'], coord: { q: 1, r: 0 } },
      },
    }
    const moved = applyCommand(state, { type: 'DECLARE_MOVE', target: { q: 1, r: 0 } })
    expect(moved.events.some((event) => event.type === 'COMBAT_RESOLVED')).toBe(true)
    expect(moved.state.ships['mewa-2'].hull).toBe(0)
    expect(moved.state.players['player-1'].glory).toBe(
      1 + GLORY_DAMAGE + GLORY_DESTROY.MEWA,
    )
    expect(COMBAT_DAMAGE).toBe(1)
  })
})
