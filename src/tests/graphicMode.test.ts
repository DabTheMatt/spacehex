import { describe, expect, it } from 'vitest'
import { parseGraphicMode } from '../renderer/graphicMode'
import { createTileGlyph } from '../renderer/board/tileGlyphs'
import { TILE_DEFINITIONS } from '../game/definitions/tiles'
import { palette } from '../renderer/theme'

describe('graphic mode', () => {
  it('treats only ink as the 2D skin', () => {
    expect(parseGraphicMode('ink')).toBe('ink')
    expect(parseGraphicMode('space')).toBe('space')
    expect(parseGraphicMode(null)).toBe('space')
    expect(parseGraphicMode('nope')).toBe('space')
  })

  it('builds axis-aligned ink glyphs without spin tags', () => {
    const glyph = createTileGlyph(
      TILE_DEFINITIONS['planet-medium-1'],
      palette.paper,
      'ink-planet',
      false,
      undefined,
      true,
    )
    expect(glyph.userData.ink).toBe(true)
    let spins = 0
    glyph.traverse((obj) => {
      if (obj.userData.animate === 'spin' || obj.userData.animate === 'moon') spins += 1
    })
    expect(spins).toBe(0)
  })
})
