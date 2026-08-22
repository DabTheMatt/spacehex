import { describe, expect, it } from 'vitest'
import { TILE_DEFINITIONS } from '../game/definitions/tiles'
import { createTileGlyph, planetTintForId } from '../renderer/board/tileGlyphs'
import { palette } from '../renderer/theme'

describe('tile glyphs', () => {
  it('spins each asteroid in the tile plane at its own rate', () => {
    const glyph = createTileGlyph(TILE_DEFINITIONS['asteroid-1'])
    const spins: number[] = []
    glyph.traverse((obj) => {
      if (obj.userData.animate !== 'asteroid') return
      spins.push(Number(obj.userData.spinY))
    })
    expect(spins.length).toBeGreaterThanOrEqual(6)
    expect(new Set(spins).size).toBe(spins.length)
    expect(spins.some((speed) => speed > 0)).toBe(true)
    expect(spins.some((speed) => speed < 0)).toBe(true)
  })

  it('tumbles three crates on the wrecked transport', () => {
    const glyph = createTileGlyph(TILE_DEFINITIONS['wreck-transport-1'])
    const spins: number[] = []
    glyph.traverse((obj) => {
      if (obj.userData.animate !== 'crate') return
      spins.push(Number(obj.userData.spinY))
    })
    expect(spins).toHaveLength(3)
    expect(new Set(spins).size).toBe(3)
  })

  it('tints planets from the muted violet / rose / sage set', () => {
    const tints = [palette.planetViolet, palette.planetRose, palette.planetSage]
    expect(tints).toContain(planetTintForId('planet-large-1'))
    expect(planetTintForId('planet-large-1')).toBe(planetTintForId('planet-large-1'))
    const seen = new Set(
      ['planet-large-1', 'planet-large-2', 'planet-medium-1', 'planet-small-1', 'planet-small-5'].map(
        (id) => planetTintForId(id),
      ),
    )
    expect(seen.size).toBeGreaterThan(1)
  })
})
