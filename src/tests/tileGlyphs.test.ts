import { describe, expect, it } from 'vitest'
import { TILE_DEFINITIONS } from '../game/definitions/tiles'
import { createTileGlyph } from '../renderer/board/tileGlyphs'

describe('tile glyphs', () => {
  it('gives each asteroid its own spin speed and direction', () => {
    const glyph = createTileGlyph(TILE_DEFINITIONS['asteroid-1'])
    const spins: Array<{ x: number; y: number; z: number }> = []
    glyph.traverse((obj) => {
      if (obj.userData.animate !== 'asteroid') return
      spins.push({
        x: Number(obj.userData.spinX),
        y: Number(obj.userData.spinY),
        z: Number(obj.userData.spinZ),
      })
    })
    expect(spins.length).toBeGreaterThanOrEqual(6)
    const keys = spins.map((spin) => `${spin.x}:${spin.y}:${spin.z}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(spins.some((spin) => spin.y > 0)).toBe(true)
    expect(spins.some((spin) => spin.y < 0)).toBe(true)
  })
})
