import { describe, expect, it } from 'vitest'
import { clamp01, easeInOutCubic, easeOutCubic, lerp, lerpAngle } from '../renderer/motion'
import { TILE_SETTLED_Y, TILE_SLOT_Y, TILE_THICKNESS } from '../renderer/board/TileRenderer'

describe('placement motion', () => {
  it('eases a tile from below the floor up to settled height', () => {
    expect(TILE_SLOT_Y + TILE_THICKNESS).toBe(TILE_SETTLED_Y)
    expect(TILE_SLOT_Y).toBeLessThan(TILE_SETTLED_Y)
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    const mid = lerp(TILE_SLOT_Y, TILE_SETTLED_Y, easeOutCubic(0.5))
    expect(mid).toBeGreaterThan(TILE_SLOT_Y)
    expect(mid).toBeLessThan(TILE_SETTLED_Y)
    expect(lerp(TILE_SLOT_Y, TILE_SETTLED_Y, easeOutCubic(1))).toBe(TILE_SETTLED_Y)
  })

  it('eases in and out so a ship starts still and brakes at the target', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5)
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25)
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75)
    expect(clamp01(2)).toBe(1)
  })

  it('turns the short way around the circle', () => {
    expect(lerpAngle(0, Math.PI / 2, 0)).toBeCloseTo(0)
    expect(lerpAngle(0, Math.PI / 2, 1)).toBeCloseTo(Math.PI / 2)
    const mid = lerpAngle(Math.PI * 0.9, -Math.PI * 0.9, 0.5)
    expect(Math.atan2(Math.sin(mid), Math.cos(mid))).toBeCloseTo(Math.PI)
  })
})
