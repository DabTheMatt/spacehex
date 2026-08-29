import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialState } from '../game/engine/GameEngine'
import { canTraverse } from '../game/rules/passage'
import { canExploreDirection } from '../game/rules/exploration'

describe('passage', () => {
  it('lets a ship leave EVA in every direction', () => {
    const state = createInitialState('pass-eva')
    for (let dir = 0; dir < 6; dir++) {
      expect(canExploreDirection(state, dir)).toBe(true)
    }
  })

  it('opens only opposite faces of a through-strait', () => {
    let state = createInitialState('pass-strait')
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'strait-3',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'void-1',
      coord: { q: 2, r: 0 },
      rotation: 0,
    }).state
    state = applyCommand(state, {
      type: 'DEV_PLACE_TILE',
      tileId: 'void-2',
      coord: { q: 1, r: 1 },
      rotation: 0,
    }).state
    state = applyCommand(state, { type: 'DECLARE_MOVE', target: { q: 1, r: 0 } }).state
    expect(canTraverse(state, { q: 1, r: 0 }, { q: 2, r: 0 })).toBe(true)
    expect(canTraverse(state, { q: 1, r: 0 }, { q: 1, r: 1 })).toBe(false)
  })

  it('blocks flying through an asteroid rim, and allows the open face', () => {
    const blocked = applyCommand(createInitialState('pass-rocks'), {
      type: 'DEV_PLACE_TILE',
      tileId: 'asteroid-3',
      coord: { q: 1, r: 0 },
      rotation: 3,
    }).state
    expect(canTraverse(blocked, { q: 0, r: 0 }, { q: 1, r: 0 })).toBe(false)
    const refused = applyCommand(blocked, { type: 'DECLARE_MOVE', target: { q: 1, r: 0 } })
    expect(refused.events.some((e) => e.type === 'COMMAND_REJECTED')).toBe(true)

    const open = applyCommand(createInitialState('pass-rocks-open'), {
      type: 'DEV_PLACE_TILE',
      tileId: 'asteroid-3',
      coord: { q: 1, r: 0 },
      rotation: 0,
    }).state
    expect(canTraverse(open, { q: 0, r: 0 }, { q: 1, r: 0 })).toBe(true)
  })
})
