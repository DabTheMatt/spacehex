import { describe, expect, it } from 'vitest'
import { applyCommand, createInitialState } from '../game/engine/GameEngine'
import { getRotatedEdge } from '../game/board/tileRotation'
import { TILE_DEFINITIONS } from '../game/definitions/tiles'
import { hexCorner } from '../game/board/hexMath'
import { oppositeDirection } from '../game/board/HexMap'

describe('strait layouts', () => {
  it('points hex faces at axial neighbors', () => {
    const a = hexCorner(0)
    const b = hexCorner(1)
    expect((a.x + b.x) / 2).toBeGreaterThan(0.8)
    expect((a.z + b.z) / 2).toBeCloseTo(0)
  })
  it('has a three-way, a bent, and a through passage', () => {
    expect(TILE_DEFINITIONS['strait-1'].edges.filter((e) => e === 'OPEN')).toHaveLength(3)
    expect(TILE_DEFINITIONS['strait-2'].edges.filter((e) => e === 'OPEN')).toHaveLength(2)
    expect(TILE_DEFINITIONS['strait-3'].edges.filter((e) => e === 'OPEN')).toHaveLength(2)
    expect(TILE_DEFINITIONS['strait-3'].edges[0]).toBe('OPEN')
    expect(TILE_DEFINITIONS['strait-3'].edges[3]).toBe('OPEN')
  })

  it('orients every strait so the ship enters an OPEN face', () => {
    for (const tileId of ['strait-1', 'strait-2', 'strait-3'] as const) {
      for (let dir = 0; dir < 6; dir++) {
        let state = createInitialState(`strait-enter-${tileId}-${dir}`)
        state = applyCommand(state, { type: 'DEV_FORCE_NEXT_TILE', tileId }).state
        state = applyCommand(state, { type: 'START_EXPLORATION', direction: dir }).state
        const enter = oppositeDirection(dir)
        const rotation = state.exploration.rotation ?? 0
        expect(getRotatedEdge(TILE_DEFINITIONS[tileId], enter, rotation)).toBe('OPEN')
      }
    }
  })
})
