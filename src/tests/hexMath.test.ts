import { describe, expect, it } from 'vitest'
import {
  getNeighbor,
  getNeighbors,
  getWorldPosition,
  hexDistance,
} from '../game/board/hexMath'
import { coordKey } from '../game/board/HexCoord'

describe('hexMath (flat-top axial)', () => {
  it('getNeighbor east is +q', () => {
    expect(getNeighbor({ q: 0, r: 0 }, 0)).toEqual({ q: 1, r: 0 })
  })

  it('six neighbors around origin', () => {
    const keys = getNeighbors({ q: 0, r: 0 }).map(coordKey).sort()
    expect(keys).toEqual(['-1,0', '-1,1', '0,-1', '0,1', '1,-1', '1,0'].sort())
  })

  it('hexDistance', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0)
    expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1)
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: -1 })).toBe(2)
  })

  it('getWorldPosition is deterministic and origin is zero', () => {
    expect(getWorldPosition({ q: 0, r: 0 })).toEqual({ x: 0, z: 0 })
    const a = getWorldPosition({ q: 1, r: 0 })
    const b = getWorldPosition({ q: 1, r: 0 })
    expect(a).toEqual(b)
    expect(a.x).toBeGreaterThan(0)
  })

  it('neighbor of neighbor opposite returns origin', () => {
    for (let d = 0; d < 6; d++) {
      const n = getNeighbor({ q: 2, r: -1 }, d)
      const back = getNeighbor(n, (d + 3) % 6)
      expect(back).toEqual({ q: 2, r: -1 })
    }
  })
})
