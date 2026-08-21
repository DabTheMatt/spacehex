import { describe, expect, it } from 'vitest'
import { clamp01, easeInOutCubic, easeOutCubic, lerp } from '../renderer/motion'
import { TILE_SETTLED_Y, TILE_SLOT_Y } from '../renderer/board/TileRenderer'

describe('placement motion', () => {
  it('eases a tile from the ghost slot up to settled height', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    const mid = lerp(TILE_SLOT_Y, TILE_SETTLED_Y, easeOutCubic(0.5))
    expect(mid).toBeGreaterThan(TILE_SLOT_Y)
    expect(mid).toBeLessThan(TILE_SETTLED_Y)
    expect(lerp(TILE_SLOT_Y, TILE_SETTLED_Y, easeOutCubic(1))).toBe(TILE_SETTLED_Y)
  })

  it('ships use a symmetric ease that starts and ends still', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5)
    expect(clamp01(2)).toBe(1)
  })
})
