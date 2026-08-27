import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialState } from '../game/engine/GameEngine'
import { getRotatedEdge } from '../game/board/tileRotation'
import { TILE_DEFINITIONS } from '../game/definitions/tiles'
import { oppositeDirection } from '../game/board/HexMap'

describe('strait layouts', () => {
  it('has a three-way, a bent, and a through passage', () => {
    expect(TILE_DEFINITIONS['strait-1'].edges.filter((e) => e === 'OPEN')).toHaveLength(3)
    expect(TILE_DEFINITIONS['strait-2'].edges.filter((e) => e === 'OPEN')).toHaveLength(2)
    expect(TILE_DEFINITIONS['strait-3'].edges.filter((e) => e === 'OPEN')).toHaveLength(2)
    expect(TILE_DEFINITIONS['strait-3'].edges[0]).toBe('OPEN')
    expect(TILE_DEFINITIONS['strait-3'].edges[3]).toBe('OPEN')
  })

  it('orients a bent strait so the ship can enter', () => {
    let state = createInitialState('strait-bent')
    state = applyCommand(state, { type: 'DEV_FORCE_NEXT_TILE', tileId: 'strait-2' }).state
    const dir = 2
    state = applyCommand(state, { type: 'START_EXPLORATION', direction: dir }).state
    const enter = oppositeDirection(dir)
    const rotation = state.exploration.rotation ?? 0
    expect(getRotatedEdge(TILE_DEFINITIONS['strait-2'], enter, rotation)).toBe('OPEN')
  })
})
