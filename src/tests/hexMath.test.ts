import { describe, expect, it } from 'vitest'
import {
  HEX_CORNER_PHASE,
  getNeighbor,
  getNeighbors,
  getWorldPosition,
  hexCorner,
  hexDistance,
  hexEdgeCorners,
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

  it('flat-top corners nest with axial neighbor bearings', () => {
    expect(HEX_CORNER_PHASE).toBe(0)
    const northA = hexCorner(1)
    const northB = hexCorner(2)
    expect(northA.z).toBeCloseTo(northB.z)
    expect(northA.x).toBeGreaterThan(0.4)
    expect(northB.x).toBeLessThan(-0.4)
    for (let i = 0; i < 6; i++) {
      const w = getWorldPosition(getNeighbor({ q: 0, r: 0 }, i))
      const [a, b] = hexEdgeCorners(i)
      expect(Math.atan2((a.z + b.z) / 2, (a.x + b.x) / 2)).toBeCloseTo(Math.atan2(w.z, w.x))
    }
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
