import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
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

  it('orbits a moon around medium planets', () => {
    const glyph = createTileGlyph(TILE_DEFINITIONS['planet-medium-1'])
    let moons = 0
    glyph.traverse((obj) => {
      if (obj.userData.animate === 'moon') moons += 1
    })
    expect(moons).toBe(1)
  })

  it('paints a probe-scan planet glyph engine blue instead of a muted tint', () => {
    const glyph = createTileGlyph(TILE_DEFINITIONS['planet-medium-1'], palette.engine, 'scan-planet', true)
    const colors = new Set<number>()
    glyph.traverse((obj) => {
      const mat = (obj as THREE.Line).material as THREE.LineBasicMaterial | undefined
      if (!mat || !('color' in mat)) return
      colors.add(mat.color.getHex())
    })
    expect(colors.has(palette.engine)).toBe(true)
    expect(colors.has(planetTintForId('scan-planet'))).toBe(false)
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

  it('keeps the EVA core still while the hub, docks, and airlock dots spin', () => {
    const glyph = createTileGlyph(TILE_DEFINITIONS['eva-1'])
    let hubs = 0
    const pulses: number[] = []
    glyph.traverse((obj) => {
      if (obj.userData.animate === 'evaHub') hubs += 1
      if (obj.userData.animate === 'evaPulse') pulses.push(Number(obj.userData.pulseIndex))
    })
    expect(hubs).toBe(1)
    expect(pulses.sort()).toEqual([0, 1, 2])
  })

  it('marks a fuel cell, EVA repair, asteroid chance, and edge numbers', () => {
    const eva = createTileGlyph(TILE_DEFINITIONS['eva-1'], palette.paper, 'eva-1', false, [1, 2, 3, 4, 5, 6])
    let fuel = 0
    let repair = 0
    let digits = 0
    eva.traverse((obj) => {
      if (obj.userData.fuelCell) fuel += 1
      if (obj.userData.repairMark) repair += 1
      if (obj.userData.edgeDigit) digits += 1
    })
    expect(fuel).toBe(1)
    expect(repair).toBe(1)
    expect(digits).toBe(6)
    const rock = createTileGlyph(TILE_DEFINITIONS['asteroid-1'])
    let chance = 0
    rock.traverse((obj) => {
      if (obj.userData.collisionChance) chance += 1
    })
    expect(chance).toBe(1)
    expect(createTileGlyph(TILE_DEFINITIONS['vortex-1']).children.length).toBeGreaterThan(0)
    expect(createTileGlyph(TILE_DEFINITIONS['space-gate-1']).children.length).toBeGreaterThan(0)
    expect(createTileGlyph(TILE_DEFINITIONS['strait-1']).children.length).toBeGreaterThan(0)
  })
})