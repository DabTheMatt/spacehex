import { describe, expect, it } from 'vitest'
import { parseGraphicMode } from '../renderer/graphicMode'
import { palette, scenePalette } from '../renderer/theme'
import { createTileGlyph } from '../renderer/board/tileGlyphs'
import { TILE_DEFINITIONS } from '../game/definitions/tiles'

describe('graphic mode', () => {
  it('accepts ink and ink-reversed as 2D skins', () => {
    expect(parseGraphicMode('ink')).toBe('ink')
    expect(parseGraphicMode('ink-reversed')).toBe('ink-reversed')
    expect(parseGraphicMode('space')).toBe('space')
    expect(parseGraphicMode(null)).toBe('space')
    expect(parseGraphicMode('nope')).toBe('space')
  })

  it('uses black paper on INK REV so planet lots contrast the white hex', () => {
    expect(scenePalette('ink').paper).toBe(0xffffff)
    expect(scenePalette('ink-reversed').paper).toBe(0x000000)
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
