import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialState } from '../game/engine/GameEngine'
import { availableActions } from '../ui/availableActions'

describe('available actions', () => {
  it('lights explore, stay, and probe at EVA with no neighbors', () => {
    const state = createInitialState('actions-start')
    const lit = availableActions(state)
    expect(lit.EXPLORE).toBe(true)
    expect(lit.STAY).toBe(true)
    expect(lit.PROBE).toBe(true)
    expect(lit.MOVE).toBe(false)
    expect(lit.ATTACK).toBe(true)
    expect(lit.BUY).toBe(false)
    expect(lit.SELL).toBe(false)
    expect(lit.REFUEL).toBe(false)
  })

  it('lights move after a neighbor tile exists, and refuel on a planet', () => {
    let state = createInitialState('actions-planet')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'planet-small-1',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    expect(availableActions(state).MOVE).toBe(true)
    state = applyCommand(state, { type: 'DEV_REMOVE_FUEL', playerId: 'player-1', amount: 2 }).state
    state = applyCommand(state, { type: 'DECLARE_MOVE', target: { q: 1, r: 0 } }).state
    const lit = availableActions(state)
    expect(lit.EXPLORE).toBe(false)
    expect(lit.MOVE).toBe(false)
    expect(lit.STAY).toBe(false)
    expect(lit.PROBE).toBe(false)
    expect(lit.REFUEL).toBe(true)
    expect(lit.BUY).toBe(true)
  })
})
