import { describe, expect, it } from 'vitest'
import { commandMode } from '../ui/commandMode'
import { hoverCaption } from '../ui/boardHover'
import { applyCommand, createInitialState } from '../game/engine/GameEngine'

describe('command mode', () => {
  it('is idle when nothing is selected', () => {
    const state = createInitialState('spacehex-v0.1')
    expect(commandMode(state, { shipId: null, tile: null })).toBe('IDLE')
  })

  it('selects the ship object when a ship id is set', () => {
    const state = createInitialState('spacehex-v0.1')
    expect(commandMode(state, { shipId: 'mewa-1', tile: null })).toBe('OBJECT_SELECTED')
  })

  it('enters move targeting after BEGIN_MOVE', () => {
    let state = createInitialState('spacehex-v0.1')
    state = applyCommand(state, { type: 'BEGIN_MOVE' }).state
    expect(commandMode(state, { shipId: 'mewa-1', tile: null })).toBe('MOVE_TARGETING')
  })
})

describe('hover captions', () => {
  it('labels explore, move, and stay hexes', () => {
    expect(hoverCaption('EXPLORE')).toBe('EXPLORE')
    expect(hoverCaption('MOVE')).toBe('MOVE HERE')
    expect(hoverCaption('STAY')).toBe('STAY')
  })
})

describe('command mode', () => {
  it('is idle when nothing is selected', () => {
    const state = createInitialState('spacehex-v0.1')
    expect(commandMode(state, { shipId: null, tile: null })).toBe('IDLE')
  })

  it('selects the ship object when a ship id is set', () => {
    const state = createInitialState('spacehex-v0.1')
    expect(commandMode(state, { shipId: 'mewa-1', tile: null })).toBe('OBJECT_SELECTED')
  })

  it('enters move targeting after BEGIN_MOVE', () => {
    let state = createInitialState('spacehex-v0.1')
    state = applyCommand(state, { type: 'BEGIN_MOVE' }).state
    expect(commandMode(state, { shipId: 'mewa-1', tile: null })).toBe('MOVE_TARGETING')
  })
})
