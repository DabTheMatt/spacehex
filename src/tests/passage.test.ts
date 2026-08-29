import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialState } from '../game/engine/GameEngine'
import { TILE_DEFINITIONS } from '../game/definitions/tiles'
import { oppositeDirection } from '../game/board/HexMap'
import { getRotatedEdge } from '../game/board/tileRotation'
import { canTraverse, isPassableEdge } from '../game/rules/passage'
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

  it('orients an explored asteroid so the ship does not enter through a rim', () => {
    for (const tileId of ['asteroid-1', 'asteroid-2', 'asteroid-3'] as const) {
      for (let dir = 0; dir < 6; dir++) {
        let state = createInitialState(`explore-rocks-${tileId}-${dir}`)
        state = applyCommand(state, { type: 'DEV_FORCE_NEXT_TILE', tileId }).state
        const started = applyCommand(state, { type: 'START_EXPLORATION', direction: dir })
        state = started.state
        const origin = { q: 0, r: 0 }
        const target = state.exploration.target
        expect(target).toBeTruthy()
        const confirmed = applyCommand(state, { type: 'CONFIRM_TILE_PLACEMENT' })
        state = confirmed.state
        expect(confirmed.events.some((e) => e.type === 'COMMAND_REJECTED')).toBe(false)
        expect(canTraverse(state, origin, target!)).toBe(true)
        expect(state.ships['mewa-1'].coord).toEqual(target)
      }
    }
  })

  it('skips asteroid rotations that would face a rim at the ship', () => {
    let state = createInitialState('rotate-rocks')
    state = applyCommand(state, { type: 'DEV_FORCE_NEXT_TILE', tileId: 'asteroid-2' }).state
    state = applyCommand(state, { type: 'START_EXPLORATION', direction: 0 }).state
    const enter = oppositeDirection(0)
    for (let i = 0; i < 6; i++) {
      const rotation = state.exploration.rotation ?? 0
      expect(
        isPassableEdge(getRotatedEdge(TILE_DEFINITIONS['asteroid-2'], enter, rotation)),
      ).toBe(true)
      state = applyCommand(state, { type: 'ROTATE_PENDING_TILE', direction: 'RIGHT' }).state
    }
  })
})
